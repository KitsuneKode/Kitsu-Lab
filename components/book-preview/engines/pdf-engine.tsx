"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"
import { UploadIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buttonVariants } from "@/components/ui/button-variants"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { DEFAULT_CAPABILITIES } from "../capabilities"
import { useStableHandler } from "../hooks/use-stable-handler"
import {
  loadPdfDocument,
  renderPdfPageToCanvas,
  renderPdfTextLayer,
  type PdfDocumentProxy,
  type PdfLoadResult,
} from "../pdf-runtime"
import type { BookPreviewEngineProps } from "../types"

export default function PdfEngine({
  source,
  pageIndex,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const docTaskRef = useRef<PdfLoadResult["task"] | null>(null)
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null)
  const [scale, setScale] = useState(1.2)
  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState(source.pdfFileName ?? "Document")
  const uploadInputId = useId()
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)

  const loadFrom = useCallback((src: string | { data: ArrayBuffer }) => loadPdfDocument(src), [])

  useEffect(() => {
    let cancelled = false
    let doc: PdfDocumentProxy | null = null

    async function open() {
      if (!source.pdfUrl && !source.allowPdfUpload) {
        reportError({
          kind: "invalid-source",
          message: "Provide a PDF URL or enable uploads.",
        })
        return
      }
      if (!source.pdfUrl) {
        reportReady({
          totalPages: 0,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            upload: true,
            zoom: true,
            appearance: false,
            sound: false,
          },
        })
        return
      }
      try {
        const loaded = await loadFrom(source.pdfUrl)
        if (cancelled) {
          await loaded.task.destroy()
          return
        }
        docTaskRef.current = loaded.task
        doc = loaded.doc
        setPdf(doc)
        reportReady({
          totalPages: doc.numPages,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            zoom: true,
            upload: source.allowPdfUpload,
            download: Boolean(source.downloadUrl || source.pdfUrl),
            appearance: false,
            sound: false,
          },
        })
      } catch {
        if (!cancelled) {
          reportError({ kind: "pdf-parse", message: "This PDF could not be opened." })
        }
      }
    }

    void open()
    return () => {
      cancelled = true
      void docTaskRef.current?.destroy()
      docTaskRef.current = null
      setPdf(null)
    }
  }, [
    loadFrom,
    reportError,
    reportReady,
    source.allowPdfUpload,
    source.downloadUrl,
    source.pdfUrl,
  ])

  useEffect(() => {
    if (!pdf || !canvasRef.current) return
    let cancelled = false
    let renderTask: { promise: Promise<void>; cancel: () => void } | null = null
    const documentProxy = pdf
    const textLayerEl = textLayerRef.current

    let textLayer: { cancel: () => void } | null = null

    async function draw() {
      try {
        const page = await documentProxy.getPage(pageIndex + 1)
        if (cancelled || !canvasRef.current) return
        const canvas = canvasRef.current
        renderTask = renderPdfPageToCanvas({ page, canvas, scale })
        await renderTask.promise
        // Selectable text belongs on the flat reader: the canvas here is
        // static, so real spans can sit exactly over it.
        const container = textLayerEl
        if (cancelled || !container) return
        container.replaceChildren()
        container.style.width = canvas.style.width
        container.style.height = canvas.style.height
        // PDF.js positions every span against this factor.
        container.style.setProperty("--total-scale-factor", String(scale))
        textLayer = await renderPdfTextLayer({ page, container, scale })
      } catch (error) {
        const named = error as { name?: string }
        if (named.name !== "RenderingCancelledException" && !cancelled) {
          reportError({ kind: "pdf-render", message: "This page could not be rendered." })
        }
      }
    }

    void draw()
    return () => {
      cancelled = true
      renderTask?.cancel()
      textLayer?.cancel()
      textLayerEl?.replaceChildren()
    }
  }, [pageIndex, pdf, reportError, scale])

  // Ctrl+wheel (and trackpad pinch, which browsers surface as ctrl+wheel) zooms
  // the document instead of scrolling. Needs a non-passive native listener.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      setScale((value) => Math.min(2, Math.max(0.7, value - Math.sign(event.deltaY) * 0.1)))
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [])

  const onUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    input.value = ""
    if (!file || parsing) return
    if (file.type !== "application/pdf") {
      reportError({ kind: "upload", message: "Only PDF files can be uploaded." })
      return
    }
    setParsing(true)
    try {
      const buffer = await file.arrayBuffer()
      const loaded = await loadFrom({ data: buffer })
      // Replace the previous document only after the new one parses, and
      // release its loading task so PDF.js workers do not linger.
      const previousTask = docTaskRef.current
      docTaskRef.current = loaded.task
      void previousTask?.destroy()
      setPdf(loaded.doc)
      setFileName(file.name)
      onPageChange(0)
      reportReady({
        totalPages: loaded.doc.numPages,
        capabilities: {
          ...DEFAULT_CAPABILITIES,
          zoom: true,
          upload: true,
          download: false,
          appearance: false,
          sound: false,
        },
      })
    } catch {
      reportError({ kind: "upload", message: "The uploaded PDF could not be parsed." })
    } finally {
      setParsing(false)
    }
  }

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {source.allowPdfUpload ? (
          <label
            htmlFor={uploadInputId}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              parsing && "pointer-events-none opacity-50"
            )}
            aria-disabled={parsing}
            data-book-preview-press
          >
            {parsing ? <Spinner data-icon="inline-start" /> : <UploadIcon data-icon="inline-start" />}
            {parsing ? "Opening…" : "Upload PDF"}
            <input id={uploadInputId} type="file" accept="application/pdf" className="sr-only" onChange={onUpload} />
          </label>
        ) : null}
        <p className="text-xs text-muted-foreground">{fileName}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => setScale((value) => Math.max(0.7, value - 0.2))}
          data-book-preview-press
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
        >
          <ZoomOutIcon />
        </Button>
        <span className="font-mono text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => setScale((value) => Math.min(2, value + 0.2))}
          data-book-preview-press
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
        >
          <ZoomInIcon />
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto rounded-lg border bg-muted/30 p-4"
        onDoubleClick={() => setScale((value) => (value > 1.2 ? 1.2 : 1.8))}
      >
        {!pdf ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Waiting for a document
          </div>
        ) : (
          /* The canvas keeps its exact rendered size so the text layer can sit
             precisely on top; zooming pans inside the scroller rather than
             shrinking the page out of alignment. */
          <div className="relative shrink-0">
            <canvas ref={canvasRef} className="block rounded bg-background shadow" />
            <div ref={textLayerRef} className="textLayer" data-book-preview-text-layer />
          </div>
        )}
      </div>
    </div>
  )
}
