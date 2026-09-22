"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { usePageArrival } from "../hooks/use-page-arrival"
import { useStableHandler } from "../hooks/use-stable-handler"
import { BookPreviewPageView } from "../book-preview-page"
import type { PdfSheet } from "../hooks/use-pdf-sheets"
import type {
  BookPreviewAppearance,
  BookPreviewNavigationBehavior,
  BookPreviewPage,
} from "../types"

/**
 * The premier reader's flat views — one page, a two-page spread, and a
 * continuous strip — all drawn from the same face list the flip book uses.
 * Page-data sources hand over React leaves; PDF sources hand over raster
 * sheets that fill in (and release) around the reading position.
 */

export type PremierFace = {
  key: string
  /** width / height — null until a pdf page's real size is known. */
  aspect: number | null
  content: ReactNode
}

const FALLBACK_ASPECT = 370 / 530

export function buildPremierFaces(input: {
  usePdf: boolean
  sheets: PdfSheet[] | null
  pages: BookPreviewPage[]
  appearance: BookPreviewAppearance
}): PremierFace[] {
  const { usePdf, sheets, pages, appearance } = input
  if (usePdf) {
    return (sheets ?? []).map((sheet, index) => ({
      key: sheet.id,
      aspect: sheet.height > 0 ? sheet.width / sheet.height : null,
      content: sheet.src ? (
        // Object URLs are generated locally and cannot be optimized by
        // next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sheet.src}
          alt={`Page ${index + 1}`}
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : (
        <div
          className="h-full w-full animate-pulse bg-muted/40"
          aria-hidden
        />
      ),
    }))
  }
  return pages.map((page, index) => ({
    key: page.id,
    aspect: null,
    content: (
      <BookPreviewPageView
        page={page}
        appearance={appearance}
        isLeftPage={index % 2 === 1}
      />
    ),
  }))
}

/** A face sized by its own aspect — height-bounded so it never outgrows the
    stage, width-bounded so a tall page never overflows narrow screens. */
function FaceBox({
  face,
  className,
  arrival,
}: {
  face: PremierFace
  className?: string
  arrival?: Record<string, unknown>
}) {
  return (
    <div
      {...arrival}
      className={
        "relative h-full max-w-full shrink-0 overflow-hidden rounded-md border bg-card shadow-sm " +
        (className ?? "")
      }
      style={{ aspectRatio: `${face.aspect ?? FALLBACK_ASPECT}` }}
    >
      {face.content}
    </div>
  )
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
  onPageChange: (index: number, behavior?: BookPreviewNavigationBehavior) => void
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
        el.style.transition = ""
      }, ms)
    }
    const release = () => {
      const face = faceRef.current
      if (face) {
        face.style.transition = ""
        face.style.translate = ""
      }
    }

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse" || event.button !== 0) return
      // Zoomed pages pan natively; a drag must not also turn the page.
      if (stateRef.current.zoom !== 1) return
      if ((event.target as HTMLElement).closest("a,button,input,[role=button]"))
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
          commit && target !== null ? `${dx < 0 ? -width : width}px 0` : "0px 0",
          commit && target !== null ? 140 : 160
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
      if ((event.target as HTMLElement).closest("a,button,input,[role=button]"))
        return
      const rect = host.getBoundingClientRect()
      const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1)
      const direction = ratio < 0.18 ? -1 : ratio > 0.82 ? 1 : null
      if (direction === null) return
      const target = stateRef.current.stepFor(direction)
      if (target !== null) report(target)
    }

    host.addEventListener("pointerdown", onDown)
    host.addEventListener("pointermove", onMove)
    host.addEventListener("pointerup", onUp)
    host.addEventListener("pointercancel", onCancel)
    host.addEventListener("click", onClick)
    return () => {
      host.removeEventListener("pointerdown", onDown)
      host.removeEventListener("pointermove", onMove)
      host.removeEventListener("pointerup", onUp)
      host.removeEventListener("pointercancel", onCancel)
      host.removeEventListener("click", onClick)
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
  onPageChange,
}: {
  faces: PremierFace[]
  pageIndex: number
  zoom: number
  reducedMotion: boolean
  onPageChange: (index: number, behavior?: BookPreviewNavigationBehavior) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
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

  const face = faces[Math.min(pageIndex, faces.length - 1)]
  return (
    <div
      ref={hostRef}
      className={zoom === 1 ? "h-full w-full touch-pan-y" : "h-full w-full"}
    >
      {/* m-auto centers the face but top-aligns it the moment it overflows,
          so a zoomed page scrolls instead of clipping its head. */}
      <div className="flex h-full overflow-auto p-4">
        <div
          ref={faceRef}
          style={{ zoom }}
          className="m-auto h-[min(62svh,100%)]"
        >
          {face ? <FaceBox face={face} arrival={arrival} key={face.key} /> : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Spread pairing, book-style: the cover (face 0) sits alone, then faces pair
 * up (1|2), (3|4)… Returns the pair index plus both face slots; right is -1
 * when a pair has no right face.
 */
export function spreadSlots(pageIndex: number, total: number) {
  const pair = pageIndex === 0 ? 0 : Math.ceil(pageIndex / 2)
  const left = pair === 0 ? 0 : pair * 2 - 1
  const right = pair === 0 ? -1 : left + 1 <= total - 1 ? left + 1 : -1
  return { pair, left, right }
}

export function spreadStep(
  pair: number,
  direction: 1 | -1,
  total: number
): number | null {
  const next = pair + direction
  if (next < 0) return null
  const face = next === 0 ? 0 : next * 2 - 1
  return face <= total - 1 ? face : null
}

/** Two faces side by side — the magazine/atlas view. Advances a pair at a
    time; the cover stands alone. */
export function PremierSpreadView({
  faces,
  pageIndex,
  zoom,
  reducedMotion,
  onPageChange,
}: {
  faces: PremierFace[]
  pageIndex: number
  zoom: number
  reducedMotion: boolean
  onPageChange: (index: number, behavior?: BookPreviewNavigationBehavior) => void
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
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

  const leftFace = faces[left]
  const rightFace = right >= 0 ? faces[right] : null
  return (
    <div
      ref={hostRef}
      className={zoom === 1 ? "h-full w-full touch-pan-y" : "h-full w-full"}
    >
      <div className="flex h-full overflow-auto p-4">
        <div
          ref={faceRef}
          style={{ zoom }}
          className="m-auto flex h-[min(56svh,100%)] items-stretch gap-0.5"
        >
          {leftFace ? (
            <FaceBox face={leftFace} arrival={arrival} key={leftFace.key} />
          ) : null}
          {rightFace ? (
            <FaceBox face={rightFace} arrival={arrival} key={rightFace.key} />
          ) : leftFace ? (
            <div
              aria-hidden
              className="h-full shrink-0 rounded-md bg-muted/30"
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

/** Every face in one continuous strip — the document view. Intersection
    tracking keeps the reader's page counter (and the raster window) on the
    face actually on screen, and scrolls only answer external navigation so
    the two never fight. */
export function PremierScrollView({
  faces,
  pageIndex,
  zoom,
  reducedMotion,
  onPageChange,
}: {
  faces: PremierFace[]
  pageIndex: number
  zoom: number
  reducedMotion: boolean
  onPageChange: (index: number, behavior?: BookPreviewNavigationBehavior) => void
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const faceEls = useRef(new Map<number, HTMLElement>())
  const ratios = useRef(new Map<number, number>())
  const dominantRef = useRef(pageIndex)
  const report = useStableHandler(onPageChange)

  // Scroll position → page index: the face with the largest visible share is
  // "current". Also drives the pdf sheet window, so far pages stay unrastered.
  useEffect(() => {
    const host = scrollerRef.current
    if (!host || typeof IntersectionObserver === "undefined") return
    // A new face list must not inherit the last document's visibility scores.
    ratios.current.clear()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const index = Number(
            (entry.target as HTMLElement).dataset.faceIndex
          )
          ratios.current.set(
            index,
            entry.isIntersecting ? entry.intersectionRatio : 0
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
        if (
          best >= 0 &&
          best < faces.length &&
          best !== dominantRef.current
        ) {
          dominantRef.current = best
          report(best, "instant")
        }
      },
      { root: host, threshold: [0.1, 0.35, 0.6, 0.85] }
    )
    for (const el of faceEls.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [faces.length, report])

  // External navigation (thumbs, contents, arrows, search) scrolls the face
  // into view — but never when the reader's own scroll already put it there.
  useEffect(() => {
    if (dominantRef.current === pageIndex) return
    const el = faceEls.current.get(pageIndex)
    if (!el) return
    dominantRef.current = pageIndex
    el.scrollIntoView({
      block: "start",
      behavior: reducedMotion ? "auto" : "smooth",
    })
  }, [pageIndex, reducedMotion])

  return (
    <div
      ref={scrollerRef}
      className="h-full w-full overflow-auto overscroll-contain"
    >
      <div
        className="mx-auto flex w-[88%] max-w-[44rem] flex-col items-stretch gap-4 py-6"
        style={{ zoom }}
      >
        {faces.map((face, index) => (
          <div
            key={face.key}
            data-face-index={index}
            ref={(el) => {
              if (el) faceEls.current.set(index, el)
              else faceEls.current.delete(index)
            }}
            className="relative w-full overflow-hidden rounded-md border bg-card shadow-sm"
            style={{ aspectRatio: `${face.aspect ?? FALLBACK_ASPECT}` }}
          >
            {face.content}
          </div>
        ))}
      </div>
    </div>
  )
}
