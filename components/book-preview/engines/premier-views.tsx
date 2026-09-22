'use client'

import { spreadSlots, spreadStep } from './premier-math'
import { usePageArrival } from '../hooks/use-page-arrival'
import type { BookPreviewNavigationBehavior } from '../types'
import { useStableHandler } from '../hooks/use-stable-handler'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { FALLBACK_ASPECT, type PremierFace } from './premier-faces'
import {
  renderPdfTextLayer,
  resolvePdfPageLinks,
  type PdfDocumentProxy,
  type PdfPageLink,
} from '../pdf-runtime'

/**
 * The premier reader's flat views — one page, a two-page spread, a continuous
 * strip, and a plain-text flow — all drawn from the same face list the flip
 * book uses. Page-data sources hand over React leaves; PDF sources hand over
 * raster sheets that fill in (and release) around the reading position, with
 * a live text/link overlay so the copy underneath is still selectable.
 */

/**
 * The selectable layer a flat-view PDF face wears: pdf.js's real text layer
 * plus resolved link annotations, positioned over the raster at the face's
 * measured display scale. Work only happens while the face is near the
 * viewport, so a long scroll never builds hundreds of span layers at once —
 * and a ResizeObserver re-renders on zoom so the overlay never drifts.
 */
function PdfFaceOverlay({
  doc,
  pageNumber,
  hasRaster,
  zoom,
  onNavigate,
}: {
  doc: PdfDocumentProxy
  pageNumber: number
  /** The text layer over an unrendered skeleton would float over blank
      paper — wait for the bitmap. */
  hasRaster: boolean
  /** The view's CSS zoom — clientWidth already includes it, so the layer
      renders at the unzoomed scale and the ancestor's zoom carries it. */
  zoom: number
  onNavigate: (index: number, behavior?: BookPreviewNavigationBehavior) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  // No IntersectionObserver → treat every face as near and let the paint
  // effect do the work. Not rendered into markup, so hydration is safe.
  const [near, setNear] = useState(
    () => typeof IntersectionObserver === 'undefined',
  )
  const [links, setLinks] = useState<PdfPageLink[]>([])
  const reportNavigate = useStableHandler(onNavigate)

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof IntersectionObserver === 'undefined') return
    // Generous margin: spans exist a little before the face scrolls in, and
    // disappear a little after it leaves — fast scrolling never sees a gap.
    const observer = new IntersectionObserver(
      ([entry]) => setNear(entry.isIntersecting),
      { rootMargin: '120%' },
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host || !near || !hasRaster) return
    let cancelled = false
    let layer: { cancel: () => void } | null = null
    let timer = 0

    const paint = async () => {
      try {
        const page = await doc.getPage(pageNumber)
        if (cancelled) return
        const base = page.getViewport({ scale: 1 })
        const scale = host.clientWidth / (zoom * Math.max(1, base.width))
        if (!Number.isFinite(scale) || scale <= 0) return
        host.replaceChildren()
        host.style.setProperty('--total-scale-factor', String(scale))
        const rendered = await renderPdfTextLayer({
          page,
          container: host,
          scale,
        })
        if (cancelled) {
          rendered.cancel()
          return
        }
        layer = rendered
        const pageLinks = await resolvePdfPageLinks({ page, doc, scale })
        if (!cancelled) setLinks(pageLinks)
      } catch {
        // A page that cannot yield a layer reads as image-only — fine.
      }
    }

    void paint()
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => void paint(), 160)
    })
    observer.observe(host)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      observer.disconnect()
      layer?.cancel()
      host.replaceChildren()
      setLinks([])
    }
  }, [doc, hasRaster, near, pageNumber, zoom])

  return (
    <>
      <div ref={hostRef} className="textLayer" data-book-preview-text-layer />
      {links.length > 0 ? (
        <div
          data-book-preview-links
          className="pointer-events-none absolute inset-0 z-20"
        >
          {links.map((link) => {
            const target = link.target
            const linkKey = `${link.left},${link.top},${link.width}x${link.height}`
            return target.kind === 'page' ? (
              <button
                key={linkKey}
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
                onClick={() => reportNavigate(target.pageIndex, 'instant')}
              />
            ) : (
              <a
                key={linkKey}
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
    </>
  )
}

/** The height that fits a box of `aspect` (width / height) inside the
    nearest size container on both axes. */
function fitHeight(aspect: number): string {
  return `min(100cqh, calc(100cqw / ${Math.max(aspect, 0.05)}))`
}

/** A face sized by its own aspect — height-bounded so it never outgrows the
    stage, width-bounded so a tall page never overflows narrow screens. */
function FaceBox({
  face,
  className,
  arrival,
  children,
}: {
  face: PremierFace
  className?: string
  arrival?: Record<string, unknown>
  children?: ReactNode
}) {
  return (
    <div
      {...arrival}
      className={
        'bg-card relative h-full max-w-full shrink-0 overflow-hidden rounded-md border shadow-sm ' +
        (className ?? '')
      }
      style={{ aspectRatio: `${face.aspect ?? FALLBACK_ASPECT}` }}
    >
      {face.content}
      {children}
    </div>
  )
}

/** Two-finger pinch scales the face and keeps the document point under the
    midpoint anchored — the same contract the pdf engine's pinch uses. The
    zoom style is written directly during the gesture (no React churn per
    move) and committed to state once the fingers lift. */
function usePinchZoom({
  hostRef,
  zoomTargetRef,
  scrollerRef,
  zoom,
  onZoom,
}: {
  hostRef: React.RefObject<HTMLElement | null>
  /** The element carrying the CSS zoom — measured with rects so the anchor
      math is independent of how browsers report zoomed scroll offsets. */
  zoomTargetRef: React.RefObject<HTMLElement | null>
  scrollerRef: React.RefObject<HTMLElement | null>
  zoom: number
  onZoom: (zoom: number) => void
}) {
  const report = useStableHandler(onZoom)
  const zoomRef = useRef(zoom)
  useEffect(() => {
    zoomRef.current = zoom
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const pts = new Map<number, { x: number; y: number }>()
    let pinching = false
    let startDist = 0
    let baseZoom = 1
    let applied = 1

    const dist = () => {
      const [p, q] = [...pts.values()]
      return Math.hypot(p.x - q.x, p.y - q.y)
    }
    const mid = () => {
      const [p, q] = [...pts.values()]
      return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    }

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse') return
      pts.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pts.size === 2) {
        pinching = true
        startDist = dist()
        baseZoom = zoomRef.current
        applied = baseZoom
      }
    }
    const onMove = (event: PointerEvent) => {
      const point = pts.get(event.pointerId)
      if (!point) return
      point.x = event.clientX
      point.y = event.clientY
      if (!pinching || pts.size !== 2 || startDist <= 0) return
      const el = zoomTargetRef.current
      if (!el) return
      const next = Math.min(2.4, Math.max(0.6, baseZoom * (dist() / startDist)))
      const scroller = scrollerRef.current
      // Fraction-of-face anchoring: where the midpoint sits inside the face
      // before the zoom is where it should sit after — convention-free, since
      // getBoundingClientRect is always in visual pixels.
      const m = mid()
      const before = el.getBoundingClientRect()
      const relX = (m.x - before.left) / Math.max(1, before.width)
      const relY = (m.y - before.top) / Math.max(1, before.height)
      el.style.zoom = String(next)
      if (scroller) {
        const after = el.getBoundingClientRect()
        scroller.scrollLeft += after.left + relX * after.width - m.x
        scroller.scrollTop += after.top + relY * after.height - m.y
      }
      applied = next
    }
    const onUp = (event: PointerEvent) => {
      pts.delete(event.pointerId)
      if (pinching && pts.size < 2) {
        pinching = false
        if (Math.abs(applied - zoomRef.current) > 0.005) report(applied)
      }
    }

    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onUp)
    return () => {
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onUp)
    }
  }, [hostRef, report, scrollerRef, zoomTargetRef])
}

/** Horizontal drag on touch/pen turns the view: the face tracks the finger,
    past ~18% width it commits to the view's step target, otherwise it springs
    home. Edge taps on mouse do the same stepping. Zoomed faces hand the drag
    back to native panning — a magnified page scrolls, it does not turn. */
function useSwipeTurn({
  hostRef,
  faceRef,
  stepFor,
  zoom,
  reducedMotion,
  onPageChange,
}: {
  hostRef: React.RefObject<HTMLElement | null>
  faceRef: React.RefObject<HTMLElement | null>
  /** The face index a turn in `direction` should land on — null at the ends.
      Single view steps one face; spread view steps a whole pair. */
  stepFor: (direction: 1 | -1) => number | null
  zoom: number
  reducedMotion: boolean
  onPageChange: (
    index: number,
    behavior?: BookPreviewNavigationBehavior,
  ) => void
}) {
  const report = useStableHandler(onPageChange)
  const gesture = useRef<{
    id: number
    startX: number
    dx: number
    moved: boolean
  } | null>(null)
  // A drag that moved swallows its own trailing click so the edge-tap zones
  // cannot double-fire a turn the swipe already committed.
  const suppressClick = useRef(false)
  const stateRef = useRef({ stepFor, zoom, reducedMotion })
  useEffect(() => {
    stateRef.current = { stepFor, zoom, reducedMotion }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const settle = (el: HTMLElement, target: string, ms: number) => {
      if (stateRef.current.reducedMotion) {
        el.style.translate = target
        return
      }
      el.style.transition = `translate ${ms}ms ease-out`
      el.style.translate = target
      window.setTimeout(() => {
        el.style.transition = ''
      }, ms)
    }
    const release = () => {
      const face = faceRef.current
      if (face) {
        face.style.transition = ''
        face.style.translate = ''
      }
    }

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' || event.button !== 0) return
      // A second finger means pinch — release the swipe so the zoom gesture
      // owns the face instead of stacking translate on it.
      if (gesture.current) {
        gesture.current = null
        release()
        return
      }
      // Zoomed pages pan natively; a drag must not also turn the page.
      if (stateRef.current.zoom !== 1) return
      if ((event.target as HTMLElement).closest('a,button,input,[role=button]'))
        return
      gesture.current = {
        id: event.pointerId,
        startX: event.clientX,
        dx: 0,
        moved: false,
      }
      host.setPointerCapture(event.pointerId)
    }
    const onMove = (event: PointerEvent) => {
      const active = gesture.current
      if (!active || event.pointerId !== active.id) return
      const dx = event.clientX - active.startX
      active.dx = dx
      if (Math.abs(dx) > 6) active.moved = true
      const face = faceRef.current
      if (!face) return
      // Rubber-band when the step target does not exist.
      const target = stateRef.current.stepFor(dx < 0 ? 1 : -1)
      face.style.translate = `${target === null ? dx * 0.35 : dx}px 0`
    }
    const onUp = (event: PointerEvent) => {
      const active = gesture.current
      if (!active || event.pointerId !== active.id) return
      gesture.current = null
      suppressClick.current = active.moved
      const face = faceRef.current
      const width = host.clientWidth || 1
      const dx = active.dx
      const commit = Math.abs(dx) > Math.min(80, width * 0.18)
      const target = commit ? stateRef.current.stepFor(dx < 0 ? 1 : -1) : null
      if (face) {
        settle(
          face,
          commit && target !== null
            ? `${dx < 0 ? -width : width}px 0`
            : '0px 0',
          commit && target !== null ? 140 : 160,
        )
      }
      if (target !== null) report(target)
    }
    // A browser-interrupted gesture springs home — it can never turn.
    const onCancel = (event: PointerEvent) => {
      const active = gesture.current
      if (!active || event.pointerId !== active.id) return
      gesture.current = null
      suppressClick.current = active.moved
      release()
    }
    // Edge taps (mouse) step the same way — the outer ~18% is a turn zone.
    const onClick = (event: MouseEvent) => {
      if (suppressClick.current) {
        suppressClick.current = false
        return
      }
      if ((event.target as HTMLElement).closest('a,button,input,[role=button]'))
        return
      const rect = host.getBoundingClientRect()
      const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1)
      const direction = ratio < 0.18 ? -1 : ratio > 0.82 ? 1 : null
      if (direction === null) return
      const target = stateRef.current.stepFor(direction)
      if (target !== null) report(target)
    }

    host.addEventListener('pointerdown', onDown)
    host.addEventListener('pointermove', onMove)
    host.addEventListener('pointerup', onUp)
    host.addEventListener('pointercancel', onCancel)
    host.addEventListener('click', onClick)
    return () => {
      host.removeEventListener('pointerdown', onDown)
      host.removeEventListener('pointermove', onMove)
      host.removeEventListener('pointerup', onUp)
      host.removeEventListener('pointercancel', onCancel)
      host.removeEventListener('click', onClick)
    }
  }, [faceRef, hostRef, report])
}

