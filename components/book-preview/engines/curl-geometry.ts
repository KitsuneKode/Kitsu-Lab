export const CURL_MIN_PAGE_WIDTH = 220 // phone-readable floor
export const CURL_MAX_PAGE_WIDTH = 1400
export const CURL_PAGE_RATIO = 530 / 370
export const CURL_RASTER_WIDTH = 960
export const CURL_RASTER_HEIGHT = Math.round(
  CURL_RASTER_WIDTH * CURL_PAGE_RATIO,
)
export const CURL_SIZE_QUANTUM = 16
export const CURL_CLICK_SLOP_PX = 24
/** Touch jitter is looser than a mouse click — but the first pixels of a
    flick should already be turning the page, not sitting in a dead zone. */
export const CURL_TOUCH_SLOP_PX = 10
/** Mirrors page-flip's own swipe heuristic: a fast, mostly-horizontal flick
    turns the page even when it never reached the fold midpoint. */
export const CURL_SWIPE_MIN_PX = 30
export const CURL_SWIPE_MAX_OFF_AXIS_PX = 60
export const CURL_SWIPE_MAX_MS = 250
/** A spread is only worth showing if each leaf stays comfortably readable. */
export const CURL_SPREAD_MIN_PAGE_WIDTH = 260
export const CURL_STAGE_PAD_X = 24
export const CURL_FLIP_MS = 640
/**
 * A flip book owns every leaf at once: all pages rasterize up front and all
 * stay mounted. Past this count the "delight" mode is a memory and startup
 * liability — the reader should be told to use Scroll or PDF instead.
 */
export const CURL_MAX_PAGES = 160

export type CurlPageSize = {
  width: number
  height: number
}

export type CurlClickIntent = 'prev' | 'next'

export type CurlPoint = { x: number; y: number }

/**
 * Whether the stage can show two facing pages.
 *
 * page-flip chooses its own orientation: with `size: "fixed"` it lays out a
 * spread once the host is at least twice a page wide, and drops to a single
 * portrait page otherwise. So this decides the host width and the library
 * follows -- there is no orientation flag to fight.
 */
/**
 * Two-page spread is DISABLED pending a page-flip fix. Flip to `true` to
 * re-enable once the freeze below is resolved.
 *
 * The spread itself renders correctly -- verified in Chrome: facing pages,
 * correct fold, `.stf__parent` at exactly two leaves, no overflow. But with
 * landscape active, page-flip can lock the renderer (a synchronous loop in its
 * own layout code -- React reports no "maximum update depth", and the tab stops
 * responding to CDP entirely). It reproduced three times and never once with
 * portrait. Until that is understood, shipping a reader that can hang the tab
 * is not worth a nicer layout.
 */
export const CURL_SPREAD_ENABLED = false

export function curlSpreadFitsStage(clientWidth: number): boolean {
  if (!CURL_SPREAD_ENABLED) return false
  return (clientWidth - CURL_STAGE_PAD_X) / 2 >= CURL_SPREAD_MIN_PAGE_WIDTH
}

/** Pages sit in fixed pairs, so a jump within the open spread changes nothing. */
export function curlSameSpread(a: number, b: number, spread: boolean): boolean {
  if (!spread) return a === b
  return Math.floor(a / 2) === Math.floor(b / 2)
}

/** "14-15" while a spread is open, "14" on a single page or a lone last leaf. */
export function curlPageLabel(
  pageIndex: number,
  totalPages: number,
  spread: boolean,
): string {
  if (!spread) return String(pageIndex + 1)
  const left = pageIndex - (pageIndex % 2)
  if (left + 1 > totalPages - 1) return String(left + 1)
  return `${left + 1}\u2013${left + 2}`
}

