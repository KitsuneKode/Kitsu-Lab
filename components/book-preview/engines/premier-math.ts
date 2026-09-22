/** Pure spread-pairing math for the premier reader's two-page view — kept in
    a module of its own so it can be unit-tested without pulling in JSX or
    browser APIs, matching the curl-geometry / webgl-geometry pattern. */

/** Spread pairing, book-style: the cover (face 0) sits alone, then faces pair
    up (1|2), (3|4)… Returns the pair index plus both face slots; right is -1
    when a pair has no right face. */
export function spreadSlots(pageIndex: number, total: number) {
  const pair = pageIndex === 0 ? 0 : Math.ceil(pageIndex / 2)
  const left = pair === 0 ? 0 : pair * 2 - 1
  const right = pair === 0 ? -1 : left + 1 <= total - 1 ? left + 1 : -1
  return { pair, left, right }
}

/** Whole-pair stepping: direction ±1 moves one leaf. Returns null at the
    ends so callers can decide whether to ignore or wrap. */
export function spreadStep(
  pair: number,
  direction: 1 | -1,
  total: number,
): number | null {
  const next = pair + direction
  if (next < 0) return null
  const face = next === 0 ? 0 : next * 2 - 1
  return face <= total - 1 ? face : null
}
