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
import { useBookPreview } from '../book-preview-provider'
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
  curlSpreadStart,
  curlStepTarget,
  curlUseSpread,
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
  curlSpreadBackwardProgress,
  easeInOutCubic,
  easeOutCubic,
} from './curl-math'

/** Which side of the spine a leaf is rendered for — decides its gutter. */
export type CurlLeafSide = 'left' | 'right'

type CurlStageProps = {
  pageIndex: number
  pageCount: number
  /** Renders one leaf. Only the few leaves around the reading position are
      mounted, so a 700-page document costs the same as a 7-page one. */
  renderPage: (index: number, side: CurlLeafSide) => ReactNode
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

/** A leaf in the air. `p` is 0 flat on the right, 1 turned over the spine. */
type Turn = {
  direction: Direction
  /** The turning leaf: its front shows on the right of the spine. */
  leaf: number
  /** What the leaf's back shows — the next left page in a spread, the leaf
      itself (seen through the paper) on a single page. */
  back: number
  /** The page the leaf uncovers on the right, if there is one. */
  under: number | null
  /** The left page that stays put under the landing leaf (spreads only). */
  still: number | null
  top: boolean
  p: number
  dy: number
  /** Where the reading position lands once this turn completes; null
      while the reader's hand still decides. */
  landing: number | null
  peek: boolean
}

type Layout = { size: CurlPageSize; spread: boolean }

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

/** The pages to keep mounted: the spread in view, the one on either side
    (the leaves a turn reveals), and the target of a turn in flight. */
function curlMountWindow(
  shown: number,
  pageIndex: number,
  pageCount: number,
  spread: boolean,
): number[] {
  const set = new Set<number>()
  const span = spread ? [-2, -1, 0, 1, 2, 3, 4, 5] : [-1, 0, 1, 2]
  for (const center of [
    shown,
    spread ? curlSpreadStart(pageIndex) : pageIndex,
  ]) {
    for (const offset of span) {
      const page = center + offset
      if (page >= 0 && page < pageCount) set.add(page)
    }
  }
  return Array.from(set).sort((a, b) => a - b)
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
 * Page-curl book, one page or a two-page spread. The turning leaf is
 * folded, not faked: its flat part is clipped at the fold, its lifted part is
 * mirrored across the fold onto its own back, and whatever it uncovers is
 * already there. A spread's leaf carries the next left page on its back, so
 * it lands reading correctly. The drag follows the finger, a release
 * finishes from wherever the page is, in the direction it was moving, and
 * any new input lands a turn still in the air — nothing waits on animation.
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
  const { setPageStep } = useBookPreview()
  const [layout, setLayout] = useState<Layout | null>(null)
  const spread = layout?.spread ?? false
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
  const layoutRef = useRef<Layout | null>(null)
  const settingsRef = useRef({ pageCount, reducedMotion, soundEnabled })
  const report = useStableHandler(onPageChange)

  useLayoutEffect(() => {
    layoutRef.current = layout
    settingsRef.current = { pageCount, reducedMotion, soundEnabled }
  })

  // ---- measuring -------------------------------------------------------

  useEffect(() => {
    const node = stageRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const measure = () => {
      const wantsSpread =
        pageCount > 1 &&
        curlUseSpread(node.clientWidth, node.clientHeight, pageRatio)
      const size = quantizeCurlPageSize(
        curlPageSizeForStage(
          node.clientWidth,
          node.clientHeight,
          pageRatio,
          wantsSpread,
        ),
        pageRatio,
      )
      setLayout((current) =>
        current &&
        current.spread === wantsSpread &&
        current.size.width === size.width &&
        current.size.height === size.height
          ? current
          : { size, spread: wantsSpread },
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
  }, [pageCount, pageRatio])

  // ---- painting ----------------------------------------------------------

  /** Writes the current state straight to the DOM — once per frame while a
      leaf moves, and after every render so newly mounted leaves are placed. */
  const paint = useCallback(() => {
    const fronts = frontsRef.current
    const backs = backsRef.current
    const shadow = shadowRef.current
    const current = layoutRef.current
    const turn = turnRef.current
    const size = current?.size
    const corner =
      size && turn ? { x: size.width, y: turn.top ? 0 : size.height } : null
    const fold =
      turn && size && corner
        ? curlFold(
            corner,
            constrainCurlDrag(
              corner,
              curlDragPoint(corner, turn.p, turn.dy, size.height),
              size.height,
            ),
            size.width,
            size.height,
          )
        : null

    if (!turn || !size || !fold) {
      // At rest. A turn with no fold is a leaf lying flat: the leaf itself
      // (forward, not yet lifted) or what it covers once fully over.
      const base = current?.spread
        ? curlSpreadStart(shownRef.current)
        : shownRef.current
      const visible = new Set<number>()
      if (!turn) {
        visible.add(base)
        if (current?.spread) visible.add(base + 1)
      } else if (turn.p >= 1) {
        if (turn.under !== null) visible.add(turn.under)
        if (current?.spread) visible.add(turn.back)
      } else {
        visible.add(turn.leaf)
        if (turn.still !== null) visible.add(turn.still)
      }
      for (const [index, el] of fronts) {
        if (visible.has(index)) show(el, 2, '')
        else hide(el)
      }
      for (const [index, el] of backs) {
        // A fully turned spread leaf *is* the left page — its back shows.
        if (turn && turn.p >= 1 && current?.spread && index === turn.back) {
          show(el, 4, '')
          el.style.transform = `matrix(-1, 0, 0, 1, 0, 0)`
        } else hide(el)
      }
      if (shadow) shadow.style.opacity = '0'
      return
    }

    for (const [index, el] of fronts) {
      if (index === turn.under || index === turn.still) show(el, 1, '')
      else if (index === turn.leaf) show(el, 2, curlPolygonCss(fold.front))
      else hide(el)
    }
    const [a, b, c, d, e, f] = fold.matrix
    for (const [index, el] of backs) {
      if (index !== turn.back) {
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

  /** Where a turn in `direction` would land from the current position. */
  const targetOf = useCallback((direction: Direction): number | null => {
    return curlStepTarget(
      shownRef.current,
      direction === 'next' ? 1 : -1,
      settingsRef.current.pageCount,
      Boolean(layoutRef.current?.spread),
    )
  }, [])

  const beginTurn = useCallback(
    (direction: Direction, top: boolean, peek = false): Turn | null => {
      if (targetOf(direction) === null) return null
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
      const count = settingsRef.current.pageCount
      const exists = (page: number) => (page >= 0 && page < count ? page : null)
      let turn: Turn
      if (layoutRef.current?.spread) {
        // Spreads pair (s|s+1). Forward, the right leaf s+1 turns over and
        // its back is the next left page s+2; backward is the same turn of
        // the previous spread, played in reverse.
        const s = curlSpreadStart(shownRef.current)
        turn =
          direction === 'next'
            ? {
                direction,
                leaf: s + 1,
                back: s + 2,
                under: exists(s + 3),
                still: s,
                top,
                p: 0,
                dy: 0,
                landing: null,
                peek,
              }
            : {
                direction,
                leaf: s - 1,
                back: s,
                under: exists(s + 1),
                still: exists(s - 2),
                top,
                p: 1,
                dy: 0,
                landing: null,
                peek,
              }
      } else {
        const current = shownRef.current
        const leaf = direction === 'next' ? current : current - 1
        turn = {
          direction,
          leaf,
          back: leaf,
          under: direction === 'next' ? current + 1 : current,
          still: null,
          top,
          p: direction === 'next' ? 0 : 1,
          dy: 0,
          landing: null,
          peek,
        }
      }
      turnRef.current = turn
      return turn
    },
    [endTurn, targetOf],
  )

  const commit = useCallback(
    (turn: Turn, sound: boolean, announce: boolean) => {
      turn.landing = targetOf(turn.direction)
      if (turn.landing === null) return
      if (sound && settingsRef.current.soundEnabled) playPageTurnSound()
      if (announce) report(turn.landing)
    },
    [report, targetOf],
  )

  /** A whole turn from rest (or from a peek): tap, arrow button, keyboard. */
  const turnPage = useCallback(
    (
      direction: Direction,
      options: { top?: boolean; sound: boolean; announce: boolean },
    ) => {
      landInFlight()
      const target = targetOf(direction)
      if (target === null) return
      if (settingsRef.current.reducedMotion || !layoutRef.current) {
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
    [
      animate,
      beginTurn,
      commit,
      endTurn,
      landInFlight,
      paint,
      report,
      targetOf,
    ],
  )

  // ---- the reader's page index -----------------------------------------

  // The shell steps by what this book shows: a page, or a whole spread.
  useEffect(() => {
    setPageStep((from, direction) =>
      curlStepTarget(from, direction, pageCount, spread),
    )
    return () => setPageStep(null)
  }, [pageCount, setPageStep, spread])

  useEffect(() => {
    const isSpread = Boolean(layoutRef.current?.spread)
    const wanted = isSpread ? curlSpreadStart(pageIndex) : pageIndex
    const turn = turnRef.current
    if (turn?.landing === wanted) return
    const current = shownRef.current
    const currentBase = isSpread ? curlSpreadStart(current) : current
    // The facing page of the open spread is already on screen.
    if (!turn && wanted === currentBase) return
    landInFlight()
    if (turnRef.current) endTurn()
    const base = isSpread ? curlSpreadStart(shownRef.current) : shownRef.current
    if (wanted === base) return
    // A step from the keyboard or the pager turns the leaf, silently — only
    // the reader's own hand makes the paper sound. Jumps just open there.
    const stride = isSpread ? 2 : 1
    if (Math.abs(wanted - base) === stride) {
      turnPage(wanted > base ? 'next' : 'prev', {
        sound: false,
        announce: false,
      })
      return
    }
    shownRef.current = wanted
    setShown(wanted)
  }, [endTurn, landInFlight, pageIndex, spread, turnPage])

  // A layout switch (rotating a tablet between one page and a spread) or a
  // source swap lands any turn and re-anchors on the reading position.
  useEffect(() => {
    endTurn()
    const clamped = Math.min(Math.max(pageIndex, 0), Math.max(pageCount - 1, 0))
    const next = spread ? curlSpreadStart(clamped) : clamped
    if (next !== shownRef.current) {
      shownRef.current = next
      setShown(next)
    }
    // pageIndex is read, not tracked: the effect above follows it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTurn, pageCount, spread])

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

    /** Book coordinates — robust to CSS zoom and transforms on ancestors.
        A spread's book is two pages wide, spine in the middle. */
    const local = (clientX: number, clientY: number) => {
      const rect = book.getBoundingClientRect()
      const current = layoutRef.current
      const bookWidth = current
        ? current.size.width * (current.spread ? 2 : 1)
        : rect.width
      const bookHeight = current ? current.size.height : rect.height
      const sx = rect.width ? bookWidth / rect.width : 1
      const sy = rect.height ? bookHeight / rect.height : 1
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
      const current = layoutRef.current
      if (!current || settingsRef.current.reducedMotion) return
      const bookWidth = current.size.width * (current.spread ? 2 : 1)
      const nearEdgeY =
        pos.y < CURL_CORNER_PX || pos.y > current.size.height - CURL_CORNER_PX
      const direction: Direction | null =
        nearEdgeY &&
        pos.x > bookWidth - CURL_CORNER_PX &&
        targetOf('next') !== null
          ? 'next'
          : nearEdgeY &&
              pos.x >= 0 &&
              pos.x < CURL_CORNER_PX &&
              targetOf('prev') !== null
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
      const peek = beginTurn(direction, pos.y < current.size.height / 2, true)
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
      const current = layoutRef.current
      if (!current) return
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
        if (!beginTurn(direction, press.startY < current.size.height / 2)) {
          press.direction = null
          return
        }
        stopAnimation()
      }
      event.preventDefault()
      const turn = turnRef.current
      if (!turn || !press.direction || settingsRef.current.reducedMotion) return
      const width = current.size.width
      turn.p =
        press.direction === 'next'
          ? curlForwardProgress(press.startX, pos.x, width)
          : current.spread
            ? curlSpreadBackwardProgress(press.startX, pos.x, width)
            : curlBackwardProgress(press.startX, pos.x, width)
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
      const current = layoutRef.current
      if (!current) return

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
      const bookWidth = current.size.width * (current.spread ? 2 : 1)
      // On a spread each page is its own half: the right page goes on, the
      // left goes back.
      const intent = curlClickIntent(
        pos.x,
        bookWidth,
        targetOf('prev') !== null,
        targetOf('next') !== null,
      )
      if (!intent) return
      turnPage(intent, {
        top: pos.y < current.size.height / 2,
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
    targetOf,
    turnPage,
  ])

  useEffect(() => () => stopAnimation(), [stopAnimation])

  // ---- render ------------------------------------------------------------

  const mounted = curlMountWindow(shown, pageIndex, pageCount, spread)
  const width = layout?.size.width ?? 280
  const height = layout?.size.height ?? Math.round(280 * pageRatio)
  const bookWidth = spread ? width * 2 : width
  const base = spread ? curlSpreadStart(shown) : shown
  const canGoPrev = curlStepTarget(base, -1, pageCount, spread) !== null
  const canGoNext = curlStepTarget(base, 1, pageCount, spread) !== null
  // A leaf's slot: in a spread, even pages sit left of the spine and odd
  // pages right; a single page is bound on its left.
  const sideOf = (index: number): CurlLeafSide =>
    spread && index % 2 === 0 ? 'left' : 'right'
  // The right-hand slot, where the turning leaf and its fold live.
  const rightSlot = spread ? width : 0
  const isInView = (index: number) =>
    spread ? index === base || index === base + 1 : index === shown

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
        // A pointer affordance: keyboard readers have arrow keys and the
        // pager, so these stay out of the tab order.
        tabIndex={-1}
        data-book-preview-stage-arrow
        disabled={!canGoPrev}
        className="absolute top-1/2 left-1 z-10 hidden min-h-11 min-w-11 -translate-y-1/2 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
        data-book-preview-press
        onClick={() => turnPage('prev', { sound: true, announce: true })}
      >
        <IconChevronLeft />
      </Button>
      <div
        data-book-preview-curl
        data-spread={spread || undefined}
        className="relative max-h-full max-w-full min-w-0"
        style={{ opacity: layout ? 1 : 0 }}
      >
        {pageCount > 1 ? (
          <>
            {/* The book block: thin stacked page edges flanking the book,
                thickest where the most leaves sit. Purely decorative. */}
            <div
              aria-hidden
              data-book-preview-curl-edge="prev"
              style={{ width: curlEdgeWidth(base) }}
            />
            <div
              aria-hidden
              data-book-preview-curl-edge="next"
              style={{
                width: curlEdgeWidth(pageCount - 1 - base - (spread ? 1 : 0)),
              }}
            />
          </>
        ) : null}
        <div
          ref={bookRef}
          data-book-preview-curl-book
          data-bp-tap-surface
          className="relative touch-pan-y overflow-hidden"
          style={{ width: bookWidth, height }}
        >
          {spread ? (
            // The inside of the back cover: plain paper under the last
            // leaf, so a lone final page never sits beside a hole.
            <div
              aria-hidden
              data-book-preview-curl-endpaper
              className="pointer-events-none absolute top-0 z-0"
              style={{ left: width, width, height, backgroundColor: leafBack }}
            />
          ) : null}
          {mounted.map((index) => (
            <div
              key={`front-${index}`}
              ref={(node) => {
                if (node) frontsRef.current.set(index, node)
                else frontsRef.current.delete(index)
              }}
              data-book-preview-curl-leaf={index}
              inert={!isInView(index)}
              aria-hidden={!isInView(index) || undefined}
              className="absolute top-0 overflow-hidden"
              style={{
                visibility: 'hidden',
                left: sideOf(index) === 'left' || !spread ? 0 : width,
                width,
                height,
              }}
            >
              {renderPage(index, sideOf(index))}
            </div>
          ))}
          {/* The fold lives in the right-hand page's own coordinates. */}
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 z-[3]"
            style={{ left: rightSlot, width, height }}
          >
            <div
              ref={shadowRef}
              data-book-preview-curl-shadow
              className="absolute top-0 left-0 origin-top-left"
              style={{ opacity: 0 }}
            />
          </div>
          {/* A filter on the clipped back itself would be clipped away with
              it; on this wrapper it traces the lifted flap's edge, so white
              paper still reads against white paper. */}
          <div
            data-book-preview-curl-backs
            className="pointer-events-none absolute inset-0 z-[4]"
          >
            {mounted.map((index) =>
              // Single pages show their own face through the paper; a
              // spread's leaf carries the next left page on its back.
              spread && index % 2 === 1 ? null : (
                <div
                  key={`back-${index}`}
                  ref={(node) => {
                    if (node) backsRef.current.set(index, node)
                    else backsRef.current.delete(index)
                  }}
                  aria-hidden
                  inert
                  data-book-preview-curl-back
                  className="absolute top-0 origin-top-left overflow-hidden"
                  style={{
                    visibility: 'hidden',
                    left: rightSlot,
                    width,
                    height,
                    backgroundColor: leafBack,
                  }}
                >
                  {spread ? (
                    // Drawn mirrored, so the fold's mirror lands it reading
                    // the right way round on the left of the spine.
                    <div className="absolute inset-0 -scale-x-100">
                      {renderPage(index, 'left')}
                    </div>
                  ) : (
                    <div className="absolute inset-0 opacity-[0.07]">
                      {renderPage(index, 'right')}
                    </div>
                  )}
                  <div
                    data-book-preview-curl-gloss
                    className="absolute top-0 left-0 origin-top-left"
                  />
                </div>
              ),
            )}
          </div>
          {spread ? (
            <div
              aria-hidden
              data-book-preview-curl-spine
              className="pointer-events-none absolute top-0 z-[2]"
              style={{ left: width - 12, width: 24, height }}
            />
          ) : null}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next page"
        // A pointer affordance: keyboard readers have arrow keys and the
        // pager, so these stay out of the tab order.
        tabIndex={-1}
        data-book-preview-stage-arrow
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