export function curlPageSizeForStage(
  clientWidth: number,
  clientHeight: number,
  ratio: number = CURL_PAGE_RATIO,
  spread = false,
) {
  const padX = CURL_STAGE_PAD_X
  const padY = 36
  // A spread holds two leaves side by side, so each gets half the stage.
  const usable = spread ? (clientWidth - padX) / 2 : clientWidth - padX
  const availW = Math.max(1, Math.floor(usable))
  if (clientHeight < 80) {
    const width = Math.min(availW, 360)
    return { width, height: Math.round(width * ratio) }
  }
  const availH = Math.max(1, Math.floor(clientHeight - padY))
  const width = Math.min(
    CURL_MAX_PAGE_WIDTH,
    availW,
    Math.floor(availH / ratio),
  )
  // Floor at the readable minimum only when it still fits both axes — a
  // clipped page reads as broken, a small one just reads small.
  const minFits =
    CURL_MIN_PAGE_WIDTH <= availW &&
    Math.round(CURL_MIN_PAGE_WIDTH * ratio) <= availH
  const finalWidth =
    width < CURL_MIN_PAGE_WIDTH && minFits ? CURL_MIN_PAGE_WIDTH : width
  return { width: finalWidth, height: Math.round(finalWidth * ratio) }
}

export function quantizeCurlPageSize(
  size: CurlPageSize,
  ratio: number = CURL_PAGE_RATIO,
): CurlPageSize {
  // Floor, never round up: a width snapped past the measured stage would
  // overflow the viewport and clip the page edge.
  const width = Math.max(
    1,
    Math.floor(size.width / CURL_SIZE_QUANTUM) * CURL_SIZE_QUANTUM,
  )
  return { width, height: Math.round(width * ratio) }
}

export function curlClickIntent(
  x: number,
  width: number,
  canGoPrev: boolean,
  canGoNext: boolean,
): CurlClickIntent | null {
  if (!canGoPrev && !canGoNext) return null
  // Halves, not thirds: in fullscreen the reader chrome claims the middle
  // band first (tapConsumedByChrome), and outside it there is no chrome to
  // give the middle to, so the whole page stays a turn target.
  const preferPrev = width > 0 && x < width / 2
  if (preferPrev) return canGoPrev ? 'prev' : 'next'
  return canGoNext ? 'next' : 'prev'
}

/** A released fold turns the page once it has travelled this far (0–100,
    page-flip's own progress scale, where 50 is the spine). page-flip itself
    only turns past the spine — on a phone that is the far left edge of the
    screen, so most honest drags snapped back. */
export const CURL_COMMIT_PROGRESS = 25

/** px/ms toward the turn that counts as a flick regardless of distance.
    Between Sonner's 0.11 swipe-dismiss and a deliberate slow drag (~0.1),
    so a quick thumb flick always turns and an unhurried release reads by
    distance. */
export const CURL_COMMIT_VELOCITY = 0.2

/**
 * Whether a released fold completes the turn. `towardVelocity` is the
 * release velocity in the direction that finishes the turn (px/ms, negative
 * when the finger was pulling back). A clear flick back always cancels, a
 * flick forward always commits, otherwise distance decides.
 */
export function curlShouldCommit(
  progress: number,
  towardVelocity: number,
): boolean {
  if (towardVelocity <= -CURL_COMMIT_VELOCITY) return false
  if (towardVelocity >= CURL_COMMIT_VELOCITY) return true
  return progress >= CURL_COMMIT_PROGRESS
}

/** Release velocity (px/ms) from recent samples — the last ~80ms only, so a
    drag that paused before lifting reads as still, not as a flick. */
export function curlReleaseVelocity(
  samples: readonly { x: number; t: number }[],
  windowMs = 80,
): number {
  if (samples.length < 2) return 0
  const last = samples[samples.length - 1]
  let first = last
  for (let index = samples.length - 2; index >= 0; index -= 1) {
    if (last.t - samples[index].t > windowMs) break
    first = samples[index]
  }
  const dt = last.t - first.t
  return dt > 0 ? (last.x - first.x) / dt : 0
}

export function curlDragOrigin(
  start: CurlPoint,
  current: CurlPoint,
  width: number,
): CurlPoint {
  const goingPrev = current.x - start.x > 4
  if (goingPrev) {
    return { x: Math.min(start.x, width * 0.12), y: start.y }
  }
  return { x: Math.max(start.x, width * 0.88), y: start.y }
}
