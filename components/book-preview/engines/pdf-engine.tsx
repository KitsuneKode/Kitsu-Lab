"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import {
  ChevronDownIcon,
  ChevronUpIcon,
  PanelLeftIcon,
  SearchIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { DEFAULT_CAPABILITIES } from "../capabilities"
import { useStableHandler } from "../hooks/use-stable-handler"
import { useBookPreview } from "../book-preview-provider"
import { readBookPreviewPrefs, writeBookPreviewPrefs } from "../prefs"
import {
  loadPdfDocument,
  renderPdfPageToCanvas,
  renderPdfTextLayer,
  resolvePdfOutline,
  type PdfDocumentProxy,
  type PdfLoadResult,
} from "../pdf-runtime"
import type { BookPreviewCapabilities, BookPreviewEngineProps, NormalizedBookSource } from "../types"
import {
  createPdfSearchIndex,
  highlightTextLayer,
  PDF_SEARCH_HIT_ATTR,
  type PdfSearchHit,
} from "./pdf-search"
import { PdfThumbRail } from "./pdf-thumb-rail"

// A zoom of 0 is the fit-width sentinel: the real scale is derived per page
// from the live scroller width, so phones and mixed-orientation documents
// open readable instead of pre-panned.
const PDF_FIT_ZOOM = 0
const PDF_MIN_ZOOM = 0.5
const PDF_MAX_ZOOM = 4
const PDF_STAGE_PAD = 32
// Finger-drag smaller than this still counts as a tap, not a pan.
const TOUCH_PAN_SLOP_PX = 6

function clampZoom(value: number): number {
  return Math.min(PDF_MAX_ZOOM, Math.max(PDF_MIN_ZOOM, value))
}

function engineCapabilities(source: NormalizedBookSource): BookPreviewCapabilities {
  return {
    ...DEFAULT_CAPABILITIES,
    zoom: true,
    search: true,
    thumbnails: true,
    upload: source.allowPdfUpload,
    download: Boolean(source.downloadUrl || source.pdfUrl),
    appearance: false,
    sound: false,
  }
}

