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
  FileUpIcon,
  HandIcon,
  PanelLeftIcon,
  RotateCwIcon,
  SearchIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { DEFAULT_CAPABILITIES } from "../capabilities"
import {
  BOOK_PREVIEW_BOUNDARY_RESISTANCE,
  BOOK_PREVIEW_COMMIT_RATIO,
  BOOK_PREVIEW_EASE_OUT,
  BOOK_PREVIEW_MOMENTUM_MS,
  BOOK_PREVIEW_SETTLE_MS,
  BOOK_PREVIEW_VELOCITY_COMMIT,
} from "../motion"
import { usePageArrival } from "../hooks/use-page-arrival"
import { useStableHandler } from "../hooks/use-stable-handler"
import { createPortal } from "react-dom"
import { useBookPreview } from "../book-preview-provider"
import { useNarrowLayout } from "../media"
import { readBookPreviewPrefs, writeBookPreviewPrefs } from "../prefs"
import {
  loadPdfDocument,
  renderPdfPageToCanvas,
  renderPdfTextLayer,
  resolvePdfOutline,
  resolvePdfPageLinks,
  type PdfDocumentProxy,
  type PdfLoadingTask,
  type PdfPageLink,
} from "../pdf-runtime"
import type { BookPreviewCapabilities, BookPreviewEngineProps, NormalizedBookSource } from "../types"
import {
  createPdfSearchIndex,
  highlightTextLayer,
  PDF_SEARCH_HIT_ATTR,
  type PdfSearchHit,
} from "./pdf-search"
import { PdfPasswordGate } from "./pdf-password-gate"
import { PdfThumbRail, PdfThumbSheet } from "./pdf-thumb-rail"

