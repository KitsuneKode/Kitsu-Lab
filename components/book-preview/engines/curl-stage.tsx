'use client'

import {
  Children,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { PageFlip } from 'page-flip/dist/js/page-flip.module.js'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { playPageTurnSound } from '../audio'
import { useStableHandler } from '../hooks/use-stable-handler'
import { tapConsumedByChrome } from '../hooks/use-immersive-chrome'
import {
  CURL_CLICK_SLOP_PX,
  CURL_FLIP_MS,
  CURL_MAX_PAGE_WIDTH,
  CURL_MIN_PAGE_WIDTH,
  CURL_PAGE_RATIO,
  CURL_TOUCH_SLOP_PX,
  curlClickIntent,
  curlDragOrigin,
  curlPageLabel,
  curlPageSizeForStage,
  curlReleaseVelocity,
  curlSameSpread,
  curlShouldCommit,
  curlSpreadFitsStage,
  quantizeCurlPageSize,
  type CurlPageSize,
  type CurlPoint,
} from './curl-geometry'

type CurlStageProps = {
  pageIndex: number
  /** height / width of a sheet. Defaults to the paper-book ratio; PDF sources
      pass their own so the book matches the document instead of letterboxing. */
  pageRatio?: number
  canGoPrev: boolean
  canGoNext: boolean
  reducedMotion: boolean
  soundEnabled: boolean
  contentKey?: string
  onPageChange: (pageIndex: number) => void
  onEngineError: (message: string) => void
  children: ReactNode
}

type CurlFlipSettings = {
  width: number
  height: number
  minWidth: number
  maxWidth: number
  minHeight: number
  maxHeight: number
}

type CurlFlipBook = {
  loadFromHTML: (items: HTMLElement[]) => void
  updateFromHtml: (items: HTMLElement[]) => void
  destroy: () => void
  update: () => void
  flip: (page: number) => void
  flipNext: (corner?: string) => void
  flipPrev: (corner?: string) => void
  turnToPage: (page: number) => void
  startUserTouch: (pos: CurlPoint) => void
  userMove: (pos: CurlPoint, isTouch: boolean) => void
  userStop: (pos: CurlPoint, isSwipe?: boolean) => void
  getCurrentPageIndex: () => number
  getPageCount: () => number
  getState: () => string
  getSettings: () => CurlFlipSettings
  getUI: () => { getDistElement: () => HTMLElement }
  on: (event: string, callback: (event: { data: unknown }) => void) => void
  off: (event: string) => void
}

function asCurlBook(book: PageFlip): CurlFlipBook {
  return book as unknown as CurlFlipBook
}

function htmlPagesFrom(source: HTMLElement) {
  return Array.from(source.children).filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  )
}

function pointIn(el: HTMLElement, clientX: number, clientY: number) {
  const rect = el.getBoundingClientRect()
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    width: rect.width,
    height: rect.height,
  }
}

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

function applyCurlSize(
  book: CurlFlipBook,
  host: HTMLElement,
  size: CurlPageSize,
  spread: boolean,
) {
  const settings = book.getSettings()
  settings.width = size.width
  settings.height = size.height
  settings.minWidth = size.width
  settings.maxWidth = size.width
  settings.minHeight = size.height
  settings.maxHeight = size.height
  // page-flip reads the host box to pick its orientation: two leaves wide
  // means a spread, one means a single portrait page.
  const hostWidth = spread ? size.width * 2 : size.width
  host.style.width = `${hostWidth}px`
  host.style.height = `${size.height}px`
  host.style.minWidth = `${hostWidth}px`
  host.style.minHeight = `${size.height}px`
  book.update()
}

/** The slice of page-flip's internals the release path needs. page-flip
    (2.0.7, unmaintained) has no public "finish this fold from where it is"
    call: userStop() only turns past the spine and swipes restart the turn
    from the page edge — the snap-back-then-flip jolt. These members are
    stable in the published build; if they ever vanish, the fallback is
    page-flip's own stopMove. */
type CurlFlipController = {
  getCalculation: () => {
    getPosition: () => CurlPoint
    getFlippingProgress: () => number
    getDirection: () => number
    getCorner: () => string
  } | null
  getBoundsRect?: () => { pageWidth: number; height: number }
  animateFlippingTo?: (
    start: CurlPoint,
    dest: CurlPoint,
    isTurned: boolean,
    needReset?: boolean,
  ) => void
}

