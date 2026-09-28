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
export const CURL_STAGE_PAD_X = 24
/** A spread is only worth showing if each leaf stays comfortably readable. */
export const CURL_SPREAD_MIN_PAGE_WIDTH = 260
/** …and if showing two pages barely shrinks them: a landscape laptop or
    iPad, not a portrait phone where each leaf would be half as tall. */
export const CURL_SPREAD_MIN_HEIGHT_SHARE = 0.85

export type CurlPageSize = {
  width: number
  height: number
}

export type CurlClickIntent = 'prev' | 'next'

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
  // On the cover a tap anywhere opens the book. At the end, a tap on the
  // "next" side does nothing — silently turning backward reads as a bug.
  if (preferPrev) return canGoPrev ? 'prev' : 'next'
  return canGoNext ? 'next' : null
}

/** A released fold turns the page once it has travelled this far (0–100,
    where 50 is the corner reaching the spine). Waiting for the spine means
    reaching the far left edge on a phone, so honest drags snapped back. */
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

/**
 * Whether the stage should show two facing pages. Only when both leaves stay
 * readable and the pair is nearly as tall as a single page would be — the
 * shape of the stage decides, so rotating a tablet flips between the two.
 */
export function curlUseSpread(
  clientWidth: number,
  clientHeight: number,
  ratio: number = CURL_PAGE_RATIO,
  /** The layout on screen now. Leaving it takes a clear margin, so a phone's
      address bar collapsing mid-scroll never flips the book back and forth. */
  current = false,
): boolean {
  const single = curlPageSizeForStage(clientWidth, clientHeight, ratio, false)
  const paired = curlPageSizeForStage(clientWidth, clientHeight, ratio, true)
  const slack = current ? 0.92 : 1
  return (
    paired.width >= CURL_SPREAD_MIN_PAGE_WIDTH * slack &&
    paired.height >= single.height * CURL_SPREAD_MIN_HEIGHT_SHARE * slack
  )
}

/**
 * Left page of the spread holding `pageIndex`. Documents pair (1|2),
 * (3|4)… from the first page. A book with a cover shows the cover alone on
 * the right — its left slot is -1, an endpaper — then pairs (2|3), (4|5)….
 */
export function curlSpreadStart(pageIndex: number, cover = false): number {
  const index = Math.max(0, pageIndex)
  return index - ((index + (cover ? 1 : 0)) % 2)
}

/** Where a next/previous turn lands: one page, or one whole spread. Null
    when there is nothing that way. */
export function curlStepTarget(
  from: number,
  direction: 1 | -1,
  pageCount: number,
  spread: boolean,
  cover = false,
): number | null {
  if (!spread) {
    const next = from + direction
    return next >= 0 && next < pageCount ? next : null
  }
  // A spread exists while either of its slots holds a page; it is reported
  // by its first real page (the cover spread's left slot is an endpaper).
  const next = curlSpreadStart(from, cover) + direction * 2
  if (next < -1 || next > pageCount - 1) return null
  if (next === -1 && !cover) return null
  return Math.max(0, next)
}

export type CurlSpreadPreference = 'auto' | 'single' | 'double'

/** Smallest leaf a forced spread may shrink to before it gives up and shows
    one page — "two pages" on a phone held upright would be unreadable. */
export const CURL_FORCED_SPREAD_MIN_WIDTH = 200

/** The reader's choice, then the stage: auto decides by shape, "double"
    insists unless the leaves would be unreadably small. */
export function curlResolveSpread(
  preference: CurlSpreadPreference,
  clientWidth: number,
  clientHeight: number,
  ratio: number,
  pageCount: number,
  current: boolean,
): boolean {
  if (pageCount < 2 || preference === 'single') return false
  if (preference === 'double') {
    const paired = curlPageSizeForStage(clientWidth, clientHeight, ratio, true)
    return paired.width >= CURL_FORCED_SPREAD_MIN_WIDTH
  }
  return curlUseSpread(clientWidth, clientHeight, ratio, current)
}
