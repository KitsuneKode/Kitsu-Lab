"use client"

import { useEffect, useRef, useState } from "react"
import { ZoomInIcon, ZoomOutIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
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

// A zoom of 0 is the fit-width sentinel: the real scale is derived per page
// from the live scroller width, so phones and mixed-orientation documents
// open readable instead of pre-panned.
const PDF_FIT_ZOOM = 0
const PDF_MIN_ZOOM = 0.5
const PDF_MAX_ZOOM = 4
const PDF_STAGE_PAD = 32

function clampZoom(value: number): number {
  return Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, value))
}

export default function PdfEngine({
  source,
  pageIndex,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const docTaskRef = useRef<PdfLoadResult["task"] | null>(null)
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null)
  const [zoom, setZoom] = useState(PDF_FIT_ZOOM)
  const [fitted, setFitted] = useState(1)
  const [fitTick, setFitTick] = useState(0)
  const fittedRef = useRef(1)
  const zoomRef = useRef(PDF_FIT_ZOOM)
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

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
        const loaded = await loadPdfDocument(source.pdfUrl)
        if (cancelled) {
          await loaded.task.destroy()
          return
        }
        docTaskRef.current = loaded.task
        doc = loaded.doc
        setPdf(doc)
        // A new document always opens at fit-width.
        setZoom(PDF_FIT_ZOOM)
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
  }, [reportError, reportReady, source.allowPdfUpload, source.downloadUrl, source.pdfUrl])

  // In fit mode a container resize is a zoom change.
  useEffect(() => {
    const node = scrollRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (zoomRef.current === PDF_FIT_ZOOM) setFitTick((tick) => tick + 1)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

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
        // The fit scale uses this page's own base size, so a landscape figure
        // inside a portrait document still reads edge to edge.
        const base = page.getViewport({ scale: 1 })
        const hostWidth = Math.max(
          240,
          (scrollRef.current?.clientWidth ?? base.width) - PDF_STAGE_PAD
        )
        const fit = Math.min(3, Math.max(0.4, hostWidth / base.width))
        fittedRef.current = fit
        setFitted(fit)
        const effective = zoom > 0 ? zoom : fit
        renderTask = renderPdfPageToCanvas({ page, canvas, scale: effective })
        await renderTask.promise
        // Selectable text belongs on the flat reader: the canvas here is
        // static, so real spans can sit exactly over it.
        const container = textLayerEl
        if (cancelled || !container) return
        container.replaceChildren()
        container.style.width = canvas.style.width
        container.style.height = canvas.style.height
        // PDF.js positions every span against this factor.
        container.style.setProperty("--total-scale-factor", String(effective))
        textLayer = await renderPdfTextLayer({ page, container, scale: effective })
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
  }, [pageIndex, pdf, reportError, zoom, fitTick])

  // Ctrl+wheel (and trackpad pinch, which browsers surface as ctrl+wheel) zooms
  // the document instead of scrolling. Needs a non-passive native listener.
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return
      event.preventDefault()
      const current = zoomRef.current > 0 ? zoomRef.current : fittedRef.current
      setZoom(clampZoom(current - Math.sign(event.deltaY) * 0.15))
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [])

  const effectiveZoom = zoom > 0 ? zoom : fitted

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <p className="text-xs text-muted-foreground">{source.pdfFileName ?? "Document"}</p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom out"
          onClick={() => setZoom(clampZoom(effectiveZoom - 0.25))}
          data-book-preview-press
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
        >
          <ZoomOutIcon />
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          {zoom === PDF_FIT_ZOOM
            ? `Fit ${Math.round(effectiveZoom * 100)}%`
            : `${Math.round(zoom * 100)}%`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Zoom in"
          onClick={() => setZoom(clampZoom(effectiveZoom + 0.25))}
          data-book-preview-press
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
        >
          <ZoomInIcon />
        </Button>
        <Button
          type="button"
          variant={zoom === PDF_FIT_ZOOM ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={zoom === PDF_FIT_ZOOM}
          aria-label="Fit page width"
          onClick={() => setZoom(PDF_FIT_ZOOM)}
          data-book-preview-press
        >
          Fit
        </Button>
      </div>
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 overflow-auto rounded-lg border bg-muted/30 p-4"
        onDoubleClick={() =>
          setZoom((current) =>
            current === PDF_FIT_ZOOM ? clampZoom(fittedRef.current * 1.75) : PDF_FIT_ZOOM
          )
        }
      >
        {!pdf ? (
          <div className="m-auto flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            {source.allowPdfUpload ? "Upload or drop a PDF to begin" : "Waiting for a document"}
          </div>
        ) : (
          /* Auto margins center a page that fits and let a zoomed page scroll
             to every edge — justify-center would clip the start side. The
             canvas keeps its exact rendered size so the text layer can sit
             precisely on top. */
          <div className="relative m-auto shrink-0">
            <canvas ref={canvasRef} className="block rounded bg-background shadow" />
            <div ref={textLayerRef} className="textLayer" data-book-preview-text-layer />
          </div>
        )}
      </div>
    </div>
  )
}
