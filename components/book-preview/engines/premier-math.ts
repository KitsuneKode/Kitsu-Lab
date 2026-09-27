/** Pure spread-pairing math for the premier reader's two-page view — kept in
    a module of its own so it can be unit-tested without pulling in JSX or
    browser APIs, matching the curl-geometry / webgl-geometry pattern. */

/** Spread pairing, document-style — the way Chrome's and Acrobat's two-page
    views open a paper: faces pair (1|2), (3|4)… from the very first page,
    and only a final odd page stands alone. (A lone opening "cover" reads as
    a broken layout for a paper whose page 1 is content.) Returns the pair
    index plus both face slots; right is -1 when a pair has no right face. */
export function spreadSlots(pageIndex: number, total: number) {
  const pair = Math.floor(Math.max(0, pageIndex) / 2)
  const left = pair * 2
  const right = left + 1 <= total - 1 ? left + 1 : -1
  return { pair, left, right }
}

/** Whole-pair stepping: direction ±1 moves one leaf (two faces). Returns
    null at the ends so callers can decide whether to ignore or wrap. */
export function spreadStep(
  pair: number,
  direction: 1 | -1,
  total: number,
): number | null {
  const next = pair + direction
  if (next < 0) return null
  const face = next * 2
  return face <= total - 1 ? face : null
}
