'use client'

import type { BookPreviewContentsEntry } from './types'

export type PdfTextItem = { str?: string }
export type PdfTextContent = { items: PdfTextItem[] }

export type PdfPageProxy = {
  getViewport: (options: { scale: number; rotation?: number }) => {
    width: number
    height: number
    /** Maps a PDF user-space rect to CSS pixels for this viewport. */
    convertToViewportRectangle?: (rect: number[]) => number[]
  }
  getTextContent?: () => Promise<PdfTextContent>
  getAnnotations?: (options?: { intent?: string }) => Promise<PdfAnnotation[]>
  render: (options: {
    canvasContext: CanvasRenderingContext2D
    viewport: { width: number; height: number }
    transform?: number[]
  }) => { promise: Promise<void>; cancel: () => void }
}

export type PdfAnnotation = {
  subtype?: string
  /** [x1, y1, x2, y2] in PDF user space — null on malformed annotations. */
  rect?: number[] | null
  url?: string
  unsafeUrl?: string
  dest?: PdfOutlineNode['dest']
}

export type PdfDestinationRef = { num: number; gen: number }

export type PdfOutlineNode = {
  title?: string
  dest?: string | unknown[] | null
  items?: PdfOutlineNode[] | null
}

export type PdfDocumentProxy = {
  numPages: number
  getPage: (pageNumber: number) => Promise<PdfPageProxy>
  getOutline?: () => Promise<PdfOutlineNode[] | null>
  getDestination?: (id: string) => Promise<unknown[] | null>
  getPageIndex?: (ref: PdfDestinationRef) => Promise<number>
}

export type PdfLoadResult = {
  task: PdfLoadingTask
  doc: PdfDocumentProxy
}

export type PdfSource = string | { data: ArrayBuffer }

/** The pdf.js loading task, typed loosely — engines need it to destroy a
    document that is still waiting on a password prompt. */
export type PdfLoadingTask = {
  promise: Promise<unknown>
  destroy: () => Promise<void>
  onPassword?: (
    updatePassword: (password: string) => void,
    reason: number,
  ) => void
}

/** pdf.js asks for a password through this bridge: `submit` answers the
    prompt, and an `incorrect` re-ask means the last answer was rejected. */
export type PdfPasswordRequest = {
  incorrect: boolean
  submit: (password: string) => void
}

export async function loadPdfDocument(
  src: PdfSource,
  options?: {
    onPassword?: (request: PdfPasswordRequest) => void
    /** Fires synchronously with the task so callers can destroy a document
        that never resolves (e.g. abandoned password prompt). */
    onTask?: (task: PdfLoadingTask) => void
    /** Give up after this many ms — a stalled fetch/worker otherwise leaves
        task.promise pending forever and the reader spins indefinitely. */
    timeoutMs?: number
  },
): Promise<PdfLoadResult> {
  const pdfjs = await import('pdfjs-dist')
  if (
    !pdfjs.GlobalWorkerOptions.workerSrc &&
    !pdfjs.GlobalWorkerOptions.workerPort
  ) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).toString()
  }
  const source = typeof src === 'string' ? { url: src } : src
  const task = pdfjs.getDocument(source) as unknown as PdfLoadingTask
  options?.onTask?.(task)
  // A parked password prompt is a user wait, not a stalled load — the
  // timeout must not fire while one is outstanding.
  let passwordPending = false
  if (options?.onPassword) {
    const responses = (
      pdfjs as { PasswordResponses?: { INCORRECT_PASSWORD?: number } }
    ).PasswordResponses
    const onPassword = options.onPassword
    task.onPassword = (updatePassword, reason) => {
      passwordPending = true
      onPassword({
        incorrect: reason === (responses?.INCORRECT_PASSWORD ?? 2),
        submit: (password: string) => {
          passwordPending = false
          updatePassword(password)
        },
      })
    }
  }
  const timeoutMs = options?.timeoutMs
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const doc = timeoutMs
      ? await Promise.race([
          task.promise as Promise<PdfDocumentProxy>,
          new Promise<never>((_, reject) => {
            const arm = () => {
              timer = setTimeout(() => {
                if (passwordPending) {
                  arm()
                  return
                }
                reject(new Error(`PDF load timed out after ${timeoutMs}ms`))
              }, timeoutMs)
            }
            arm()
          }),
        ])
      : ((await task.promise) as PdfDocumentProxy)
    return { task, doc }
  } catch (error) {
    // A timed-out task is dead weight — destroy it so the worker is freed
    // instead of leaving a zombie load running in the background.
    await task.destroy().catch(() => {})
    throw error
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// Uncapped devicePixelRatio turns a page into a ~30MP canvas on 3x phones;
// past 2x the extra pixels are invisible while reading.
const PDF_MAX_RENDER_DPR = 2

function defaultPixelRatio(): number {
  if (typeof window === 'undefined') return 1
  return Math.min(PDF_MAX_RENDER_DPR, Math.max(1, window.devicePixelRatio || 1))
}

export function renderPdfPageToCanvas(input: {
  page: PdfPageProxy
  canvas: HTMLCanvasElement
  scale: number
  /** Extra rotation in degrees (0/90/180/270) on top of the page's own. */
  rotation?: number
  pixelRatio?: number
}): { promise: Promise<void>; cancel: () => void } {
  const pixelRatio = input.pixelRatio ?? defaultPixelRatio()
  const viewport = input.page.getViewport({
    scale: input.scale,
    rotation: input.rotation,
  })
  const context = input.canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create a canvas for this PDF page.')
  }
  input.canvas.width = Math.max(1, Math.floor(viewport.width * pixelRatio))
  input.canvas.height = Math.max(1, Math.floor(viewport.height * pixelRatio))
  input.canvas.style.width = `${Math.floor(viewport.width)}px`
  input.canvas.style.height = `${Math.floor(viewport.height)}px`
  const transform =
    pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0]
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
  if (typeof page.getTextContent !== 'function') return ''
  try {
    const content = await page.getTextContent()
    return content.items
      .map((item) => item.str ?? '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    // An image-only or malformed page simply has no text.
    return ''
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
  rotation?: number
}): Promise<{ cancel: () => void }> {
  if (typeof input.page.getTextContent !== 'function') {
    return { cancel: () => {} }
  }
  const pdfjs = await import('pdfjs-dist')
  const viewport = input.page.getViewport({
    scale: input.scale,
    rotation: input.rotation,
  })
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
    if (typeof canvas.toBlob !== 'function') {
      resolve(canvas.toDataURL('image/png'))
      return
    }
    canvas.toBlob((blob) => {
      resolve(blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/png'))
    }, 'image/png')
  })
}

