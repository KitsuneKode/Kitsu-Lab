/**
 * Reading analytics: how long readers spend on each page, whether they
 * finish, and where they leave. Pure, with an injectable clock, so the
 * reader can feed it and a server can summarise what it collected.
 *
 * Only visible time counts (a hidden tab pauses the clock), a page glanced
 * at for under half a second is not a view, and a dwell is capped so a
 * reader who walked away does not become a ten-hour page.
 */

export type BookPreviewReadingEvent =
  /** Time spent on a page, sent when the reader moves on, hides or leaves. */
  | { type: 'dwell'; pageIndex: number; ms: number }
  /** The last page was reached, once per document per visit. */
  | { type: 'finish'; totalPages: number }
  /** The reader left (closed the tab, navigated away) on this page. */
  | { type: 'leave'; pageIndex: number; totalPages: number }

export const READING_GLANCE_MS = 500
export const READING_MAX_DWELL_MS = 10 * 60 * 1000

export type ReadingTracker = {
  /** The reader is now on `pageIndex` of `totalPages`. */
  view: (pageIndex: number, totalPages: number) => void
  hide: () => void
  show: () => void
  /** The reader is going away; sends the last dwell and where they left. */
  leave: () => void
}

export function createReadingTracker(
  emit: (event: BookPreviewReadingEvent) => void,
  { now = () => Date.now() }: { now?: () => number } = {},
): ReadingTracker {
  let page: number | null = null
  let total = 0
  let since = 0
  let hidden = false
  let finished = false

  const flush = () => {
    if (page === null || hidden) return
    const ms = Math.min(now() - since, READING_MAX_DWELL_MS)
    if (ms >= READING_GLANCE_MS)
      emit({ type: 'dwell', pageIndex: page, ms: Math.round(ms) })
    since = now()
  }

  return {
    view(pageIndex, totalPages) {
      total = totalPages
      if (pageIndex === page) return
      flush()
      page = pageIndex
      since = now()
      if (!finished && totalPages > 0 && pageIndex >= totalPages - 1) {
        finished = true
        emit({ type: 'finish', totalPages })
      }
    },
    hide() {
      flush()
      hidden = true
    },
    show() {
      if (!hidden) return
      hidden = false
      since = now()
    },
    leave() {
      if (page === null) return
      flush()
      emit({ type: 'leave', pageIndex: page, totalPages: total })
      page = null
    },
  }
}

export type ReadingSummary = {
  /** Per page: views, total and median visible time. */
  pages: {
    pageIndex: number
    views: number
    totalMs: number
    medianMs: number
  }[]
  /** How many readers left on each page, the drop-off curve. */
  leaves: { pageIndex: number; count: number }[]
  finishes: number
}

/** Folds collected events into time per page and where readers left. */
export function summarizeReading(
  events: readonly BookPreviewReadingEvent[],
): ReadingSummary {
  const dwell = new Map<number, number[]>()
  const leaves = new Map<number, number>()
  let finishes = 0
  for (const event of events) {
    if (event.type === 'dwell') {
      const list = dwell.get(event.pageIndex) ?? []
      list.push(event.ms)
      dwell.set(event.pageIndex, list)
    } else if (event.type === 'leave')
      leaves.set(event.pageIndex, (leaves.get(event.pageIndex) ?? 0) + 1)
    else finishes += 1
  }
  const median = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b)
    const mid = sorted.length >> 1
    return sorted.length % 2
      ? sorted[mid]!
      : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2)
  }
  return {
    pages: [...dwell]
      .sort(([a], [b]) => a - b)
      .map(([pageIndex, values]) => ({
        pageIndex,
        views: values.length,
        totalMs: values.reduce((sum, ms) => sum + ms, 0),
        medianMs: median(values),
      })),
    leaves: [...leaves]
      .sort(([a], [b]) => a - b)
      .map(([pageIndex, count]) => ({ pageIndex, count })),
    finishes,
  }
}
