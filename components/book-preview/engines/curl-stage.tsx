'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { playPageTurnSound } from '../audio'
import { useStableHandler } from '../hooks/use-stable-handler'
import { tapConsumedByChrome } from '../hooks/use-immersive-chrome'
import {
  CURL_CLICK_SLOP_PX,
  CURL_PAGE_RATIO,
  CURL_TOUCH_SLOP_PX,
  curlClickIntent,
  curlPageSizeForStage,
  curlReleaseVelocity,
  curlShouldCommit,
  quantizeCurlPageSize,
  type CurlPageSize,
} from './curl-geometry'
import {
  CURL_PEEK_PROGRESS,
  constrainCurlDrag,
  curlBackwardProgress,
  curlDragPoint,
  curlFold,
  curlForwardProgress,
  curlPolygonCss,
  curlSettleMs,
  curlWindow,
  easeInOutCubic,
  easeOutCubic,
} from './curl-math'

type CurlStageProps = {
  pageIndex: number
  pageCount: number
  /** Renders one leaf. Only the few leaves around the reading position are
      mounted, so a 700-page document costs the same as a 7-page one. */
  renderPage: (index: number) => ReactNode
  /** height / width of a sheet. Defaults to the paper-book ratio; PDF sources
      pass their own so the book matches the document instead of letterboxing. */
  pageRatio?: number
  /** Colour of the paper on the back of a turning leaf. Rasterized PDF
      pages are white whatever the theme; typeset pages use the reader's. */
  leafBack?: string
  reducedMotion: boolean
  soundEnabled: boolean
  onPageChange: (pageIndex: number) => void
}

type Direction = 'next' | 'prev'

/** A leaf in the air. `p` is 0 flat on the page, 1 turned over the spine. */
type Turn = {
  direction: Direction
  leaf: number
  under: number
  top: boolean
  p: number
  dy: number
  /** Where the page lands once this turn completes; null while undecided. */
  landing: number | null
  peek: boolean
}

/** A turn from a tap, the arrows, or the keyboard. Longer than UI motion
    (this is the hero of the component), still short enough that a fast
    reader tapping through never waits: a new turn lands the old one. */
const CURL_TURN_MS = 540
const CURL_PEEK_MS = 220
/** Mouse this close to a corner lifts it. */
const CURL_CORNER_PX = 64

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false
  return Boolean(
    target.closest(
      'a, button, input, textarea, select, [data-book-preview-press]',
    ),
  )
}

/** Fore-edge page-stack thickness: a few pixels, growing gently with the
    number of leaves on that side — enough to read as a book block. */
function curlEdgeWidth(pageCountOnSide: number): number {
  if (pageCountOnSide <= 0) return 0
  return Math.min(6, 2 + Math.floor(pageCountOnSide / 8))
}

function show(el: HTMLElement | undefined, z: number, clip: string) {
  if (!el) return
  el.style.visibility = 'visible'
  el.style.zIndex = String(z)
  el.style.clipPath = clip
}

function hide(el: HTMLElement | undefined) {
  if (!el) return
  el.style.visibility = 'hidden'
  el.style.clipPath = ''
}

/**
 * Page-curl book. The turning leaf is folded, not faked: its flat part is
 * clipped at the fold, its lifted part is mirrored across the fold onto its
 * own paper back, and the page underneath is already there. The drag follows
 * the finger, a release finishes from wherever the page is, in the direction
 * it was moving, and any new input lands a turn still in the air — nothing
 * ever waits on an animation.
 */
