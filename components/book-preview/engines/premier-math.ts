/** Pure spread-pairing math for the premier reader's two-page view — kept in
    a module of its own so it can be unit-tested without pulling in JSX or
    browser APIs, matching the curl-geometry / webgl-geometry pattern. */

/** Spread pairing. Documents pair (1|2), (3|4)… from the first page, the
    way Chrome's and Acrobat's two-page views open a paper; a book with a
    cover shows the cover alone, then (2|3), (4|5)…. Only a final odd page
    otherwise stands alone. Returns the pair index plus both face slots; a
    slot is -1 when that side of the pair is empty. */
export function spreadSlots(pageIndex: number, total: number, cover = false) {
  const offset = cover ? 1 : 0
  const index = Math.max(0, pageIndex)
  const start = index - ((index + offset) % 2)
  const pair = (start + offset) / 2
  const left = start >= 0 ? start : -1
  const right = start + 1 <= total - 1 ? start + 1 : -1
  return { pair, left, right }
}

/** Whole-pair stepping: direction ±1 moves one leaf (two faces). Returns the
    first face of the pair it lands on, or null past either end. */
export function spreadStep(
  pair: number,
  direction: 1 | -1,
  total: number,
  cover = false,
): number | null {
  const next = pair + direction
  if (next < 0) return null
  const face = Math.max(0, next * 2 - (cover ? 1 : 0))
  return face <= total - 1 ? face : null
}
