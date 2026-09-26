/**
 * Freehand ink — the pure half. Strokes live in page-relative coordinates
 * (0–1 on both axes) with a width relative to the page width, so a drawing
 * made on a phone lands in the same place, at the same weight, on a 4K
 * monitor or at 240% zoom. No DOM here; bun tests it directly.
 */

export const INK_COLORS = ['ink', 'red', 'blue', 'green', 'yellow'] as const
export type BookPreviewInkColor = (typeof INK_COLORS)[number]

export const INK_TOOLS = ['pen', 'marker', 'eraser'] as const
export type BookPreviewInkTool = (typeof INK_TOOLS)[number]

/** Stroke width as a fraction of the page width. */
export const INK_WIDTHS = { pen: 0.0035, marker: 0.022 } as const

/** Minimum travel between kept samples, in page-width fractions — drops the
    jitter of a resting stylus without flattening curves. */
export const INK_MIN_STEP = 0.0015

/** Coordinates are rounded to this many decimals when stored: sub-pixel on
    any real screen, and a stroke stays a few hundred bytes. */
const PRECISION = 4

export type InkPoint = { x: number; y: number }

const round = (value: number) => {
  const factor = 10 ** PRECISION
  return Math.round(value * factor) / factor
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Page-relative point from a client position and the page's rect. */
export function toPagePoint(
  clientX: number,
  clientY: number,
  rect: { left: number; top: number; width: number; height: number },
): InkPoint {
  return {
    x: clamp01((clientX - rect.left) / Math.max(rect.width, 1)),
    y: clamp01((clientY - rect.top) / Math.max(rect.height, 1)),
  }
}

/** Appends a sample unless it is closer than `minStep` to the last kept one
    (measured in page-width units so it is aspect-independent). Returns
    whether it was kept. */
export function pushInkPoint(
  points: InkPoint[],
  next: InkPoint,
  aspect: number,
  minStep = INK_MIN_STEP,
): boolean {
  const last = points[points.length - 1]
  if (last) {
    const dx = next.x - last.x
    const dy = (next.y - last.y) / Math.max(aspect, 0.01)
    if (Math.hypot(dx, dy) < minStep) return false
  }
  points.push(next)
  return true
}

/** Flat [x0, y0, x1, y1, …] rounded for storage. */
export function flattenInk(points: readonly InkPoint[]): number[] {
  const out: number[] = []
  for (const point of points) out.push(round(point.x), round(point.y))
  return out
}

export function unflattenInk(flat: readonly number[]): InkPoint[] {
  const out: InkPoint[] = []
  for (let index = 0; index + 1 < flat.length; index += 2) {
    out.push({ x: flat[index], y: flat[index + 1] })
  }
  return out
}

/**
 * A smooth SVG path through the samples in a `width × height` box: straight
 * to the first midpoint, then quadratic curves through each sample to the
 * next midpoint — the classic midpoint-smoothing that makes a stylus line
 * look inked rather than plotted. A single tap becomes a dot.
 */
export function inkPath(
  points: readonly InkPoint[],
  width: number,
  height: number,
): string {
  if (points.length === 0) return ''
  const p = (point: InkPoint) =>
    `${(point.x * width).toFixed(2)} ${(point.y * height).toFixed(2)}`
  if (points.length === 1) {
    // Zero-length segment with a round cap renders as a dot.
    return `M ${p(points[0])} l 0.01 0`
  }
  if (points.length === 2) return `M ${p(points[0])} L ${p(points[1])}`
  let d = `M ${p(points[0])}`
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index]
    const next = points[index + 1]
    const mid = { x: (current.x + next.x) / 2, y: (current.y + next.y) / 2 }
    d += ` Q ${p(current)} ${p(mid)}`
  }
  d += ` L ${p(points[points.length - 1])}`
  return d
}

function distanceToSegment(
  point: InkPoint,
  a: InkPoint,
  b: InkPoint,
  aspect: number,
): number {
  // Work in page-width units on both axes so the eraser is round.
  const scaleY = 1 / Math.max(aspect, 0.01)
  const px = point.x
  const py = point.y * scaleY
  const ax = a.x
  const ay = a.y * scaleY
  const bx = b.x
  const by = b.y * scaleY
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  const t =
    lengthSq === 0
      ? 0
      : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSq))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/**
 * Whether an eraser at `point` (radius in page-width units) touches a stroke.
 * `aspect` is page width / height, so the hit area stays circular on tall
 * and wide pages alike.
 */
export function inkHit(
  flat: readonly number[],
  strokeWidth: number,
  point: InkPoint,
  radius: number,
  aspect: number,
): boolean {
  const points = unflattenInk(flat)
  const reach = radius + strokeWidth / 2
  if (points.length === 1) {
    return distanceToSegment(point, points[0], points[0], aspect) <= reach
  }
  for (let index = 1; index < points.length; index += 1) {
    if (
      distanceToSegment(point, points[index - 1], points[index], aspect) <=
      reach
    ) {
      return true
    }
  }
  return false
}

export const INK_SWATCHES: Record<
  BookPreviewInkColor,
  { label: string; stroke: string }
> = {
  // "Ink" follows the page's text colour, so it reads on any paper.
  ink: { label: 'Ink', stroke: 'currentColor' },
  red: { label: 'Red', stroke: 'rgb(220 38 38)' },
  blue: { label: 'Blue', stroke: 'rgb(37 99 235)' },
  green: { label: 'Green', stroke: 'rgb(22 163 74)' },
  yellow: { label: 'Yellow', stroke: 'rgb(234 179 8)' },
}
