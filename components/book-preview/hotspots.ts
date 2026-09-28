/**
 * Shoppable hotspots: points on a page that open a product card. Authored
 * as data with page-relative coordinates (0-1 across and down the page,
 * like ink), so a hotspot stays on its product through zoom, the two-page
 * spread, the scroll view and any screen size.
 */

export type BookPreviewHotspot = {
  id: string
  /** Zero-based page the hotspot sits on. */
  pageIndex: number
  /** Centre of the marker, 0 (left edge) to 1 (right edge). */
  x: number
  /** Centre of the marker, 0 (top) to 1 (bottom). */
  y: number
  title: string
  /** Shown as written, e.g. "$48" or "From €120". */
  price?: string
  description?: string
  image?: { src: string; alt: string }
  /** Where the card's action goes. Without it the card is information only. */
  href?: string
  /** The action's label. Default "View product". */
  action?: string
  /** A short name for assistive tech when `title` is long. */
  label?: string
}

export type BookPreviewHotspotEvent =
  /** The marker was on screen, at least half of it, once per page view. */
  | { type: 'impression'; hotspotId: string; pageIndex: number }
  /** The reader opened the card. */
  | { type: 'open'; hotspotId: string; pageIndex: number }
  /** The reader followed the card's link. */
  | { type: 'action'; hotspotId: string; pageIndex: number; href: string }

/**
 * Keeps hotspots a reader can use: a real page, coordinates on the page
 * (clamped, so a marker a hair off the edge still shows), no duplicate
 * ids. Grouped per page and ordered top to bottom, then along the line,
 * so Tab moves through a page the way the eye reads it.
 */
export function hotspotsByPage(
  hotspots: readonly BookPreviewHotspot[] | undefined,
  totalPages: number,
): Map<number, BookPreviewHotspot[]> {
  const pages = new Map<number, BookPreviewHotspot[]>()
  if (!hotspots) return pages
  const seen = new Set<string>()
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  for (const hotspot of hotspots) {
    const { id, pageIndex, x, y, title } = hotspot
    if (!id || seen.has(id) || !title) continue
    if (!Number.isInteger(pageIndex) || pageIndex < 0) continue
    if (totalPages > 0 && pageIndex >= totalPages) continue
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    seen.add(id)
    const list = pages.get(pageIndex) ?? []
    list.push({ ...hotspot, x: clamp(x), y: clamp(y) })
    pages.set(pageIndex, list)
  }
  // Rows within ~4% of the page height read as one line.
  for (const list of pages.values())
    list.sort((a, b) => (Math.abs(a.y - b.y) < 0.04 ? a.x - b.x : a.y - b.y))
  return pages
}

/**
 * Which side the card opens on: away from the nearest edge, so a marker
 * near the bottom of the page opens its card upward, not off the page.
 */
export function hotspotSide(
  hotspot: Pick<BookPreviewHotspot, 'x' | 'y'>,
): 'top' | 'bottom' | 'inline-start' | 'inline-end' {
  if (hotspot.y > 0.62) return 'top'
  if (hotspot.y < 0.38) return 'bottom'
  return hotspot.x > 0.5 ? 'inline-start' : 'inline-end'
}