export default function PdfEngine({
  source,
  pageIndex,
  persistPreferences,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stageInnerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const docTaskRef = useRef<PdfLoadResult["task"] | null>(null)
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null)
  const [zoom, setZoom] = useState(PDF_FIT_ZOOM)
  const [fitted, setFitted] = useState(1)
  const [fitTick, setFitTick] = useState(0)
  const fittedRef = useRef(1)
  const zoomRef = useRef(PDF_FIT_ZOOM)
  const zoomHydratedRef = useRef(false)
  const pageIndexRef = useRef(pageIndex)
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)
  const reportPageChange = useStableHandler(onPageChange)
  const { engineShortcutsRef } = useBookPreview()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<PdfSearchHit[] | null>(null)
  const [hitIndex, setHitIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [thumbsOpen, setThumbsOpen] = useState(false)
  const activeQueryRef = useRef("")
  const pendingHitScrollRef = useRef(false)

  // Touch pan/pinch state. Pointer Events are the only portable way to drive
  // pinch on a scroll container: browsers claim two-finger gestures before a
  // site sees them, so the stage takes touch-action:none and pans manually.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const panRef = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const pinchRef = useRef<{
    startDist: number
    startMid: { x: number; y: number }
    /** Pinch midpoint in inner-element coordinates, captured at gesture start. */
    m: { x: number; y: number }
    baseZoom: number
    lastScale: number
    lastMid: { x: number; y: number }
  } | null>(null)
  const pinchCommitRef = useRef<{
    scale: number
    m: { x: number; y: number }
    target: { x: number; y: number }
  } | null>(null)

  useEffect(() => {
    zoomRef.current = zoom
  }, [zoom])

  useEffect(() => {
    pageIndexRef.current = pageIndex
  }, [pageIndex])

  const clearGesture = useCallback(() => {
    pointersRef.current.clear()
    panRef.current = null
    pinchRef.current = null
    // A pending pinch commit needs its transform left in place — it is what
    // keeps the pinch point glued under the fingers until the re-rendered
    // page paints and applyPinchCommit takes over.
    const inner = stageInnerRef.current
    if (inner && !pinchCommitRef.current) inner.style.transform = ""
  }, [])

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
        // A new document always opens at fit-width unless the reader has a
        // remembered zoom preference.
        if (persistPreferences) {
          const stored = readBookPreviewPrefs().pdfZoom
          setZoom(
            typeof stored === "number" && stored > 0 ? clampZoom(stored) : PDF_FIT_ZOOM
          )
        } else {
          setZoom(PDF_FIT_ZOOM)
        }
        zoomHydratedRef.current = true
        reportReady({
          totalPages: doc.numPages,
          capabilities: engineCapabilities(source),
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
    persistPreferences,
    reportError,
    reportReady,
    source.allowPdfUpload,
    source.downloadUrl,
    source.pdfUrl,
    source,
  ])

  // The author's outline becomes the reader's table of contents. Reported in
  // a second ready call so a slow bookmark walk never delays the first page.
  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    void resolvePdfOutline(pdf).then((contents) => {
      if (cancelled || contents.length === 0) return
      reportReady({
        totalPages: pdf.numPages,
        capabilities: engineCapabilities(source),
        contents,
      })
    })
    return () => {
      cancelled = true
    }
  }, [pdf, reportReady, source])

  // A fresh document gets a fresh search index — cached page text would point
  // at pages of the previous file — and the search state resets with it.
  const searchIndex = useMemo(() => (pdf ? createPdfSearchIndex(pdf) : null), [pdf])
  const [prevPdf, setPrevPdf] = useState(pdf)
  if (prevPdf !== pdf) {
    setPrevPdf(pdf)
    setHits(null)
    setHitIndex(0)
    setSearching(false)
    setQuery("")
  }

  const needle = query.trim()
  useEffect(() => {
    activeQueryRef.current = needle
  }, [needle])
  // A changed query invalidates the previous result list immediately — the
  // async search lands later, and stepping through stale hits would jump to
  // matches for text that is no longer being looked for.
  const [prevNeedle, setPrevNeedle] = useState(needle)
  if (prevNeedle !== needle) {
    setPrevNeedle(needle)
    setHits(null)
    setHitIndex(0)
  }
  const activeHits = needle ? hits : null

  // Find-as-you-type: debounce keystrokes, then walk pages in order. The walk
  // yields between pages and bails on the next query or unmount. The cursor
  // jump happens inside the async result so landing on a hit is atomic with
  // the list that produced it.
  useEffect(() => {
    if (!searchIndex || !needle) {
      const layer = textLayerRef.current
      if (layer) highlightTextLayer(layer, "")
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      setSearching(true)
      void searchIndex.search(needle, () => cancelled).then((nextHits) => {
        if (cancelled) return
        setSearching(false)
        setHits(nextHits)
        if (nextHits.length === 0) {
          setHitIndex(0)
          return
        }
        const after = nextHits.findIndex((hit) => hit.page > pageIndexRef.current + 1)
        const start = after >= 0 ? after : 0
        setHitIndex(start)
        pendingHitScrollRef.current = true
        reportPageChange(nextHits[start].page - 1, "instant")
      })
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [needle, searchIndex, reportPageChange])

  const stepHit = useCallback(
    (direction: 1 | -1) => {
      if (!activeHits || activeHits.length === 0) return
      const next = (hitIndex + direction + activeHits.length) % activeHits.length
      setHitIndex(next)
      pendingHitScrollRef.current = true
      reportPageChange(activeHits[next].page - 1, "instant")
    },
    [activeHits, hitIndex, reportPageChange]
  )

  const openSearch = useCallback(() => setSearchOpen(true), [])

  // Focus follows the open state rather than a microtask, which has no
  // ordering guarantee against the render that mounts the input.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

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

  // A remembered zoom is only written once the open() effect has applied the
  // stored value — otherwise mount would clobber the store with the default.
  useEffect(() => {
    if (!persistPreferences || !zoomHydratedRef.current) return
    writeBookPreviewPrefs({ pdfZoom: zoom })
  }, [persistPreferences, zoom])

  // The engine owns zoom/search state, so it registers handlers the shell's
  // keydown listener can invoke (+, -, 0, / and mod+F). Cleared on unmount.
  useEffect(() => {
    const ref = engineShortcutsRef
    ref.current = {
      zoomIn: () =>
        setZoom(clampZoom((zoomRef.current > 0 ? zoomRef.current : fittedRef.current) + 0.25)),
      zoomOut: () =>
        setZoom(clampZoom((zoomRef.current > 0 ? zoomRef.current : fittedRef.current) - 0.25)),
      zoomReset: () => setZoom(PDF_FIT_ZOOM),
      search: openSearch,
    }
    return () => {
      ref.current = {}
    }
  }, [engineShortcutsRef, openSearch])

  // Re-centers the view after a pinch commits: the transform held the pinch
  // point under the fingers while the old render was up; once the new scale
  // paints, scroll so the same document point lands at the finger midpoint.
  const applyPinchCommit = useCallback(() => {
    const commit = pinchCommitRef.current
    const inner = stageInnerRef.current
    const scroller = scrollRef.current
    pinchCommitRef.current = null
    if (!commit || !inner || !scroller) return
    inner.style.transform = ""
    const rect = inner.getBoundingClientRect()
    scroller.scrollLeft += rect.left + commit.m.x * commit.scale - commit.target.x
    scroller.scrollTop += rect.top + commit.m.y * commit.scale - commit.target.y
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
        renderTask = renderPdfPageToCanvas({
          page,
          canvas,
          scale: effective,
          // 3x DPR turns a page into a ~30MP bitmap; 2x is the point of
          // diminishing returns for reading.
          pixelRatio:
            typeof window === "undefined"
              ? 1
              : Math.min(2, Math.max(1, window.devicePixelRatio || 1)),
        })
        await renderTask.promise
        if (cancelled) return
        // A pinch that committed during this render resolves its scroll
        // position against the freshly sized page.
        applyPinchCommit()
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
        if (cancelled) return
        const needle = activeQueryRef.current
        if (needle) {
          highlightTextLayer(container, needle)
          if (pendingHitScrollRef.current) {
            pendingHitScrollRef.current = false
            container
              .querySelector(`[${PDF_SEARCH_HIT_ATTR}]`)
              ?.scrollIntoView({ block: "center" })
          }
        }
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
  }, [applyPinchCommit, pageIndex, pdf, reportError, zoom, fitTick])

  // A page change invalidates an uncommitted pinch — declared before the
  // gesture reset so the commit is already gone when that cleanup runs and
  // the stale transform gets cleared with it.
  useEffect(() => {
    return () => {
      pinchCommitRef.current = null
    }
  }, [pageIndex])

  // A page change mid-gesture leaves the transform/pointers pointing at a
  // page that is gone — reset both. Zoom is a dependency too so a button or
  // keyboard zoom clears a live transform, but the pinch *commit* survives:
  // a pinch's own setZoom is what re-renders, and the draw effect consumes
  // the commit to re-center.
  useEffect(() => {
    return () => clearGesture()
  }, [clearGesture, pageIndex, zoom])

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

  const onStagePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") return
    event.currentTarget.setPointerCapture(event.pointerId)
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values())
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const rect = stageInnerRef.current?.getBoundingClientRect()
      pinchRef.current = {
        startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startMid: mid,
        m: rect ? { x: mid.x - rect.left, y: mid.y - rect.top } : { x: 0, y: 0 },
        baseZoom: zoomRef.current > 0 ? zoomRef.current : fittedRef.current,
        lastScale: 1,
        lastMid: mid,
      }
      panRef.current = null
      return
    }
    if (pointersRef.current.size === 1) {
      panRef.current = { x: event.clientX, y: event.clientY, moved: false }
    }
  }, [])

  const onStagePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const point = pointersRef.current.get(event.pointerId)
    if (!point) return
    point.x = event.clientX
    point.y = event.clientY
    const pinch = pinchRef.current
    const inner = stageInnerRef.current
    if (pinch && inner && pointersRef.current.size >= 2) {
      const [a, b] = Array.from(pointersRef.current.values())
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      // Live scale is clamped to the zoom range with slight overshoot so the
      // gesture feels responsive at the edges without overshooting on commit.
      const scale = Math.min(
        (PDF_MAX_ZOOM * 1.05) / pinch.baseZoom,
        Math.max((PDF_MIN_ZOOM * 0.9) / pinch.baseZoom, dist / pinch.startDist)
      )
      pinch.lastScale = scale
      pinch.lastMid = mid
      const dx = mid.x - pinch.startMid.x
      const dy = mid.y - pinch.startMid.y
      const m = pinch.m
      // Scale around the pinch midpoint and let the fingers drag it — the
      // old render stays put until the commit re-renders at the final zoom.
      inner.style.transform = `translate3d(${m.x * (1 - scale) + dx}px, ${m.y * (1 - scale) + dy}px, 0) scale(${scale})`
      return
    }
    const pan = panRef.current
    const scroller = scrollRef.current
    if (pan && scroller && pointersRef.current.size === 1) {
      const dx = event.clientX - pan.x
      const dy = event.clientY - pan.y
      if (!pan.moved && Math.hypot(dx, dy) < TOUCH_PAN_SLOP_PX) return
      pan.moved = true
      pan.x = event.clientX
      pan.y = event.clientY
      scroller.scrollLeft -= dx
      scroller.scrollTop -= dy
    }
  }, [])

  const onStagePointerEnd = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      pointersRef.current.delete(event.pointerId)
      const pinch = pinchRef.current
      if (pinch && pointersRef.current.size < 2) {
        pinchRef.current = null
        const finalZoom = clampZoom(pinch.baseZoom * pinch.lastScale)
        const rendered = zoomRef.current > 0 ? zoomRef.current : fittedRef.current
        pinchCommitRef.current = {
          scale: finalZoom / pinch.baseZoom,
          m: pinch.m,
          target: pinch.lastMid,
        }
        if (Math.abs(finalZoom - rendered) < 0.001) {
          // No re-render is coming — settle the scroll position now.
          applyPinchCommit()
        } else {
          setZoom(finalZoom)
        }
      }
      // A remaining finger can keep panning after the other lifts.
      const remaining = Array.from(pointersRef.current.values())[0]
      panRef.current = remaining ? { ...remaining, moved: true } : null
    },
    [applyPinchCommit]
  )

  const effectiveZoom = zoom > 0 ? zoom : fitted
  const hitCount = activeHits?.length ?? 0

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <p className="max-w-[10rem] truncate text-xs text-muted-foreground sm:max-w-none">
          {source.pdfFileName ?? "Document"}
        </p>
        {searchOpen ? (
          <div className="flex items-center gap-1">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search document"
                aria-label="Search document"
                className="h-8 w-40 pl-7 text-xs sm:w-52"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    stepHit(event.shiftKey ? -1 : 1)
                  }
                  if (event.key === "Escape") {
                    event.preventDefault()
                    setQuery("")
                    setSearchOpen(false)
                    event.currentTarget.blur()
                  }
                }}
              />
            </div>
            <span className="min-w-[4.5ch] text-center font-mono text-xs text-muted-foreground" aria-live="polite">
              {searching ? "…" : activeHits ? (hitCount === 0 ? "0" : `${hitIndex + 1}/${hitCount}`) : ""}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Previous match"
              disabled={hitCount === 0}
              onClick={() => stepHit(-1)}
              data-book-preview-press
            >
              <ChevronUpIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Next match"
              disabled={hitCount === 0}
              onClick={() => stepHit(1)}
              data-book-preview-press
            >
              <ChevronDownIcon />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close search"
              onClick={() => {
                setQuery("")
                setSearchOpen(false)
              }}
              data-book-preview-press
            >
              <XIcon />
            </Button>
          </div>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Search document"
            aria-keyshortcuts="/ Control+F"
            onClick={openSearch}
            data-book-preview-press
            className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
          >
            <SearchIcon />
          </Button>
        )}
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
        {pdf && docHasMultiplePages(pdf) ? (
          <Button
            type="button"
            variant={thumbsOpen ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label="Page thumbnails"
            aria-pressed={thumbsOpen}
            onClick={() => setThumbsOpen((open) => !open)}
            data-book-preview-press
            className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
          >
            <PanelLeftIcon />
          </Button>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/30">
        <PdfThumbRail
          doc={pdf}
          pageIndex={pageIndex}
          open={thumbsOpen}
          onSelect={(index) => reportPageChange(index, "instant")}
        />
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 overflow-auto p-4"
          onDoubleClick={() => {
            // A double-click that selected a word is a selection gesture,
            // not a zoom request — the text layer stays in charge.
            if (typeof window !== "undefined" && window.getSelection()?.toString()) return
            setZoom((current) =>
              current === PDF_FIT_ZOOM ? clampZoom(fittedRef.current * 1.75) : PDF_FIT_ZOOM
            )
          }}
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
               precisely on top. touch-action:none hands touch panning and
               pinch to the pointer handlers above. */
            <div
              ref={stageInnerRef}
              className="relative m-auto shrink-0"
              // Origin 0 0 makes the live pinch transform an exact
              // scale-around-midpoint; the default center origin would drift.
              style={{ touchAction: "none", transformOrigin: "0 0" }}
              onPointerDown={onStagePointerDown}
              onPointerMove={onStagePointerMove}
              onPointerUp={onStagePointerEnd}
              onPointerCancel={onStagePointerEnd}
            >
              <canvas
                ref={canvasRef}
                role="img"
                aria-label={`Page ${pageIndex + 1}`}
                className="block rounded bg-background shadow"
              />
              <div ref={textLayerRef} className="textLayer" data-book-preview-text-layer />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function docHasMultiplePages(doc: PdfDocumentProxy): boolean {
  return doc.numPages > 1
}