export function CurlStage({
  pageIndex,
  pageCount,
  renderPage,
  pageRatio = CURL_PAGE_RATIO,
  leafBack = 'var(--background)',
  reducedMotion,
  soundEnabled,
  onPageChange,
}: CurlStageProps) {
  const [pageSize, setPageSize] = useState<CurlPageSize | null>(null)
  const [shown, setShown] = useState(() =>
    Math.min(Math.max(pageIndex, 0), Math.max(pageCount - 1, 0)),
  )
  const stageRef = useRef<HTMLDivElement | null>(null)
  const bookRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<HTMLDivElement | null>(null)
  const frontsRef = useRef(new Map<number, HTMLElement>())
  const backsRef = useRef(new Map<number, HTMLElement>())
  const shownRef = useRef(shown)
  const turnRef = useRef<Turn | null>(null)
  const rafRef = useRef(0)
  const animDoneRef = useRef<(() => void) | null>(null)
  const sizeRef = useRef<CurlPageSize | null>(null)
  const settingsRef = useRef({ pageCount, reducedMotion, soundEnabled })
  const report = useStableHandler(onPageChange)

  useLayoutEffect(() => {
    sizeRef.current = pageSize
    settingsRef.current = { pageCount, reducedMotion, soundEnabled }
  })

  // ---- measuring -------------------------------------------------------

  useEffect(() => {
    const node = stageRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const measure = () => {
      const next = quantizeCurlPageSize(
        curlPageSizeForStage(
          node.clientWidth,
          node.clientHeight,
          pageRatio,
          false,
        ),
        pageRatio,
      )
      setPageSize((current) =>
        current &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      )
    }
    const update = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    measure()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [pageRatio])

  // ---- painting ----------------------------------------------------------

  /** Writes the current state straight to the DOM — once per frame while a
      leaf moves, and after every render so newly mounted leaves are placed. */
  const paint = useCallback(() => {
    const fronts = frontsRef.current
    const backs = backsRef.current
    const shadow = shadowRef.current
    const size = sizeRef.current
    const turn = turnRef.current
    const fold =
      turn && size
        ? curlFold(
            { x: size.width, y: turn.top ? 0 : size.height },
            constrainCurlDrag(
              { x: size.width, y: turn.top ? 0 : size.height },
              curlDragPoint(
                { x: size.width, y: turn.top ? 0 : size.height },
                turn.p,
                turn.dy,
                size.height,
              ),
              size.height,
            ),
            size.width,
            size.height,
          )
        : null

    if (!turn || !size || !fold) {
      // At rest. A turn with no fold is a leaf lying flat: the leaf itself
      // (forward, not yet lifted) or the page it uncovers (back, all the way).
      const visible = turn
        ? turn.p >= 1
          ? turn.under
          : turn.leaf
        : shownRef.current
      for (const [index, el] of fronts) {
        if (index === visible) show(el, 2, '')
        else hide(el)
      }
      for (const el of backs.values()) hide(el)
      if (shadow) shadow.style.opacity = '0'
      return
    }

    for (const [index, el] of fronts) {
      if (index === turn.under) show(el, 1, '')
      else if (index === turn.leaf) show(el, 2, curlPolygonCss(fold.front))
      else hide(el)
    }
    const [a, b, c, d, e, f] = fold.matrix
    for (const [index, el] of backs) {
      if (index !== turn.leaf) {
        hide(el)
        continue
      }
      show(el, 4, curlPolygonCss(fold.flap))
      el.style.transform = `matrix(${a}, ${b}, ${c}, ${d}, ${e}, ${f})`
      const gloss = el.lastElementChild
      if (gloss instanceof HTMLElement) {
        placeAlongFold(gloss, fold.origin, fold.angle, fold.depth, size)
      }
    }
    if (shadow) {
      // Shadow on the page underneath, strongest mid-turn, cast from the
      // fold across the uncovered paper.
      const lift = Math.sin(Math.PI * Math.min(Math.max(turn.p, 0), 1))
      const reach = Math.max(24, Math.min(fold.depth * 0.5, size.width * 0.35))
      placeAlongFold(shadow, fold.origin, fold.angle, reach, size)
      shadow.style.opacity = String(Math.min(1, 0.25 + lift))
    }
  }, [])

  useLayoutEffect(() => {
    paint()
  })

  // ---- motion ------------------------------------------------------------

  const stopAnimation = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    animDoneRef.current = null
  }, [])

  const animate = useCallback(
    (
      to: { p: number; dy: number },
      ms: number,
      ease: (t: number) => number,
      done: () => void,
    ) => {
      stopAnimation()
      const turn = turnRef.current
      if (!turn) return
      const from = { p: turn.p, dy: turn.dy }
      const start = performance.now()
      animDoneRef.current = done
      const frame = (now: number) => {
        const current = turnRef.current
        if (!current) return
        const t = ms <= 0 ? 1 : Math.min(1, (now - start) / ms)
        const k = ease(t)
        current.p = from.p + (to.p - from.p) * k
        current.dy = from.dy + (to.dy - from.dy) * k
        paint()
        if (t < 1) {
          rafRef.current = requestAnimationFrame(frame)
          return
        }
        rafRef.current = 0
        const finish = animDoneRef.current
        animDoneRef.current = null
        finish?.()
      }
      rafRef.current = requestAnimationFrame(frame)
    },
    [paint, stopAnimation],
  )

  /** Settles the turn in the air: lands it where it was going, or lays the
      leaf back down. */
  const endTurn = useCallback(() => {
    stopAnimation()
    const turn = turnRef.current
    turnRef.current = null
    if (turn?.landing != null && turn.landing !== shownRef.current) {
      shownRef.current = turn.landing
      setShown(turn.landing)
    }
    paint()
  }, [paint, stopAnimation])

  /** Anything new — a press, a tap, a key — lands a committed turn first,
      so a quick reader turns as fast as they like. */
  const landInFlight = useCallback(() => {
    const turn = turnRef.current
    if (turn && turn.landing != null) endTurn()
  }, [endTurn])

  const beginTurn = useCallback(
    (direction: Direction, top: boolean, peek = false): Turn | null => {
      const current = shownRef.current
      const { pageCount: count } = settingsRef.current
      if (direction === 'next' && current >= count - 1) return null
      if (direction === 'prev' && current <= 0) return null
      const existing = turnRef.current
      if (
        existing &&
        existing.direction === direction &&
        existing.landing == null
      ) {
        existing.top = top
        existing.peek = peek
        return existing
      }
      if (existing) endTurn()
      const turn: Turn = {
        direction,
        leaf: direction === 'next' ? current : current - 1,
        under: direction === 'next' ? current + 1 : current,
        top,
        p: direction === 'next' ? 0 : 1,
        dy: 0,
        landing: null,
        peek,
      }
      turnRef.current = turn
      return turn
    },
    [endTurn],
  )

  const commit = useCallback(
    (turn: Turn, sound: boolean, announce: boolean) => {
      turn.landing =
        turn.direction === 'next' ? shownRef.current + 1 : shownRef.current - 1
      if (sound && settingsRef.current.soundEnabled) playPageTurnSound()
      if (announce) report(turn.landing)
    },
    [report],
  )

  /** A whole turn from rest (or from a peek): tap, arrow button, keyboard. */
  const turnPage = useCallback(
    (
      direction: Direction,
      options: { top?: boolean; sound: boolean; announce: boolean },
    ) => {
      landInFlight()
      const current = shownRef.current
      const target = direction === 'next' ? current + 1 : current - 1
      if (target < 0 || target >= settingsRef.current.pageCount) return
      if (settingsRef.current.reducedMotion || !sizeRef.current) {
        endTurn()
        if (options.sound && settingsRef.current.soundEnabled) {
          playPageTurnSound()
        }
        shownRef.current = target
        setShown(target)
        if (options.announce) report(target)
        paint()
        return
      }
      const turn = beginTurn(direction, options.top ?? false)
      if (!turn) return
      commit(turn, options.sound, options.announce)
      const remaining = direction === 'next' ? 1 - turn.p : turn.p
      animate(
        { p: direction === 'next' ? 1 : 0, dy: 0 },
        Math.max(160, CURL_TURN_MS * remaining),
        remaining > 0.9 ? easeInOutCubic : easeOutCubic,
        endTurn,
      )
    },
    [animate, beginTurn, commit, endTurn, landInFlight, paint, report],
  )

  // ---- the reader's page index -----------------------------------------

  useEffect(() => {
    const turn = turnRef.current
    if (turn?.landing === pageIndex) return
    if (!turn && pageIndex === shownRef.current) return
    landInFlight()
    if (turnRef.current) endTurn()
    const current = shownRef.current
    if (pageIndex === current) return
    // A step from the keyboard or the pager turns the leaf, silently — only
    // the reader's own hand makes the paper sound. Jumps just open there.
    if (Math.abs(pageIndex - current) === 1) {
      turnPage(pageIndex > current ? 'next' : 'prev', {
        sound: false,
        announce: false,
      })
      return
    }
    shownRef.current = pageIndex
    setShown(pageIndex)
  }, [endTurn, landInFlight, pageIndex, turnPage])

  // A source swap (a new document, fewer pages) can strand the index.
  useEffect(() => {
    if (pageCount > 0 && shownRef.current > pageCount - 1) {
      endTurn()
      shownRef.current = pageCount - 1
      setShown(pageCount - 1)
    }
  }, [endTurn, pageCount])

  // ---- pointers ----------------------------------------------------------

  useEffect(() => {
    const book = bookRef.current
    if (!book) return
    const press = {
      id: -1,
      startX: 0,
      startY: 0,
      slop: CURL_CLICK_SLOP_PX,
      touch: false,
      dragging: false,
      direction: null as Direction | null,
      last: { x: 0, y: 0 },
      samples: [] as { x: number; t: number }[],
    }

    /** Page coordinates — robust to CSS zoom and transforms on ancestors. */
    const local = (clientX: number, clientY: number) => {
      const rect = book.getBoundingClientRect()
      const size = sizeRef.current
      const sx = size && rect.width ? size.width / rect.width : 1
      const sy = size && rect.height ? size.height / rect.height : 1
      return { x: (clientX - rect.left) * sx, y: (clientY - rect.top) * sy }
    }

    const setCursor = (value: '' | 'grab' | 'grabbing') => {
      if (value) book.dataset.curlCursor = value
      else delete book.dataset.curlCursor
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || press.id !== -1) return
      if (isInteractiveTarget(event.target)) return
      landInFlight()
      const pos = local(event.clientX, event.clientY)
      press.id = event.pointerId
      press.startX = pos.x
      press.startY = pos.y
      press.last = pos
      press.samples = [{ x: pos.x, t: event.timeStamp }]
      press.touch = event.pointerType !== 'mouse'
      press.slop = press.touch ? CURL_TOUCH_SLOP_PX : CURL_CLICK_SLOP_PX
      press.dragging = false
      press.direction = null
      try {
        book.setPointerCapture(event.pointerId)
      } catch {
        // Capture is best-effort; the window listeners finish the gesture.
      }
    }

    const peekAt = (pos: { x: number; y: number }) => {
      const size = sizeRef.current
      if (!size || settingsRef.current.reducedMotion) return
      const nearTop = pos.y < CURL_CORNER_PX
      const nearBottom = pos.y > size.height - CURL_CORNER_PX
      const nearRight = pos.x > size.width - CURL_CORNER_PX
      const nearLeft = pos.x < CURL_CORNER_PX
      const current = shownRef.current
      const direction: Direction | null =
        (nearTop || nearBottom) &&
        nearRight &&
        current < settingsRef.current.pageCount - 1
          ? 'next'
          : (nearTop || nearBottom) && nearLeft && current > 0
            ? 'prev'
            : null
      const turn = turnRef.current
      if (turn && (turn.landing != null || !turn.peek)) return
      setCursor(direction ? 'grab' : '')
      if (!direction) {
        if (turn?.peek) {
          animate(
            { p: turn.direction === 'next' ? 0 : 1, dy: 0 },
            CURL_PEEK_MS,
            easeOutCubic,
            endTurn,
          )
          turn.peek = false
        }
        return
      }
      if (turn?.peek && turn.direction === direction) return
      const peek = beginTurn(direction, nearTop, true)
      if (!peek) return
      animate(
        {
          p: direction === 'next' ? CURL_PEEK_PROGRESS : 1 - CURL_PEEK_PROGRESS,
          dy: 0,
        },
        CURL_PEEK_MS,
        easeOutCubic,
        () => {},
      )
    }

    const onHover = (event: PointerEvent) => {
      if (press.id !== -1 || event.pointerType !== 'mouse') return
      peekAt(local(event.clientX, event.clientY))
    }

    const onLeave = (event: PointerEvent) => {
      if (press.id !== -1 || event.pointerType !== 'mouse') return
      peekAt({ x: -1e4, y: -1e4 })
    }

    const onPointerMove = (event: PointerEvent) => {
      if (press.id !== event.pointerId) return
      const size = sizeRef.current
      if (!size) return
      const pos = local(event.clientX, event.clientY)
      press.last = pos
      press.samples.push({ x: pos.x, t: event.timeStamp })
      if (press.samples.length > 12) press.samples.shift()
      const dx = pos.x - press.startX
      if (!press.dragging) {
        // Touch turns need horizontal intent — a mostly vertical gesture is
        // the page scrolling. A mouse has no competing gesture.
        const distance = press.touch
          ? Math.abs(dx)
          : Math.hypot(dx, pos.y - press.startY)
        if (distance < press.slop) return
        const direction: Direction = dx < 0 ? 'next' : 'prev'
        press.dragging = true
        press.direction = direction
        setCursor('grabbing')
        if (settingsRef.current.reducedMotion) return
        if (!beginTurn(direction, press.startY < size.height / 2)) {
          press.direction = null
          return
        }
        stopAnimation()
      }
      event.preventDefault()
      const turn = turnRef.current
      if (!turn || !press.direction || settingsRef.current.reducedMotion) return
      turn.p =
        press.direction === 'next'
          ? curlForwardProgress(press.startX, pos.x, size.width)
          : curlBackwardProgress(press.startX, pos.x, size.width)
      turn.dy = pos.y - press.startY
      paint()
    }

    const finish = (event: PointerEvent) => {
      if (press.id !== event.pointerId) return
      const cancelled = event.type === 'pointercancel'
      const pos = cancelled ? press.last : local(event.clientX, event.clientY)
      if (!cancelled) press.samples.push({ x: pos.x, t: event.timeStamp })
      const velocity = cancelled ? 0 : curlReleaseVelocity(press.samples)
      const { dragging, direction } = press
      press.id = -1
      press.dragging = false
      press.direction = null
      if (book.hasPointerCapture(event.pointerId)) {
        book.releasePointerCapture(event.pointerId)
      }
      setCursor('')
      const size = sizeRef.current
      if (!size) return

      if (dragging) {
        if (!direction) return
        if (settingsRef.current.reducedMotion) {
          if (!cancelled) turnPage(direction, { sound: true, announce: true })
          return
        }
        const turn = turnRef.current
        if (!turn) return
        // The page keeps going the way the hand left it: a flick turns it
        // from anywhere, a slow release reads by how far it got.
        const toward = direction === 'next' ? -velocity : velocity
        const travelled = direction === 'next' ? turn.p : 1 - turn.p
        const done = curlShouldCommit(travelled * 100, toward)
        if (done) commit(turn, true, true)
        const finished = direction === 'next' ? done : !done
        const remaining = done ? 1 - travelled : travelled
        animate(
          { p: finished ? 1 : 0, dy: 0 },
          curlSettleMs(remaining, velocity),
          easeOutCubic,
          endTurn,
        )
        return
      }

      if (cancelled) return
      // A tap: barely moved, and not already spent by the reader chrome.
      if (
        Math.hypot(pos.x - press.startX, pos.y - press.startY) >= press.slop
      ) {
        return
      }
      if (tapConsumedByChrome()) return
      const current = shownRef.current
      const intent = curlClickIntent(
        pos.x,
        size.width,
        current > 0,
        current < settingsRef.current.pageCount - 1,
      )
      if (!intent) return
      turnPage(intent, {
        top: pos.y < size.height / 2,
        sound: true,
        announce: true,
      })
    }

    book.addEventListener('pointerdown', onPointerDown)
    book.addEventListener('pointermove', onHover)
    book.addEventListener('pointerleave', onLeave)
    window.addEventListener('pointermove', onPointerMove, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    return () => {
      book.removeEventListener('pointerdown', onPointerDown)
      book.removeEventListener('pointermove', onHover)
      book.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
    }
  }, [
    animate,
    beginTurn,
    commit,
    endTurn,
    landInFlight,
    paint,
    stopAnimation,
    turnPage,
  ])

  useEffect(() => () => stopAnimation(), [stopAnimation])

  // ---- render ------------------------------------------------------------

  const window_ = curlWindow(shown, pageCount, [pageIndex])
  const width = pageSize?.width ?? 280
  const height = pageSize?.height ?? Math.round(280 * pageRatio)
  const canGoPrev = pageIndex > 0
  const canGoNext = pageIndex < pageCount - 1

  return (
    <div
      ref={stageRef}
      className="relative flex h-full w-full min-w-0 touch-pan-y items-center justify-center p-3 select-none sm:p-4"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Previous page"
        disabled={!canGoPrev}
        className="absolute top-1/2 left-1 z-10 hidden min-h-11 min-w-11 -translate-y-1/2 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
        data-book-preview-press
        onClick={() => turnPage('prev', { sound: true, announce: true })}
      >
        <IconChevronLeft />
      </Button>
      <div
        data-book-preview-curl
        className="relative max-h-full max-w-full min-w-0"
        style={{ opacity: pageSize ? 1 : 0 }}
      >
        {pageCount > 1 ? (
          <>
            {/* The book block: thin stacked page edges flanking the page,
                thickest where the most leaves sit. Purely decorative. */}
            <div
              aria-hidden
              data-book-preview-curl-edge="prev"
              style={{ width: curlEdgeWidth(shown) }}
            />
            <div
              aria-hidden
              data-book-preview-curl-edge="next"
              style={{ width: curlEdgeWidth(pageCount - 1 - shown) }}
            />
          </>
        ) : null}
        <div
          ref={bookRef}
          data-book-preview-curl-book
          data-bp-tap-surface
          className="relative touch-pan-y overflow-hidden"
          style={{ width, height }}
        >
          {window_.map((index) => (
            <div
              key={`front-${index}`}
              ref={(node) => {
                if (node) frontsRef.current.set(index, node)
                else frontsRef.current.delete(index)
              }}
              data-book-preview-curl-leaf={index}
              inert={index !== shown}
              aria-hidden={index !== shown || undefined}
              className="absolute inset-0 overflow-hidden"
              style={{ visibility: 'hidden' }}
            >
              {renderPage(index)}
            </div>
          ))}
          <div
            ref={shadowRef}
            aria-hidden
            data-book-preview-curl-shadow
            className="pointer-events-none absolute top-0 left-0 z-[3] origin-top-left"
            style={{ opacity: 0 }}
          />
          {window_.map((index) => (
            <div
              key={`back-${index}`}
              ref={(node) => {
                if (node) backsRef.current.set(index, node)
                else backsRef.current.delete(index)
              }}
              aria-hidden
              inert
              data-book-preview-curl-back
              className="pointer-events-none absolute inset-0 origin-top-left overflow-hidden"
              style={{ visibility: 'hidden', backgroundColor: leafBack }}
            >
              {/* The page shows faintly through its own paper, mirrored —
                  the fold mirrors it for free. */}
              <div className="absolute inset-0 opacity-[0.07]">
                {renderPage(index)}
              </div>
              <div
                data-book-preview-curl-gloss
                className="absolute top-0 left-0 origin-top-left"
              />
            </div>
          ))}
        </div>
        <p
          data-book-preview-curl-label
          className="text-muted-foreground pointer-events-none absolute inset-x-0 -bottom-5 text-center font-mono text-xs"
        >
          {shown + 1}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next page"
        disabled={!canGoNext}
        className="absolute top-1/2 right-1 z-10 hidden min-h-11 min-w-11 -translate-y-1/2 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
        data-book-preview-press
        onClick={() => turnPage('next', { sound: true, announce: true })}
      >
        <IconChevronRight />
      </Button>
    </div>
  )
}

/** Lays a band along the fold: it starts on the fold line and reaches
    `reach` px toward the flap, long enough to span the page either way. */
function placeAlongFold(
  el: HTMLElement,
  origin: { x: number; y: number },
  angle: number,
  reach: number,
  size: CurlPageSize,
) {
  const span = Math.hypot(size.width, size.height) * 2
  el.style.width = `${Math.max(reach, 1)}px`
  el.style.height = `${span}px`
  el.style.transform = `translate(${origin.x}px, ${origin.y}px) rotate(${angle}deg) translateY(${-span / 2}px)`
}