/** page-flip's FlipDirection.BACK */
const CURL_DIRECTION_BACK = 1

/**
 * Ends a user fold: completes or cancels the turn from the fold's current
 * position, so the page keeps moving the way the finger left it.
 * `velocityX` is the release velocity in px/ms (negative = leftward).
 */
function releaseCurlFold(
  book: CurlFlipBook,
  pos: CurlPoint,
  velocityX: number,
  onCommit: () => void,
) {
  const controller = (
    book as unknown as { getFlipController?: () => CurlFlipController }
  ).getFlipController?.()
  const calc = controller?.getCalculation()
  if (!controller || !calc) {
    // No turn was ever computed (a drag past the first or last page):
    // page-flip entered 'user_fold' but has nothing to finish, and its own
    // stopMove bails on a null calc — leaving the book "busy" forever.
    book.userStop(pos, true)
    const internals = controller as unknown as {
      setState?: (state: string) => void
      reset?: () => void
    } | null
    internals?.reset?.()
    internals?.setState?.('read')
    return
  }
  if (
    typeof controller.animateFlippingTo !== 'function' ||
    typeof controller.getBoundsRect !== 'function'
  ) {
    book.userStop(pos)
    return
  }
  // Forward turns finish leftward, back turns rightward.
  const toward =
    calc.getDirection() === CURL_DIRECTION_BACK ? velocityX : -velocityX
  const commit = curlShouldCommit(calc.getFlippingProgress(), toward)
  // Clears page-flip's touch flag without letting it pick the outcome.
  book.userStop(pos, true)
  if (commit) onCommit()
  const rect = controller.getBoundsRect()
  const y = calc.getCorner() === 'bottom' ? rect.height : 0
  controller.animateFlippingTo(
    calc.getPosition(),
    { x: commit ? -rect.pageWidth : rect.pageWidth, y },
    commit,
  )
}

