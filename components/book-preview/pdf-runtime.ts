"use client"

export type PdfTextItem = { str?: string }
export type PdfTextContent = { items: PdfTextItem[] }

export type PdfPageProxy = {
  getViewport: (options: { scale: number }) => { width: number; height: number }
  getTextContent?: () => Promise<PdfTextContent>
  render: (options: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
    transform?: number[]
  }) => { promise: Promise<void>; cancel: () => void }
}

export type PdfDocumentProxy = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPageProxy>
}

export type PdfLoadResult = {
  task: { destroy: () => Promise<void> }
  doc: PdfDocumentProxy
}

export type PdfSource = string | { data: ArrayBuffer }

export async function loadPdfDocument(src: PdfSource): Promise<PdfLoadResult> {
  const pdfjs = await import("pdfjs-dist")
  if (!pdfjs.GlobalWorkerOptions.workerSrc && !pdfjs.GlobalWorkerOptions.workerPort) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString()
  }
  const source = typeof src === "string" ? { url: src } : src
  const task = pdfjs.getDocument(source)
  const doc = (await task.promise) as unknown as PdfDocumentProxy
  return { task, doc }
}

export function renderPdfPageToCanvas(input: {
  page: PdfPageProxy
  canvas: HTMLCanvasElement
  scale: number
  pixelRatio?: number
}): { promise: Promise<void>; cancel: () => void } {
  const pixelRatio = input.pixelRatio ?? (typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1))
  const viewport = input.page.getViewport({ scale: input.scale })
  const context = input.canvas.getContext("2d")
  if (!context) {
    throw new Error("Could not create a canvas for this PDF page.")
  }
  input.canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio))
  input.canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio))
  input.canvas.style.width = `${Math.floor(viewport.width)}px`
  input.canvas.style.height = `${Math.floor(viewport.height)}px`
  const transform = pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0]
  return input.page.render({ canvasContext: context, viewport, transform })
}

/**
 * Plain text of a page, for search and speech.
 *
 * This is deliberately separate from the selectable text layer below. A curl
 * sheet is mid-flight 3D-transformed and cloned outside React, so putting
 * real selectable spans on it would break selection and cost a layer per
 * page. Paged curl reading wants *findable* text; only the flat reader wants
 * *selectable* text.
 */
export async function extractPdfPageText(page: PdfPageProxy): Promise<string> {
  if (typeof page.getTextContent !== "function") return ""
  try {
    const content = await page.getTextContent()
    return content.items
      .map((item) => item.str ?? "")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
  } catch {
    // An image-only or malformed page simply has no text.
    return ""
  }
}

/**
 * Renders a real, selectable text layer over an already-painted canvas.
 * The container must be positioned and exactly overlay the canvas box.
 */
export async function renderPdfTextLayer(input: {
  page: PdfPageProxy
  container: HTMLElement
  scale: number
}): Promise<{ cancel: () => void }> {
  if (typeof input.page.getTextContent !== "function") {
    return { cancel: () => {} }
  }
  const pdfjs = await import("pdfjs-dist")
  const viewport = input.page.getViewport({ scale: input.scale })
  const textContentSource = await input.page.getTextContent()
  const layer = new pdfjs.TextLayer({
    textContentSource: textContentSource as never,
    container: input.container,
    viewport: viewport as never,
  })
  await layer.render()
  return { cancel: () => layer.cancel() }
}

/** Intrinsic aspect ratio (height / width) of a page at scale 1. */
export function pdfPageAspectRatio(page: PdfPageProxy): number {
  const base = page.getViewport({ scale: 1 })
  if (!(base.width > 0) || !(base.height > 0)) return Math.SQRT2
  return base.height / base.width
}

function canvasToObjectUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve) => {
    // Blob URLs keep the bitmap out of the JS heap. A base64 data URL of the
    // same page is ~33% larger and is copied again by every DOM clone the
    // flip book makes, so it is only the fallback.
    if (typeof canvas.toBlob !== "function") {
      resolve(canvas.toDataURL("image/png"))
      return
    }
    canvas.toBlob((blob) => {
      resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL("image/png"))
    }, "image/png")
  })
}

/** Release a URL produced by `rasterizePdfPage`. Safe for data-URL fallbacks. */
export function releaseRasterUrl(src: string | undefined | null): void {
  if (!src || !src.startsWith("blob:")) return
  try {
    URL.revokeObjectURL(src)
  } catch {
    // Already revoked, or the document is being torn down.
  }
}

export async function rasterizePdfPage(input: {
  page: PdfPageProxy
  cssWidth: number
  cssHeight: number
  pixelRatio?: number
}): Promise<{ src: string; width: number; height: number }> {
  const pixelRatio = input.pixelRatio ?? (typeof window === "undefined" ? 1 : Math.max(1, window.devicePixelRatio || 1))
  const base = input.page.getViewport({ scale: 1 })
  const fit = Math.min(input.cssWidth / base.width, input.cssHeight / base.height)
  const viewport = input.page.getViewport({ scale: fit })
  const canvas = document.createElement("canvas")
  await renderPdfPageToCanvas({
    page: input.page,
    canvas,
    scale: fit,
    pixelRatio,
  }).promise
  const src = await canvasToObjectUrl(canvas)
  // Drop the backing store now that the bitmap is encoded; Safari keeps large
  // canvases alive well past the last reference otherwise.
  canvas.width = 0
  canvas.height = 0
  return {
    src,
    width: Math.floor(viewport.width),
    height: Math.floor(viewport.height),
  }
}
