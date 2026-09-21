export const CURL_MIN_PAGE_WIDTH = 220 // phone-readable floor
export const CURL_MAX_PAGE_WIDTH = 1400
export const CURL_PAGE_RATIO = 530 / 370
export const CURL_RASTER_WIDTH = 960
export const CURL_RASTER_HEIGHT = Math.round(CURL_RASTER_WIDTH * CURL_PAGE_RATIO)
export const CURL_SIZE_QUANTUM = 16
export const CURL_CLICK_SLOP_PX = 24
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

export type CurlClickIntent = "prev" | "next"

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
  spread: boolean
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
  spread = false
) {
  const padX = CURL_STAGE_PAD_X
  const padY = 36
  // A spread holds two leaves side by side, so each gets half the stage.
  const usable = spread ? (clientWidth - padX) / 2 : clientWidth - padX
  const availW = Math.max(CURL_MIN_PAGE_WIDTH, Math.floor(usable))
  if (clientHeight < 80) {
    const width = Math.min(availW, 360)
    return { width, height: Math.round(width * ratio) }
  }
  const availH = Math.max(
    Math.round(CURL_MIN_PAGE_WIDTH * ratio),
    Math.floor(clientHeight - padY)
  )
  const width = Math.max(
    CURL_MIN_PAGE_WIDTH,
    Math.min(CURL_MAX_PAGE_WIDTH, availW, Math.floor(availH / ratio))
  )
  return { width, height: Math.round(width * ratio) }
}

export function quantizeCurlPageSize(
  size: CurlPageSize,
  ratio: number = CURL_PAGE_RATIO
): CurlPageSize {
  const width = Math.max(
    CURL_MIN_PAGE_WIDTH,
    Math.round(size.width / CURL_SIZE_QUANTUM) * CURL_SIZE_QUANTUM
  )
  return { width, height: Math.round(width * ratio) }
}

export function curlClickIntent(
  x: number,
  width: number,
  canGoPrev: boolean,
  canGoNext: boolean
): CurlClickIntent | null {
  if (!canGoPrev && !canGoNext) return null
  const preferPrev = width > 0 && x < width / 2
  if (preferPrev) return canGoPrev ? "prev" : "next"
  return canGoNext ? "next" : "prev"
}

export function curlDragOrigin(start: CurlPoint, current: CurlPoint, width: number): CurlPoint {
  const goingPrev = current.x - start.x > 4
  if (goingPrev) {
    return { x: Math.min(start.x, width * 0.12), y: start.y }
  }
  return { x: Math.max(start.x, width * 0.88), y: start.y }
}