function attachCurlPointers(
  book: CurlFlipBook,
  interacting: { current: boolean },
  /** A drag that lets go past the threshold — the moment a real page lands. */
  onDragCommit: () => void,
) {
  const dist = book.getUI().getDistElement()
  const press = {
    pointerId: -1,
    startX: 0,
    startY: 0,
    slop: CURL_CLICK_SLOP_PX,
    isTouch: false,
    dragging: false,
    /** Pressed while a turn was animating — a tap still counts (it queues
        the next turn), but it may not grab the moving page. */
    duringFlip: false,
    last: { x: 0, y: 0 },
    samples: [] as { x: number; t: number }[],
  }

  const onPointerDown = (event: PointerEvent) => {
    if (event.button !== 0 || press.pointerId !== -1) return
    if (isInteractiveTarget(event.target)) return
    const pos = pointIn(dist, event.clientX, event.clientY)
    press.pointerId = event.pointerId
    press.startX = pos.x
    press.startY = pos.y
    press.last = { x: pos.x, y: pos.y }
    press.samples = [{ x: pos.x, t: event.timeStamp }]
    press.isTouch = event.pointerType === 'touch'
    press.slop = press.isTouch ? CURL_TOUCH_SLOP_PX : CURL_CLICK_SLOP_PX
    press.dragging = false
    // 'user_fold' with no finger down is a released fold still animating
    // home — grabbing it would fight the animation for the same page.
    const state = book.getState()
    press.duringFlip = state === 'flipping' || state === 'user_fold'
    interacting.current = true
    try {
      dist.setPointerCapture(event.pointerId)
    } catch {
      // Capture is best-effort; window listeners still finish the gesture.
    }
    event.preventDefault()
  }

  const onPointerMove = (event: PointerEvent) => {
    if (press.pointerId !== event.pointerId) return
    event.preventDefault()
    const pos = pointIn(dist, event.clientX, event.clientY)
    press.last = { x: pos.x, y: pos.y }
    press.samples.push({ x: pos.x, t: event.timeStamp })
    if (press.samples.length > 12) press.samples.shift()
    if (!press.dragging) {
      if (press.duringFlip) return
      // Touch folds need horizontal intent: with pan-y touch-action a
      // mostly-vertical gesture belongs to the page scroller, not the fold —
      // starting one here would snap back on the inevitable pointercancel.
      // Mouse has no competing gesture, so any direction can peel a corner.
      const distance = press.isTouch
        ? Math.abs(pos.x - press.startX)
        : Math.hypot(pos.x - press.startX, pos.y - press.startY)
      if (distance < press.slop) return
      // Nothing to peel past the covers: a drag that would turn beyond the
      // first or last page is ignored rather than started and stranded.
      const goingPrev = pos.x - press.startX > 0
      const index = book.getCurrentPageIndex()
      if (
        (goingPrev && index <= 0) ||
        (!goingPrev && index >= book.getPageCount() - 1)
      ) {
        return
      }
      press.dragging = true
      book.startUserTouch(
        curlDragOrigin(
          { x: press.startX, y: press.startY },
          { x: pos.x, y: pos.y },
          pos.width,
        ),
      )
    }
    book.userMove({ x: pos.x, y: pos.y }, true)
  }

  const finish = (event: PointerEvent) => {
    if (press.pointerId !== event.pointerId) return
    // pointercancel often reports 0,0 — the last real position is the truth.
    const pos =
      event.type === 'pointercancel'
        ? { ...pointIn(dist, 0, 0), ...press.last }
        : pointIn(dist, event.clientX, event.clientY)
    if (event.type !== 'pointercancel') {
      press.samples.push({ x: pos.x, t: event.timeStamp })
    }
    const dragging = press.dragging
    const velocity = curlReleaseVelocity(press.samples)
    press.pointerId = -1
    press.dragging = false
    if (dist.hasPointerCapture(event.pointerId)) {
      dist.releasePointerCapture(event.pointerId)
    }
    if (dragging) {
      // Every release — slow drag, flick, or a browser-interrupted gesture —
      // finishes from where the page is, in the direction it was going.
      releaseCurlFold(
        book,
        { x: pos.x, y: pos.y },
        event.type === 'pointercancel' ? 0 : velocity,
        onDragCommit,
      )
      return
    }
    interacting.current = false
    if (event.type === 'pointercancel') return
    // A tap only counts if the pointer barely moved at all — a mostly
    // vertical release is a scroll gesture, not a turn request — and the
    // reader chrome did not already spend it on showing or hiding itself.
    if (Math.hypot(pos.x - press.startX, pos.y - press.startY) >= press.slop) {
      return
    }
    if (tapConsumedByChrome()) return
    const intent = curlClickIntent(
      pos.x,
      pos.width,
      book.getCurrentPageIndex() > 0,
      book.getCurrentPageIndex() < book.getPageCount() - 1,
    )
    if (!intent) return
    const corner = pos.y < pos.height / 2 ? 'top' : 'bottom'
    // A tap during a turn finishes that turn instantly and starts the next —
    // a fast reader is never made to wait for the animation.
    if (intent === 'prev') book.flipPrev(corner)
    else book.flipNext(corner)
  }

  // Hovering a corner lifts it slightly -- the affordance that teaches the
  // drag. page-flip only runs this path when told the move is not a touch,
  // and it resets itself the moment the pointer is off the corner.
  const onHoverCorner = (event: PointerEvent) => {
    if (press.pointerId !== -1 || event.pointerType !== 'mouse') return
    if (book.getState() === 'flipping') return
    const pos = pointIn(dist, event.clientX, event.clientY)
    book.userMove({ x: pos.x, y: pos.y }, false)
  }

  const onLeaveCorner = (event: PointerEvent) => {
    if (press.pointerId !== -1 || event.pointerType !== 'mouse') return
    if (book.getState() === 'flipping') return
    const rect = dist.getBoundingClientRect()
    // Centre of the sheet is off every corner, which drops the peek.
    book.userMove({ x: rect.width / 2, y: rect.height / 2 }, false)
  }

  dist.addEventListener('pointerdown', onPointerDown, { passive: false })
  dist.addEventListener('pointermove', onHoverCorner)
  dist.addEventListener('pointerleave', onLeaveCorner)
  window.addEventListener('pointermove', onPointerMove, { passive: false })
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)

  return () => {
    dist.removeEventListener('pointerdown', onPointerDown)
    dist.removeEventListener('pointermove', onHoverCorner)
    dist.removeEventListener('pointerleave', onLeaveCorner)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
  }
}