/** Release a URL produced by `rasterizePdfPage`. Safe for data-URL fallbacks. */
export function releaseRasterUrl(src: string | undefined | null): void {
  if (!src || !src.startsWith('blob:')) return
  try {
    URL.revokeObjectURL(src)
  } catch {
    // Already revoked, or the document is being torn down.
  }
}

// A document outline can nest arbitrarily deep; the contents menu only needs
// a few levels of indentation, and a malformed file should never grow the
// menu without bound.
const OUTLINE_MAX_ENTRIES = 300
const OUTLINE_MAX_DEPTH = 4

function outlineDestinationRef(
  dest: PdfOutlineNode['dest'],
): PdfDestinationRef | string | number | null {
  if (typeof dest === 'string') return dest
  if (Array.isArray(dest)) {
    const first = dest[0] as
      | Partial<PdfDestinationRef>
      | number
      | null
      | undefined
    // Some writers emit a bare zero-based page index instead of a reference.
    if (typeof first === 'number') return first
    if (first && typeof first.num === 'number')
      return first as PdfDestinationRef
  }
  return null
}

/**
 * Reads the document outline ("bookmarks") into flat contents entries for the
 * toolbar menu. Entries without a resolvable page destination are dropped —
 * external links and action bookmarks have nowhere in the reader to go.
 */
export async function resolvePdfOutline(
  doc: PdfDocumentProxy,
): Promise<BookPreviewContentsEntry[]> {
  if (
    typeof doc.getOutline !== 'function' ||
    typeof doc.getPageIndex !== 'function'
  ) {
    return []
  }
  let outline: PdfOutlineNode[] | null
  try {
    outline = await doc.getOutline()
  } catch {
    return []
  }
  if (!outline || outline.length === 0) return []

  const flat: {
    title: string
    depth: number
    ref: PdfDestinationRef | string | number | null
  }[] = []
  const walk = (nodes: PdfOutlineNode[], depth: number) => {
    for (const node of nodes) {
      if (flat.length >= OUTLINE_MAX_ENTRIES) return
      const title = node.title?.trim()
      if (title) {
        flat.push({
          title,
          depth: Math.min(depth, OUTLINE_MAX_DEPTH),
          ref: outlineDestinationRef(node.dest),
        })
      }
      if (node.items && node.items.length > 0) walk(node.items, depth + 1)
    }
  }
  walk(outline, 0)

  const entries = await Promise.all(
    flat.map(async (item) => {
      if (!item.ref) return null
      const pageIndex = await resolvePdfDestPageIndex(doc, item.ref)
      return pageIndex === null
        ? null
        : { title: item.title, pageIndex, depth: item.depth }
    }),
  )
  return entries.filter(
    (entry): entry is BookPreviewContentsEntry => entry !== null,
  )
}

/**
 * Resolves an explicit or named PDF destination to a zero-based page index.
 * Explicit arrays carry a page reference ({num, gen}) or, in some files, a
 * bare page index; named destinations go through getDestination first.
 * Anything that cannot be resolved inside this document returns null.
 */