/** One face at a time — the phone-friendly view and the default on narrow
    screens. Drag left/right or use the reader's arrows to turn. */
export function PremierSingleView({
  faces,
  pageIndex,
  zoom,
  reducedMotion,
  doc,
  onZoom,
  onPageChange,
}: {
  faces: PremierFace[]
  pageIndex: number
  zoom: number
  reducedMotion: boolean
  /** The open pdf document — present only for pdf sources; page-data faces
      are already real DOM text and need no overlay. */
  doc: PdfDocumentProxy | null
  onZoom: (zoom: number) => void
  onPageChange: (
    index: number,
    behavior?: BookPreviewNavigationBehavior,
  ) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const faceRef = useRef<HTMLDivElement | null>(null)
  const arrival = usePageArrival(pageIndex)
  useSwipeTurn({
    hostRef,
    faceRef,
    stepFor: (direction) => {
      const next = pageIndex + direction
      return next >= 0 && next < faces.length ? next : null
    },
    zoom,
    reducedMotion,
    onPageChange,
  })
  usePinchZoom({
    hostRef,
    zoomTargetRef: faceRef,
    scrollerRef,
    zoom,
    onZoom,
  })

  const face = faces[Math.min(pageIndex, faces.length - 1)]
  return (
    <div
      ref={hostRef}
      className={
        zoom === 1
          ? 'h-full w-full touch-pan-y'
          : 'h-full w-full touch-pan-x touch-pan-y'
      }
    >
      {/* m-auto centers the face but top-aligns it the moment it overflows,
          so a zoomed page scrolls instead of clipping its head. */}
      {/* A size container, so the face fits both axes: as tall as the stage
          allows, unless the stage is too narrow for that page's aspect. */}
      <div
        ref={scrollerRef}
        className="[container-type:size] flex h-full overflow-auto p-4"
      >
        <div
          ref={faceRef}
          style={{
            zoom,
            height: fitHeight(face?.aspect ?? FALLBACK_ASPECT),
          }}
          className="m-auto"
        >
          {face ? (
            <FaceBox face={face} arrival={arrival} key={face.key}>
              {doc && face.pageNumber !== null ? (
                <PdfFaceOverlay
                  doc={doc}
                  pageNumber={face.pageNumber}
                  hasRaster={face.hasRaster}
                  zoom={zoom}
                  onNavigate={onPageChange}
                />
              ) : null}
            </FaceBox>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Two faces side by side — the magazine/atlas view. Advances a pair at a
    time; the cover stands alone. */
export function PremierSpreadView({
  faces,
  pageIndex,
  zoom,
  reducedMotion,
  doc,
  onZoom,
  onPageChange,
}: {
  faces: PremierFace[]
  pageIndex: number
  zoom: number
  reducedMotion: boolean
  doc: PdfDocumentProxy | null
  onZoom: (zoom: number) => void
  onPageChange: (
    index: number,
    behavior?: BookPreviewNavigationBehavior,
  ) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const faceRef = useRef<HTMLDivElement | null>(null)
  const { pair, left, right } = spreadSlots(pageIndex, faces.length)
  const arrival = usePageArrival(pair)
  useSwipeTurn({
    hostRef,
    faceRef,
    stepFor: (direction) => spreadStep(pair, direction, faces.length),
    zoom,
    reducedMotion,
    onPageChange,
  })
  usePinchZoom({
    hostRef,
    zoomTargetRef: faceRef,
    scrollerRef,
    zoom,
    onZoom,
  })

  const leftFace = faces[left]
  const rightFace = right >= 0 ? faces[right] : null
  return (
    <div
      ref={hostRef}
      className={
        zoom === 1
          ? 'h-full w-full touch-pan-y'
          : 'h-full w-full touch-pan-x touch-pan-y'
      }
    >
      <div
        ref={scrollerRef}
        className="[container-type:size] flex h-full overflow-auto p-4"
      >
        <div
          ref={faceRef}
          style={{
            zoom,
            // Two faces side by side: the pair is twice as wide as one page.
            height: fitHeight(2 * (leftFace?.aspect ?? FALLBACK_ASPECT)),
          }}
          className="m-auto flex items-stretch gap-0.5"
        >
          {leftFace ? (
            <FaceBox face={leftFace} arrival={arrival} key={leftFace.key}>
              {doc && leftFace.pageNumber !== null ? (
                <PdfFaceOverlay
                  doc={doc}
                  pageNumber={leftFace.pageNumber}
                  hasRaster={leftFace.hasRaster}
                  zoom={zoom}
                  onNavigate={onPageChange}
                />
              ) : null}
            </FaceBox>
          ) : null}
          {rightFace ? (
            <FaceBox face={rightFace} arrival={arrival} key={rightFace.key}>
              {doc && rightFace.pageNumber !== null ? (
                <PdfFaceOverlay
                  doc={doc}
                  pageNumber={rightFace.pageNumber}
                  hasRaster={rightFace.hasRaster}
                  zoom={zoom}
                  onNavigate={onPageChange}
                />
              ) : null}
            </FaceBox>
          ) : leftFace ? (
            <div
              aria-hidden
              className="bg-muted/30 h-full shrink-0 rounded-md"
              style={{
                aspectRatio: `${leftFace.aspect ?? FALLBACK_ASPECT}`,
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Scroll position → page index, for the continuous views. The element with
 * the largest visible share is "current" — that also steers the pdf raster
 * window. External navigation (thumbs, contents, arrows, search) scrolls the
 * target into view, but never when the reader's own scroll put it there, so
 * the two can never fight.
 */
function useScrollPageSync({
  scrollerRef,
  pageIndex,
  count,
  reducedMotion,
  onPageChange,
}: {
  scrollerRef: React.RefObject<HTMLElement | null>
  pageIndex: number
  count: number
  reducedMotion: boolean
  onPageChange: (
    index: number,
    behavior?: BookPreviewNavigationBehavior,
  ) => void
}) {
  const faceEls = useRef(new Map<number, HTMLElement>())
  const ratios = useRef(new Map<number, number>())
  const dominantRef = useRef(pageIndex)
  const report = useStableHandler(onPageChange)

  useEffect(() => {
    const host = scrollerRef.current
    if (!host || typeof IntersectionObserver === 'undefined') return
    // A new face list must not inherit the last document's visibility scores.
    ratios.current.clear()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number((entry.target as HTMLElement).dataset.faceIndex)
          ratios.current.set(
            index,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          )
        }
        let best = -1
        let bestRatio = 0.1
        for (const [index, ratio] of ratios.current) {
          if (ratio > bestRatio) {
            best = index
            bestRatio = ratio
          }
        }
        if (best >= 0 && best < count && best !== dominantRef.current) {
          dominantRef.current = best
          report(best, 'instant')
        }
      },
      { root: host, threshold: [0.1, 0.35, 0.6, 0.85] },
    )
    for (const el of faceEls.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [count, report, scrollerRef])

  useEffect(() => {
    if (dominantRef.current === pageIndex) return
    const el = faceEls.current.get(pageIndex)
    if (!el) return
    dominantRef.current = pageIndex
    el.scrollIntoView({
      block: 'start',
      behavior: reducedMotion ? 'auto' : 'smooth',
    })
  }, [pageIndex, reducedMotion])

  return (index: number) => (el: HTMLElement | null) => {
    if (el) faceEls.current.set(index, el)
    else faceEls.current.delete(index)
  }
}

/** Every face in one continuous strip — the document view. */
export function PremierScrollView({
  faces,
  pageIndex,
  zoom,
  reducedMotion,
  doc,
  onZoom,
  onPageChange,
}: {
  faces: PremierFace[]
  pageIndex: number
  zoom: number
  reducedMotion: boolean
  doc: PdfDocumentProxy | null
  onZoom: (zoom: number) => void
  onPageChange: (
    index: number,
    behavior?: BookPreviewNavigationBehavior,
  ) => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const columnRef = useRef<HTMLDivElement | null>(null)
  const registerFace = useScrollPageSync({
    scrollerRef,
    pageIndex,
    count: faces.length,
    reducedMotion,
    onPageChange,
  })
  usePinchZoom({
    hostRef: scrollerRef,
    zoomTargetRef: columnRef,
    scrollerRef,
    zoom,
    onZoom,
  })

  return (
    <div
      ref={scrollerRef}
      className="h-full w-full overflow-auto overscroll-contain"
    >
      <div
        ref={columnRef}
        className="mx-auto flex w-[88%] max-w-[44rem] flex-col items-stretch gap-4 py-6"
        style={{ zoom }}
      >
        {faces.map((face, index) => (
          <div
            key={face.key}
            data-face-index={index}
            ref={registerFace(index)}
            className="bg-card relative w-full overflow-hidden rounded-md border shadow-sm"
            style={{ aspectRatio: `${face.aspect ?? FALLBACK_ASPECT}` }}
          >
            {face.content}
            {doc && face.pageNumber !== null ? (
              <PdfFaceOverlay
                doc={doc}
                pageNumber={face.pageNumber}
                hasRaster={face.hasRaster}
                zoom={zoom}
                onNavigate={onPageChange}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Just the words — no bitmaps at all. This is the lightest way to read a
    document: it costs nothing to paint, reflows to any screen, and gives
    assistive tech clean prose. Page markers keep place with the reader's
    pager and the other views. */
export function PremierTextView({
  faces,
  pageIndex,
  zoom,
  reducedMotion,
  onZoom,
  onPageChange,
}: {
  faces: PremierFace[]
  pageIndex: number
  zoom: number
  reducedMotion: boolean
  onZoom: (zoom: number) => void
  onPageChange: (
    index: number,
    behavior?: BookPreviewNavigationBehavior,
  ) => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const columnRef = useRef<HTMLDivElement | null>(null)
  const registerFace = useScrollPageSync({
    scrollerRef,
    pageIndex,
    count: faces.length,
    reducedMotion,
    onPageChange,
  })
  usePinchZoom({
    hostRef: scrollerRef,
    zoomTargetRef: columnRef,
    scrollerRef,
    zoom,
    onZoom,
  })

  return (
    <div
      ref={scrollerRef}
      className="h-full w-full overflow-auto overscroll-contain"
    >
      <div
        ref={columnRef}
        data-bp-prose
        className="mx-auto flex w-[88%] max-w-(--bp-type-measure) flex-col gap-10 py-10"
        style={{ zoom }}
      >
        {faces.map((face, index) => (
          <section
            key={face.key}
            data-face-index={index}
            ref={registerFace(index)}
            aria-label={`Page ${index + 1}`}
            className="scroll-mt-4"
          >
            <p className="text-muted-foreground mb-2 font-mono text-[11px] tracking-widest uppercase">
              Page {index + 1}
            </p>
            {face.text ? (
              <p
                data-bp-reflow
                className="text-foreground/90 whitespace-pre-wrap"
              >
                {face.text}
              </p>
            ) : (
              <p className="text-muted-foreground text-sm italic">
                This page has no readable text.
              </p>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}