function useCurlBook({
  pageIndex,
  pageRatio,
  pageSize,
  spread,
  pageCount,
  reducedMotion,
  soundEnabled,
  contentKey,
  onPageChange,
  onEngineError,
}: {
  pageIndex: number
  pageRatio: number
  pageSize: CurlPageSize | null
  spread: boolean
  pageCount: number
  reducedMotion: boolean
  soundEnabled: boolean
  contentKey?: string
  onPageChange: (page: number) => void
  onEngineError: (message: string) => void
}) {
  const sourceRef = useRef<HTMLDivElement | null>(null)
  const hostWrapRef = useRef<HTMLDivElement | null>(null)
  const bookRef = useRef<CurlFlipBook | null>(null)
  const flippingRef = useRef(false)
  const fromBookRef = useRef(false)
  const interactingRef = useRef(false)
  const pageIndexRef = useRef(pageIndex)
  const soundRef = useRef(soundEnabled)
  const contentKeyRef = useRef(contentKey)
  const pageRatioRef = useRef(pageRatio)
  // A turn the reader did not physically perform (arrow keys, slider scrub,
  // contents jump) should stay silent; only gestures and stage buttons sound.
  const programmaticRef = useRef(false)
  const reportPageChange = useStableHandler(onPageChange)
  const reportEngineError = useStableHandler(onEngineError)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  /** Orientation the live book was actually built with. */
  const [builtSpread, setBuiltSpread] = useState(false)
  const hasStage = pageSize !== null

  useEffect(() => {
    pageIndexRef.current = pageIndex
    soundRef.current = soundEnabled
    pageRatioRef.current = pageRatio
  })

  useLayoutEffect(() => {
    const wrap = hostWrapRef.current
    const source = sourceRef.current
    const size = pageSize
    if (!wrap || !source || !size || pageCount === 0) return

    const pages = htmlPagesFrom(source)
    if (pages.length === 0) {
      reportEngineError('The page-curl engine needs at least one page.')
      return
    }

    const host = document.createElement('div')
    // Sized before PageFlip reads the box, so it picks the right orientation
    // on the very first layout instead of flashing a single page.
    host.style.width = `${spread ? size.width * 2 : size.width}px`
    host.style.height = `${size.height}px`
    wrap.replaceChildren(host)

    let book: CurlFlipBook
    let detachPointers = () => {}
    try {
      book = asCurlBook(
        new PageFlip(host, {
          width: size.width,
          height: size.height,
          size: 'fixed',
          minWidth: CURL_MIN_PAGE_WIDTH,
          maxWidth: CURL_MAX_PAGE_WIDTH,
          minHeight: Math.round(CURL_MIN_PAGE_WIDTH * pageRatioRef.current),
          maxHeight: Math.round(CURL_MAX_PAGE_WIDTH * pageRatioRef.current),
          showCover: false,
          drawShadow: !reducedMotion,
          flippingTime: reducedMotion ? 1 : CURL_FLIP_MS,
          usePortrait: true,
          // The lifted corner is the affordance that teaches the drag; without it
          // a curl book reads as a static image until someone guesses.
          showPageCorners: !reducedMotion,
          maxShadowOpacity: reducedMotion ? 0 : 0.55,
          startZIndex: 1,
          startPage: pageIndexRef.current,
          autoSize: false,
          mobileScrollSupport: false,
          clickEventForward: true,
          useMouseEvents: false,
          disableFlipByClick: false,
          swipeDistance: 30,
        }),
      )
      const clones = pages.map((page) => page.cloneNode(true) as HTMLElement)
      book.loadFromHTML(clones)
      detachPointers = attachCurlPointers(book, interactingRef, () => {
        // Drag turns finish through page-flip's fold state, never its
        // "flipping" one, so they sound here rather than in changeState.
        if (soundRef.current) playPageTurnSound()
      })
    } catch (error) {
      wrap.replaceChildren()
      reportEngineError(
        error instanceof Error
          ? error.message
          : 'The page-curl engine could not start.',
      )
      return
    }

    contentKeyRef.current = contentKey
    book.on('flip', (event) => {
      fromBookRef.current = true
      reportPageChange(
        typeof event.data === 'number' ? event.data : pageIndexRef.current,
      )
    })
    book.on('changeState', (event) => {
      const state = String(event.data)
      const turning = state === 'flipping' || state === 'user_fold'
      flippingRef.current = turning
      interactingRef.current = turning
      setBusy(turning)
      if (
        soundRef.current &&
        state === 'flipping' &&
        !programmaticRef.current
      ) {
        playPageTurnSound()
      }
      if (!turning) programmaticRef.current = false
    })

    bookRef.current = book
    // The book was just constructed with this orientation -- readiness is
    // external state, so the UI has to be told what was actually built.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBuiltSpread(spread)
    // The flip book initialized in this effect — readiness is external state.
    setReady(true)

    return () => {
      setReady(false)
      setBusy(false)
      bookRef.current = null
      flippingRef.current = false
      interactingRef.current = false
      detachPointers()
      try {
        book.off('flip')
        book.off('changeState')
        book.destroy()
      } catch {
        // PageFlip.remove() can run after the wrapper is already gone.
      }
      wrap.replaceChildren()
    }
    // contentKey/pageSize changes are handled incrementally by the layout
    // effects below — rebuilding the book for them would lose flip state.
    // `spread` is a dependency on purpose. page-flip derives its orientation by
    // measuring the host, so changing that box under a live instance makes it
    // re-measure and flip back -- an infinite portrait/landscape oscillation
    // that locks the main thread. Building a fresh book settles it once.
    // Orientation is intentionally not a dependency; see CURL_SPREAD_ENABLED.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasStage, pageCount, reducedMotion, reportEngineError, reportPageChange])

  useLayoutEffect(() => {
    const book = bookRef.current
    const wrap = hostWrapRef.current
    if (!book || !wrap || !pageSize || !ready) return
    // Re-measuring under a live fold freezes it mid-turn — and on phones the
    // browser toolbar collapsing during a swipe resizes the stage constantly.
    // `busy` is a dependency, so the resize lands the moment the turn ends.
    if (busy || flippingRef.current) return
    const host = wrap.firstElementChild
    if (!(host instanceof HTMLElement)) return
    const settings = book.getSettings()
    // Orientation changes rebuild the book above; this only rescales within
    // the current orientation.
    if (
      settings.width === pageSize.width &&
      settings.height === pageSize.height
    )
      return
    applyCurlSize(book, host, pageSize, builtSpread)
  }, [pageSize, ready, builtSpread, busy])

  useLayoutEffect(() => {
    const book = bookRef.current
    const source = sourceRef.current
    if (!book || !source || !ready) return
    // Swapping sheets under a turn strands the fold; wait for it to land.
    if (busy || flippingRef.current) return
    if (contentKeyRef.current === contentKey) return
    const pages = htmlPagesFrom(source)
    if (pages.length === 0) return
    contentKeyRef.current = contentKey
    try {
      book.updateFromHtml(
        pages.map((page) => page.cloneNode(true) as HTMLElement),
      )
    } catch {
      // Keep the current sheets rather than tearing the book down.
    }
  }, [contentKey, ready, busy])

  useLayoutEffect(() => {
    if (!ready) return
    const source = sourceRef.current
    const wrap = hostWrapRef.current
    const book = bookRef.current
    if (!source || !wrap) return
    const liveImgs = source.querySelectorAll('img')
    const cloneImgs = wrap.querySelectorAll('img')
    const cloneMissingPaintedPage = Array.from(liveImgs).some((img, index) => {
      const clone = cloneImgs[index]
      return Boolean(img.src) && !(clone instanceof HTMLImageElement)
    })
    if (cloneMissingPaintedPage && book) {
      // Bitmaps keep arriving while a PDF rasterizes; rebuilding the sheets
      // mid-turn is exactly the frozen half-fold. This effect runs on every
      // render, and the turn ending re-renders, so it catches up then.
      if (flippingRef.current || interactingRef.current) return
      const pages = htmlPagesFrom(source)
      if (pages.length === 0) return
      try {
        book.updateFromHtml(
          pages.map((page) => page.cloneNode(true) as HTMLElement),
        )
      } catch {
        // Keep the current sheets rather than tearing the book down.
      }
      return
    }
    liveImgs.forEach((img, index) => {
      const clone = cloneImgs[index]
      if (
        clone instanceof HTMLImageElement &&
        img.src &&
        clone.src !== img.src
      ) {
        clone.src = img.src
      }
    })
  })

  useEffect(() => {
    if (fromBookRef.current) {
      fromBookRef.current = false
      return
    }
    if (flippingRef.current || interactingRef.current) return
    const book = bookRef.current
    if (!book) return
    const current = book.getCurrentPageIndex()
    // Both leaves of a spread are already visible, so selecting the facing
    // page must not animate a turn to the sheet you are looking at.
    if (curlSameSpread(current, pageIndex, builtSpread)) return
    programmaticRef.current = true
    const step = builtSpread ? 2 : 1
    if (Math.abs(current - pageIndex) <= step && !reducedMotion) {
      book.flip(pageIndex)
      return
    }
    book.turnToPage(pageIndex)
  }, [pageIndex, reducedMotion, builtSpread])

  return { sourceRef, hostWrapRef, bookRef, ready, busy, builtSpread }
}

export function CurlStage({
  pageIndex,
  pageRatio = CURL_PAGE_RATIO,
  canGoPrev,
  canGoNext,
  reducedMotion,
  soundEnabled,
  contentKey,
  onPageChange,
  onEngineError,
  children,
}: CurlStageProps) {
  const [pageSize, setPageSize] = useState<CurlPageSize | null>(null)
  const [spread, setSpread] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const pageCount = Children.count(children)

  useEffect(() => {
    const node = stageRef.current
    if (!node || typeof ResizeObserver === 'undefined') return
    let frame = 0
    const update = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        measure()
      })
    }
    const measure = () => {
      const wantsSpread = curlSpreadFitsStage(node.clientWidth)
      const next = quantizeCurlPageSize(
        curlPageSizeForStage(
          node.clientWidth,
          node.clientHeight,
          pageRatio,
          wantsSpread,
        ),
        pageRatio,
      )
      setSpread(wantsSpread)
      setPageSize((current) =>
        current &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      )
    }
    measure()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [pageRatio])

  const { sourceRef, hostWrapRef, bookRef, ready, busy, builtSpread } =
    useCurlBook({
      pageIndex,
      pageRatio,
      pageSize,
      spread,
      pageCount,
      reducedMotion,
      soundEnabled,
      contentKey,
      onPageChange,
      onEngineError,
    })

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
        disabled={!canGoPrev || !ready || busy}
        className="absolute top-1/2 left-1 z-10 hidden min-h-11 min-w-11 -translate-y-1/2 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
        data-book-preview-press
        onClick={() => bookRef.current?.flipPrev()}
      >
        <IconChevronLeft />
      </Button>
      <div
        data-book-preview-curl
        className="relative max-h-full max-w-full min-w-0"
      >
        <div
          ref={sourceRef}
          hidden
          inert
          aria-hidden
          className="pointer-events-none absolute size-0 overflow-hidden"
        >
          {children}
        </div>
        {ready && pageCount > 1 ? (
          <>
            {/* The book block: thin stacked page edges flanking the live
                page, thickest where the most leaves sit. Purely decorative —
                the corner drag, tap zones, and arrows do the turning. */}
            <div
              aria-hidden
              data-book-preview-curl-edge="prev"
              style={{ width: curlEdgeWidth(pageIndex) }}
            />
            <div
              aria-hidden
              data-book-preview-curl-edge="next"
              style={{ width: curlEdgeWidth(pageCount - 1 - pageIndex) }}
            />
          </>
        ) : null}
        <div
          ref={hostWrapRef}
          data-book-preview-curl-book
          data-bp-tap-surface
          className="relative cursor-grab touch-pan-y active:cursor-grabbing"
          // A spread is two leaves wide. Sizing this box for one leaf leaves the
          // book overflowing its own container instead of sitting centred.
          style={
            pageSize
              ? {
                  width: pageSize.width * (builtSpread ? 2 : 1),
                  height: pageSize.height,
                }
              : { width: 280, height: Math.round(280 * pageRatio) }
          }
        />
        {!ready ? (
          <div className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
            <Spinner />
            Loading curl engine…
          </div>
        ) : null}
        {ready ? (
          <p
            data-book-preview-curl-label
            className="text-muted-foreground pointer-events-none absolute inset-x-0 bottom-1 text-center font-mono text-xs"
          >
            {curlPageLabel(pageIndex, pageCount, builtSpread)}
          </p>
        ) : null}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Next page"
        disabled={!canGoNext || !ready || busy}
        className="absolute top-1/2 right-1 z-10 hidden min-h-11 min-w-11 -translate-y-1/2 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
        data-book-preview-press
        onClick={() => bookRef.current?.flipNext()}
      >
        <IconChevronRight />
      </Button>
    </div>
  )
}