// A zoom of 0 is the fit-width sentinel: the real scale is derived per page
// from the live scroller width, so phones and mixed-orientation documents
// open readable instead of pre-panned. -1 is fit-page (whole page visible).
const PDF_FIT_ZOOM = 0
const PDF_FIT_PAGE = -1
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
  reducedMotion,
  navigationBehavior,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const stageInnerRef = useRef<HTMLDivElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const docTaskRef = useRef<PdfLoadingTask | null>(null)
  const [pdf, setPdf] = useState<PdfDocumentProxy | null>(null)
  const [zoom, setZoom] = useState(PDF_FIT_ZOOM)
  const [rotation, setRotation] = useState(0)
  // Links are keyed to the render that produced them — a stale rect never
  // overlays a re-rendered page.
  const [links, setLinks] = useState<{ key: string; items: PdfPageLink[] } | null>(null)
  const [fitted, setFitted] = useState(1)
  const [fitTick, setFitTick] = useState(0)
  const fittedRef = useRef(1)
  // Both fit scales are kept: toggling between fit-width and fit-page needs
  // the target's scale, not the current mode's.
  const fitScalesRef = useRef({ width: 1, page: 1 })
  // A link overlay only renders for the exact render that produced it —
  // stale rects must never sit over a re-rendered page.
  const linkKey = `${pageIndex}:${rotation}:${zoom}:${fitTick}`
  const zoomRef = useRef(PDF_FIT_ZOOM)
  const zoomHydratedRef = useRef(false)
  const pageIndexRef = useRef(pageIndex)
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)
  const reportPageChange = useStableHandler(onPageChange)
  const { engineShortcutsRef, uploadPdf, chromeHost } = useBookPreview()
  const narrow = useNarrowLayout()

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<PdfSearchHit[] | null>(null)
  const [hitIndex, setHitIndex] = useState(0)
  const [searching, setSearching] = useState(false)
  const [thumbsOpen, setThumbsOpen] = useState(false)
  // Hand tool: when on, a mouse drag pans the page like Acrobat's hand —
  // manual viewing without giving up text selection the rest of the time.
  const [grabMode, setGrabMode] = useState(false)
  // The incoming page drifts in from the direction it was pushed toward —
  // the same arrival the page engine uses, routed through `translate` in CSS
  // so it never fights the pinch transform.
  const arrival = usePageArrival(
    pageIndex,
    reducedMotion || navigationBehavior === "instant"
  )
  const [passwordRequest, setPasswordRequest] = useState<{ incorrect: boolean } | null>(null)
  const passwordSubmitRef = useRef<((password: string) => void) | null>(null)
  const passwordCancelledRef = useRef(false)
  const activeQueryRef = useRef("")
  const pendingHitScrollRef = useRef(false)

  // Touch pan/pinch state. Pointer Events are the only portable way to drive
  // pinch on a scroll container: browsers claim two-finger gestures before a
  // site sees them, so the stage takes touch-action:none and pans manually.
  const pointersRef = useRef(new Map<number, { x: number; y: number }>())
  const panRef = useRef<{
    /** Gesture origin, for the swipe-to-turn commit decision. */
    startX: number
    startY: number
    x: number
    y: number
    moved: boolean
    /** A page that already fits horizontally converts a horizontal drag into
        a page turn instead of a pan — the Apple Books swipe. Mouse pans are
        always scroll pans; turning stays on buttons/keys/wheel there. */
    swiping: boolean
    mouse: boolean
    lastX: number
    lastT: number
    velocity: number
  } | null>(null)
  // Timer for the slide-out settle before a swipe commits its page turn.
  const swipeTimerRef = useRef<number | null>(null)
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
    if (swipeTimerRef.current !== null) {
      window.clearTimeout(swipeTimerRef.current)
      swipeTimerRef.current = null
    }
    // A pending pinch commit needs its transform left in place — it is what
    // keeps the pinch point glued under the fingers until the re-rendered
    // page paints and applyPinchCommit takes over.
    const inner = stageInnerRef.current
    if (inner) {
      if (!pinchCommitRef.current) inner.style.transform = ""
      inner.style.translate = ""
      inner.style.transition = ""
    }
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
            // No document yet — a "No pages" pager is noise next to the
            // upload prompt.
            pagination: false,
            upload: true,
            zoom: true,
            appearance: false,
            sound: false,
          },
        })
        return
      }
      try {
        passwordCancelledRef.current = false
        const loaded = await loadPdfDocument(source.pdfUrl, {
          // Track the task from creation so a document parked on the password
          // prompt is still destroyable on teardown or cancel.
          onTask: (task) => {
            docTaskRef.current = task
          },
          onPassword: (request) => {
            if (cancelled) return
            passwordSubmitRef.current = request.submit
            setPasswordRequest({ incorrect: request.incorrect })
            // A zero-page ready unblocks the viewport so the gate is visible;
            // pagination hides the meaningless "No pages" chrome until the
            // document actually opens. The real ready report replaces it.
            reportReady({
              totalPages: 0,
              capabilities: { ...engineCapabilities(source), pagination: false },
            })
          },
        })
        if (cancelled) {
          await loaded.task.destroy()
          return
        }
        docTaskRef.current = loaded.task
        doc = loaded.doc
        passwordSubmitRef.current = null
        setPasswordRequest(null)
        setPdf(doc)
        // A new document always opens at fit-width unless the reader has a
        // remembered zoom preference (fit-width, fit-page, or a fixed zoom).
        if (persistPreferences) {
          const stored = readBookPreviewPrefs().pdfZoom
          const valid =
            typeof stored === "number" &&
            Number.isFinite(stored) &&
            stored >= PDF_FIT_PAGE &&
            stored <= PDF_MAX_ZOOM
          setZoom(valid ? (stored > 0 ? clampZoom(stored) : stored) : PDF_FIT_ZOOM)
        } else {
          setZoom(PDF_FIT_ZOOM)
        }
        setRotation(0)
        zoomHydratedRef.current = true
        reportReady({
          totalPages: doc.numPages,
          capabilities: engineCapabilities(source),
        })
      } catch {
        if (!cancelled) {
          reportError({
            kind: "pdf-parse",
            message: passwordCancelledRef.current
              ? "This PDF is password-protected. Retry to enter its password."
              : "This PDF could not be opened.",
          })
        }
      }
    }

    void open()
    return () => {
      cancelled = true
      passwordSubmitRef.current = null
      setPasswordRequest(null)
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
    setGrabMode(false)
    setThumbsOpen(false)
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

  const submitPassword = useCallback((password: string) => {
    passwordSubmitRef.current?.(password)
  }, [])

  const cancelPassword = useCallback(() => {
    passwordCancelledRef.current = true
    passwordSubmitRef.current = null
    setPasswordRequest(null)
    // Rejecting the pending task surfaces the "password required" error with
    // a retry path instead of leaving the reader on a dead prompt.
    void docTaskRef.current?.destroy().catch(() => {})
    docTaskRef.current = null
  }, [])

  // Focus follows the open state rather than a microtask, which has no
  // ordering guarantee against the render that mounts the input.
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  // In a fit mode a container resize is a zoom change.
  useEffect(() => {
    const node = scrollRef.current
    if (!node || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      if (zoomRef.current <= 0) setFitTick((tick) => tick + 1)
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
  // `dismiss` answers Escape: it closes this reader's own overlays before the
  // shell falls back to exiting immersive mode.
  useEffect(() => {
    const ref = engineShortcutsRef
    ref.current = {
      zoomIn: () =>
        setZoom(clampZoom((zoomRef.current > 0 ? zoomRef.current : fittedRef.current) + 0.25)),
      zoomOut: () =>
        setZoom(clampZoom((zoomRef.current > 0 ? zoomRef.current : fittedRef.current) - 0.25)),
      zoomReset: () => setZoom(PDF_FIT_ZOOM),
      search: openSearch,
      dismiss: () => {
        if (searchOpen) {
          setQuery("")
          setSearchOpen(false)
          return true
        }
        if (thumbsOpen) {
          setThumbsOpen(false)
          return true
        }
        return false
      },
    }
    return () => {
      ref.current = {}
    }
  }, [engineShortcutsRef, openSearch, searchOpen, thumbsOpen])

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
        // The fit scale uses this page's own (rotated) base size, so a
        // landscape figure inside a portrait document still reads edge to edge.
        const base = page.getViewport({ scale: 1, rotation })
        const hostWidth = Math.max(
          240,
          (scrollRef.current?.clientWidth ?? base.width) - PDF_STAGE_PAD
        )
        const hostHeight = Math.max(
          240,
          (scrollRef.current?.clientHeight ?? base.height) - PDF_STAGE_PAD
        )
        const fitWidth = Math.min(3, Math.max(0.4, hostWidth / base.width))
        const fitPage = Math.min(3, Math.max(0.4, hostHeight / base.height))
        fitScalesRef.current = { width: fitWidth, page: fitPage }
        const fit = zoom === PDF_FIT_PAGE ? fitPage : fitWidth
        fittedRef.current = fit
        setFitted(fit)
        const effective = zoom > 0 ? zoom : fit
        renderTask = renderPdfPageToCanvas({
          page,
          canvas,
          scale: effective,
          rotation,
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
        textLayer = await renderPdfTextLayer({ page, container, scale: effective, rotation })
        if (cancelled) return
        // In-document links (TOC entries, citations, urls) become real click
        // targets over the text layer — internal ones turn pages, external
        // ones open in a new tab.
        const pageLinks = await resolvePdfPageLinks({
          page,
          doc: documentProxy,
          scale: effective,
          rotation,
        })
        if (!cancelled) setLinks({ key: linkKey, items: pageLinks })
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
  }, [applyPinchCommit, linkKey, pageIndex, pdf, reportError, rotation, zoom, fitTick])

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
  // the document instead of scrolling. A horizontal trackpad swipe on a page
  // that already fits turns it — and suppressing the default there also stops
  // the browser's overscroll history navigation. Needs a non-passive listener.
  const wheelAccumRef = useRef(0)
  const wheelLastRef = useRef(0)
  const wheelLockRef = useRef(0)
  useEffect(() => {
    const node = scrollRef.current
    if (!node) return
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault()
        const current = zoomRef.current > 0 ? zoomRef.current : fittedRef.current
        setZoom(clampZoom(current - Math.sign(event.deltaY) * 0.15))
        return
      }
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return
      if (node.scrollWidth - node.clientWidth > 2) return
      event.preventDefault()
      const now = performance.now()
      if (now - wheelLastRef.current > 250) wheelAccumRef.current = 0
      wheelLastRef.current = now
      if (now < wheelLockRef.current) return
      wheelAccumRef.current += event.deltaX
      if (Math.abs(wheelAccumRef.current) < 60) return
      const direction = wheelAccumRef.current > 0 ? 1 : -1
      const target = pageIndexRef.current + direction
      wheelAccumRef.current = 0
      wheelLockRef.current = now + 450
      if (target < 0 || target >= (pdf?.numPages ?? 0)) return
      reportPageChange(target, "instant")
    }
    node.addEventListener("wheel", onWheel, { passive: false })
    return () => node.removeEventListener("wheel", onWheel)
  }, [pdf, reportPageChange])

  const onStagePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      // Touch and pen always drive pan/pinch. The mouse keeps drag-to-select
      // unless the hand tool is on — and a middle-button drag always pans,
      // like Acrobat's grab.
      const mouse = event.pointerType === "mouse"
      if (mouse && !grabMode && event.button !== 1) return
      if (mouse && event.button !== 0 && event.button !== 1) return
      // Stops text selection for the hand tool and autoscroll for middle-drag.
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (!mouse && pointersRef.current.size === 2) {
        // A second finger converts the gesture to a pinch — cancel any swipe
        // in flight or its translate would stack on top of the pinch transform.
        const inner = stageInnerRef.current
        if (inner && panRef.current?.swiping) {
          inner.style.translate = ""
          inner.style.transition = ""
        }
        const [a, b] = Array.from(pointersRef.current.values())
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
        const rect = inner?.getBoundingClientRect()
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
        panRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          x: event.clientX,
          y: event.clientY,
          moved: false,
          swiping: false,
          mouse,
          lastX: event.clientX,
          lastT: event.timeStamp,
          velocity: 0,
        }
      }
    },
    [grabMode]
  )

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
      const totalDx = event.clientX - pan.startX
      const totalDy = event.clientY - pan.startY
      if (!pan.moved) {
        if (Math.hypot(totalDx, totalDy) < TOUCH_PAN_SLOP_PX) return
        pan.moved = true
        // The direction is locked at the intent moment: when the page already
        // fits horizontally, a dominant horizontal drag becomes a page-turn
        // swipe; otherwise the finger pans the scroller.
        pan.swiping =
          !pan.mouse &&
          scroller.scrollWidth - scroller.clientWidth <= 2 &&
          Math.abs(totalDx) > Math.abs(totalDy)
        if (pan.swiping && inner) inner.style.transition = "none"
      }
      if (pan.swiping && inner) {
        // Once the gesture owns the pointer, block a long-press selection
        // from starting underneath it.
        event.preventDefault()
        const width = scroller.clientWidth
        const atEdge =
          (totalDx > 0 && pageIndexRef.current <= 0) ||
          (totalDx < 0 && pageIndexRef.current >= (pdf?.numPages ?? 1) - 1)
        const offset = atEdge
          ? Math.max(
              -width * 0.4 * BOOK_PREVIEW_BOUNDARY_RESISTANCE,
              Math.min(width * 0.4 * BOOK_PREVIEW_BOUNDARY_RESISTANCE, totalDx * BOOK_PREVIEW_BOUNDARY_RESISTANCE)
            )
          : totalDx
        // `translate` (not `transform`) so the page-arrival CSS and the pinch
        // transform never fight over the same property.
        inner.style.translate = `${offset}px 0px`
        const dt = Math.max(1, event.timeStamp - pan.lastT)
        pan.velocity = pan.velocity * 0.55 + ((event.clientX - pan.lastX) / dt) * 0.45
        pan.lastX = event.clientX
        pan.lastT = event.timeStamp
        return
      }
      const dx = event.clientX - pan.x
      const dy = event.clientY - pan.y
      event.preventDefault()
      pan.x = event.clientX
      pan.y = event.clientY
      scroller.scrollLeft -= dx
      scroller.scrollTop -= dy
    }
  }, [pdf])

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
      // A swipe release either commits the turn (page slides out, then the
      // change dispatches and the gesture reset clears the inline styles) or
      // springs the page back to center.
      const pan = panRef.current
      const inner = stageInnerRef.current
      const scroller = scrollRef.current
      if (pan?.swiping && inner && scroller) {
        // A cancelled gesture (browser took it back) springs home — it must
        // never complete a turn the user did not release into.
        const cancelledGesture = event.type === "pointercancel"
        const totalDx = event.clientX - pan.startX
        const width = Math.max(1, scroller.clientWidth)
        const numPages = pdf?.numPages ?? 1
        const canPrev = pageIndexRef.current > 0
        const canNext = pageIndexRef.current < numPages - 1
        const projected = totalDx + pan.velocity * BOOK_PREVIEW_MOMENTUM_MS
        const goNext =
          canNext &&
          (projected < -width * BOOK_PREVIEW_COMMIT_RATIO ||
            pan.velocity < -BOOK_PREVIEW_VELOCITY_COMMIT)
        const goPrev =
          canPrev &&
          (projected > width * BOOK_PREVIEW_COMMIT_RATIO ||
            pan.velocity > BOOK_PREVIEW_VELOCITY_COMMIT)
        const direction = cancelledGesture ? 0 : goNext ? 1 : goPrev ? -1 : 0
        if (direction !== 0 && reducedMotion) {
          inner.style.translate = ""
          inner.style.transition = ""
          reportPageChange(pageIndexRef.current + direction, "instant")
        } else if (direction !== 0) {
          inner.style.transition = `translate ${BOOK_PREVIEW_SETTLE_MS}ms ${BOOK_PREVIEW_EASE_OUT}`
          inner.style.translate = `${direction * -width}px 0px`
          if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current)
          swipeTimerRef.current = window.setTimeout(() => {
            swipeTimerRef.current = null
            reportPageChange(pageIndexRef.current + direction, "instant")
          }, BOOK_PREVIEW_SETTLE_MS)
        } else {
          inner.style.transition = `translate ${BOOK_PREVIEW_SETTLE_MS}ms ${BOOK_PREVIEW_EASE_OUT}`
          inner.style.translate = "0px 0px"
          if (swipeTimerRef.current !== null) window.clearTimeout(swipeTimerRef.current)
          swipeTimerRef.current = window.setTimeout(() => {
            swipeTimerRef.current = null
            inner.style.translate = ""
            inner.style.transition = ""
          }, BOOK_PREVIEW_SETTLE_MS + 30)
        }
        panRef.current = null
        return
      }
      // A remaining finger can keep panning after the other lifts — restart
      // its origin at the finger's own position so the swipe decision and
      // velocity don't inherit the lifted finger's travel.
      const remaining = Array.from(pointersRef.current.values())[0]
      panRef.current = remaining
        ? {
            startX: remaining.x,
            startY: remaining.y,
            x: remaining.x,
            y: remaining.y,
            moved: true,
            swiping: false,
            mouse: false,
            lastX: remaining.x,
            lastT: event.timeStamp,
            velocity: 0,
          }
        : null
    },
    [applyPinchCommit, pdf, reducedMotion, reportPageChange]
  )

  const effectiveZoom = zoom > 0 ? zoom : fitted
  const hitCount = activeHits?.length ?? 0

  // Double-click zooms around the clicked point, reusing the pinch commit
  // path: record where the point sits in the current layout, re-render, then
  // scroll it back under the cursor.
  const onStageDoubleClick = (event: {
    clientX: number
    clientY: number
    target: EventTarget | null
  }) => {
    // A double-click that selected a word is a selection gesture, not a zoom
    // request — the text layer stays in charge. Links and controls keep their
    // own double-click meaning too.
    if (typeof window !== "undefined" && window.getSelection()?.toString()) return
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(
        "[data-book-preview-link], button, a, input, select, textarea"
      )
    ) {
      return
    }
    const inner = stageInnerRef.current
    const scroller = scrollRef.current
    if (!inner || !scroller || !pdf) return
    const nextZoom = zoom <= 0 ? clampZoom(effectiveZoom * 1.75) : PDF_FIT_ZOOM
    const nextEffective =
      nextZoom > 0
        ? nextZoom
        : nextZoom === PDF_FIT_PAGE
          ? fitScalesRef.current.page
          : fitScalesRef.current.width
    const rect = inner.getBoundingClientRect()
    pinchCommitRef.current = {
      scale: nextEffective / effectiveZoom,
      m: { x: event.clientX - rect.left, y: event.clientY - rect.top },
      target: { x: event.clientX, y: event.clientY },
    }
    if (Math.abs(nextEffective - effectiveZoom) < 0.001) {
      applyPinchCommit()
    } else {
      setZoom(nextZoom)
    }
  }

  const controls = (
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
            disabled={!pdf}
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
        <span className="min-w-[5.5ch] text-center font-mono text-xs text-muted-foreground">
          {zoom === PDF_FIT_ZOOM
            ? `Fit ${Math.round(effectiveZoom * 100)}%`
            : zoom === PDF_FIT_PAGE
              ? `Page ${Math.round(effectiveZoom * 100)}%`
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
          variant={zoom <= 0 ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={zoom <= 0}
          aria-label={
            zoom === PDF_FIT_PAGE ? "Fit entire page" : "Fit page width"
          }
          title="Cycle fit width / fit page"
          onClick={() =>
            setZoom(zoom === PDF_FIT_ZOOM ? PDF_FIT_PAGE : PDF_FIT_ZOOM)
          }
          data-book-preview-press
        >
          {zoom === PDF_FIT_PAGE ? "Page" : "Fit"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Rotate clockwise"
          disabled={!pdf}
          onClick={() => setRotation((current) => (current + 90) % 360)}
          data-book-preview-press
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
        >
          <RotateCwIcon />
        </Button>
        <Button
          type="button"
          variant={grabMode ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label="Hand tool — drag to pan the page"
          aria-pressed={grabMode}
          disabled={!pdf}
          title="Hand tool — drag the page to move it"
          onClick={() => setGrabMode((on) => !on)}
          data-book-preview-press
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
        >
          <HandIcon />
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
  )

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      {chromeHost ? createPortal(controls, chromeHost) : controls}
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-lg border bg-muted/30">
        {narrow ? (
          <PdfThumbSheet
            doc={pdf}
            pageIndex={pageIndex}
            open={thumbsOpen}
            onOpenChange={setThumbsOpen}
            onSelect={(index) => reportPageChange(index, "instant")}
          />
        ) : (
          <PdfThumbRail
            doc={pdf}
            pageIndex={pageIndex}
            open={thumbsOpen}
            onSelect={(index) => reportPageChange(index, "instant")}
          />
        )}
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 overflow-auto p-4"
          onDoubleClick={onStageDoubleClick}
        >
          {!pdf ? (
            passwordRequest ? (
              <div className="m-auto">
                <PdfPasswordGate
                  fileName={source.pdfFileName}
                  incorrect={passwordRequest.incorrect}
                  onSubmit={submitPassword}
                  onCancel={cancelPassword}
                />
              </div>
            ) : source.pdfUrl ? (
              <div className="m-auto flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Opening PDF…
              </div>
            ) : source.allowPdfUpload ? (
              <div className="m-auto flex flex-col items-center gap-3 text-center">
                <FileUpIcon className="size-8 text-muted-foreground/60" />
                <p className="max-w-52 text-sm text-muted-foreground">
                  Upload or drop a PDF to begin
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-book-preview-press
                >
                  Choose file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  aria-label="Upload PDF"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) uploadPdf(file)
                    event.target.value = ""
                  }}
                />
              </div>
            ) : (
              <div className="m-auto flex items-center gap-2 text-sm text-muted-foreground">
                Waiting for a document
              </div>
            )
          ) : (
            /* Auto margins center a page that fits and let a zoomed page scroll
               to every edge — justify-center would clip the start side. The
               canvas keeps its exact rendered size so the text layer can sit
               precisely on top. touch-action:none hands touch panning and
               pinch to the pointer handlers above. */
            <div
              ref={stageInnerRef}
              data-book-preview-pdf-stage
              {...arrival}
              className={
                grabMode
                  ? "relative m-auto shrink-0 cursor-grab active:cursor-grabbing"
                  : "relative m-auto shrink-0"
              }
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
              {links && links.key === linkKey && links.items.length > 0 ? (
                <div
                  data-book-preview-links
                  className="pointer-events-none absolute inset-0 z-20"
                >
                  {links.items.map((link, index) => {
                    const target = link.target
                    return target.kind === "page" ? (
                      <button
                        key={index}
                        type="button"
                        className="absolute cursor-pointer rounded-sm"
                        style={{
                          left: link.left,
                          top: link.top,
                          width: link.width,
                          height: link.height,
                        }}
                        aria-label={`Go to page ${target.pageIndex + 1}`}
                        title={`Go to page ${target.pageIndex + 1}`}
                        data-book-preview-link
                        data-book-preview-press
                        onClick={() => reportPageChange(target.pageIndex, "instant")}
                      />
                    ) : (
                      <a
                        key={index}
                        className="absolute cursor-pointer rounded-sm"
                        style={{
                          left: link.left,
                          top: link.top,
                          width: link.width,
                          height: link.height,
                        }}
                        href={target.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Open link: ${target.url}`}
                        title={target.url}
                        data-book-preview-link
                      />
                    )
                  })}
                </div>
              ) : null}
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