async function resolvePdfDestPageIndex(
  doc: PdfDocumentProxy,
  dest: PdfDestinationRef | string | number | null | undefined,
): Promise<number | null> {
  if (
    dest === null ||
    dest === undefined ||
    typeof doc.getPageIndex !== 'function'
  ) {
    return null
  }
  // A bare number is already a zero-based page index.
  if (typeof dest === 'number') {
    return dest >= 0 && dest < doc.numPages ? dest : null
  }
  try {
    let ref: PdfDestinationRef | string = dest
    if (typeof ref === 'string') {
      const resolved = ((await doc.getDestination?.(ref)) ??
        null) as PdfOutlineNode['dest']
      const inner = outlineDestinationRef(resolved)
      if (typeof inner === 'number') {
        return inner >= 0 && inner < doc.numPages ? inner : null
      }
      if (!inner || typeof inner === 'string') return null
      ref = inner
    }
    const pageIndex = await doc.getPageIndex(ref)
    if (
      !Number.isFinite(pageIndex) ||
      pageIndex < 0 ||
      pageIndex >= doc.numPages
    )
      return null
    return pageIndex
  } catch {
    return null
  }
}

// Link annotations may carry unsanitized URLs (unsafeUrl). Only schemes that
// are safe to navigate to pass through — javascript: and friends are dropped.
const LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:'])

export function sanitizePdfLinkUrl(
  raw: string | undefined | null,
): string | null {
  if (!raw) return null
  try {
    const url = new URL(raw)
    return LINK_PROTOCOLS.has(url.protocol) ? url.href : null
  } catch {
    return null
  }
}

export type PdfPageLink = {
  /** CSS-pixel rect within the rendered page box at the given scale. */
  left: number
  top: number
  width: number
  height: number
  target: { kind: 'page'; pageIndex: number } | { kind: 'url'; url: string }
}

/**
 * Resolves a page's link annotations into positioned click targets. Internal
 * document links become page indexes for the reader to navigate; external
 * links become sanitized URLs. Anything else (named actions, attachments,
 * malformed rects) is dropped — a dead annotation is better than a wrong one.
 */
export async function resolvePdfPageLinks(input: {
  page: PdfPageProxy
  doc: PdfDocumentProxy
  scale: number
  rotation?: number
}): Promise<PdfPageLink[]> {
  if (typeof input.page.getAnnotations !== 'function') return []
  let annotations: PdfAnnotation[]
  try {
    annotations = await input.page.getAnnotations({ intent: 'display' })
  } catch {
    return []
  }
  const viewport = input.page.getViewport({
    scale: input.scale,
    rotation: input.rotation,
  })
  const convert = viewport.convertToViewportRectangle
  if (!convert) return []

  const links: PdfPageLink[] = []
  for (const annotation of annotations) {
    if (annotation.subtype !== 'Link') continue
    const rect = annotation.rect
    if (!rect || rect.length < 4) continue
    const mapped = convert.call(viewport, rect)
    if (!mapped || mapped.length < 4) continue
    const left = Math.min(mapped[0], mapped[2])
    const top = Math.min(mapped[1], mapped[3])
    const width = Math.abs(mapped[2] - mapped[0])
    const height = Math.abs(mapped[3] - mapped[1])
    if (width < 1 || height < 1) continue

    const url = sanitizePdfLinkUrl(annotation.url ?? annotation.unsafeUrl)
    if (url) {
      links.push({ left, top, width, height, target: { kind: 'url', url } })
      continue
    }
    const dest = annotation.dest
    // Array destinations carry the target in their first slot (a page ref or
    // a bare page index); strings are named destinations.
    const target = Array.isArray(dest)
      ? (dest[0] as PdfDestinationRef | number | undefined)
      : dest
    const pageIndex = await resolvePdfDestPageIndex(input.doc, target)
    if (pageIndex !== null) {
      links.push({
        left,
        top,
        width,
        height,
        target: { kind: 'page', pageIndex },
      })
    }
  }
  return links
}

export async function rasterizePdfPage(input: {
  page: PdfPageProxy
  cssWidth: number
  cssHeight: number
  pixelRatio?: number
  rotation?: number
}): Promise<{ src: string; width: number; height: number }> {
  const pixelRatio = input.pixelRatio ?? defaultPixelRatio()
  const base = input.page.getViewport({ scale: 1, rotation: input.rotation })
  const fit = Math.min(
    input.cssWidth / base.width,
    input.cssHeight / base.height,
  )
  const viewport = input.page.getViewport({
    scale: fit,
    rotation: input.rotation,
  })
  const canvas = document.createElement('canvas')
  await renderPdfPageToCanvas({
    page: input.page,
    canvas,
    scale: fit,
    rotation: input.rotation,
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
