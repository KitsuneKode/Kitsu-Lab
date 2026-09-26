/**
 * Page-curl geometry. A turning leaf is modelled as a flat sheet folded along
 * one line: the part past the fold lifts and lands mirrored on top of the
 * rest. Everything here is in page coordinates — the spine is the left edge
 * (x = 0), the leaf is `width` × `height` — and pure, so bun tests it
 * without a browser.
 *
 * A turn is described by its grabbed corner and a progress `p` (0 = flat on
 * the page, 1 = fully turned over the spine). The drag point — where the
 * grabbed corner is now — follows from those two, and the fold line is the
 * perpendicular bisector between the corner and the drag point.
 */

export type Vec = { x: number; y: number }

/** How far a corner rises through a turn, as a share of the page height. A
    straight horizontal pull gives a flat vertical fold; the lift is what
    makes it read as a curl. */
export const CURL_ARC_LIFT = 0.12

/** Hover peek: the corner lifts this much (progress) under a resting mouse. */
export const CURL_PEEK_PROGRESS = 0.035

export type CurlFold = {
  /** Still-flat part of the leaf's front, as a polygon. */
  front: Vec[]
  /** Part of the leaf that has lifted, in its original (flat) position. */
  flap: Vec[]
  /** CSS `matrix()` values mirroring page coordinates across the fold —
      applied to the leaf's back, clipped to `flap`, it lands the flap. */
  matrix: [number, number, number, number, number, number]
  /** A point on the fold line and the unit normal pointing to the flap. */
  origin: Vec
  normal: Vec
  /** Angle of `normal` in degrees, for rotating shadows along the fold. */
  angle: number
  /** Distance from the fold to the far edge of the flap. */
  depth: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** The corner a press grabs: the top one in the top half, else the bottom. */
export function curlCornerFor(y: number, width: number, height: number): Vec {
  return { x: width, y: y < height / 2 ? 0 : height }
}

/**
 * Where the grabbed corner sits at progress `p`. It travels from its own
 * position to its mirror image across the spine, rising on an arc so the
 * fold runs diagonally mid-turn. `dy` is the reader's own vertical pull.
 */
export function curlDragPoint(
  corner: Vec,
  p: number,
  dy: number,
  height: number,
): Vec {
  const t = clamp(p, 0, 1)
  const rise = CURL_ARC_LIFT * height * Math.sin(Math.PI * t)
  // A bottom corner rises; a top corner dips.
  const toward = corner.y > height / 2 ? -1 : 1
  return {
    x: corner.x - 2 * corner.x * t,
    y: corner.y + dy + toward * rise,
  }
}

function projectToDisc(point: Vec, center: Vec, radius: number): Vec {
  const dx = point.x - center.x
  const dy = point.y - center.y
  const distance = Math.hypot(dx, dy)
  if (distance <= radius || distance === 0) return point
  const scale = radius / distance
  return { x: center.x + dx * scale, y: center.y + dy * scale }
}

/**
 * Keeps a drag physically possible: paper cannot stretch or tear from the
 * spine, so both spine corners stay on the flat side of the fold — the drag
 * point stays inside a disc around each, with the grabbed corner's distance
 * as radius. Alternating projections settle into the lens they share.
 */
export function constrainCurlDrag(corner: Vec, drag: Vec, height: number): Vec {
  const top = { x: 0, y: 0 }
  const bottom = { x: 0, y: height }
  const rTop = Math.hypot(corner.x - top.x, corner.y - top.y)
  const rBottom = Math.hypot(corner.x - bottom.x, corner.y - bottom.y)
  // Pulling past the corner's own edge folds nothing.
  let point = { x: Math.min(drag.x, corner.x), y: drag.y }
  for (let pass = 0; pass < 4; pass += 1) {
    point = projectToDisc(point, top, rTop)
    point = projectToDisc(point, bottom, rBottom)
  }
  return point
}

/** Sutherland–Hodgman against one half-plane: keeps the points where
    `(p - origin) · normal` has the requested sign. */
export function clipPolygon(
  polygon: readonly Vec[],
  origin: Vec,
  normal: Vec,
  keep: 'positive' | 'negative',
): Vec[] {
  const sign = keep === 'positive' ? 1 : -1
  const side = (p: Vec) =>
    sign * ((p.x - origin.x) * normal.x + (p.y - origin.y) * normal.y)
  const out: Vec[] = []
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const a = side(current)
    const b = side(next)
    if (a >= 0) out.push(current)
    if (a >= 0 !== b >= 0) {
      const t = a / (a - b)
      out.push({
        x: current.x + (next.x - current.x) * t,
        y: current.y + (next.y - current.y) * t,
      })
    }
  }
  return out
}

/**
 * The fold for a corner dragged to `drag` (already constrained). Null when
 * nothing is lifted — the leaf lies flat.
 */
export function curlFold(
  corner: Vec,
  drag: Vec,
  width: number,
  height: number,
): CurlFold | null {
  const dx = corner.x - drag.x
  const dy = corner.y - drag.y
  const length = Math.hypot(dx, dy)
  if (length < 0.5) return null
  const normal = { x: dx / length, y: dy / length }
  const origin = { x: (corner.x + drag.x) / 2, y: (corner.y + drag.y) / 2 }
  const page = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ]
  const front = clipPolygon(page, origin, normal, 'negative')
  const flap = clipPolygon(page, origin, normal, 'positive')
  if (flap.length < 3) return null
  // Reflection across the fold: x' = x - 2((x - o)·n)n.
  const k = 2 * (origin.x * normal.x + origin.y * normal.y)
  const matrix: CurlFold['matrix'] = [
    1 - 2 * normal.x * normal.x,
    -2 * normal.x * normal.y,
    -2 * normal.x * normal.y,
    1 - 2 * normal.y * normal.y,
    k * normal.x,
    k * normal.y,
  ]
  let depth = 0
  for (const point of flap) {
    depth = Math.max(
      depth,
      (point.x - origin.x) * normal.x + (point.y - origin.y) * normal.y,
    )
  }
  return {
    front,
    flap,
    matrix,
    origin,
    normal,
    angle: (Math.atan2(normal.y, normal.x) * 180) / Math.PI,
    depth,
  }
}

/** Mirror a point across the fold the way `matrix` does — for tests. */
export function applyCurlMatrix(matrix: CurlFold['matrix'], point: Vec): Vec {
  const [a, b, c, d, e, f] = matrix
  return { x: a * point.x + c * point.y + e, y: b * point.x + d * point.y + f }
}

/** CSS `polygon()` for a clip path, rounded to keep style strings short. */
export function curlPolygonCss(points: readonly Vec[]): string {
  if (points.length < 3) return 'polygon(0 0, 0 0, 0 0)'
  return `polygon(${points
    .map((p) => `${Math.round(p.x * 10) / 10}px ${Math.round(p.y * 10) / 10}px`)
    .join(', ')})`
}

/**
 * Progress of a forward drag: the finger holds the grabbed point of the
 * paper, so the corner moves exactly as far as the finger has.
 */
export function curlForwardProgress(
  startX: number,
  x: number,
  width: number,
): number {
  return clamp((startX - x) / (2 * Math.max(width, 1)), 0, 1)
}

/**
 * Progress of a backward drag on a single page. The previous leaf lies
 * turned over, off the page to the left, so there is no paper under the
 * finger to hold — instead the fold edge follows it: from where the press
 * began to the right edge, the leaf unfolds across the whole page.
 */
export function curlBackwardProgress(
  startX: number,
  x: number,
  width: number,
): number {
  const room = Math.max(width - startX, 1)
  const unfolded = clamp((x - startX) / room, 0, 1)
  return 1 - unfolded
}

/** Ease-out: already moving, settling. */
export function easeOutCubic(t: number): number {
  const u = 1 - clamp(t, 0, 1)
  return 1 - u * u * u
}

/** Ease-in-out: a turn from rest gathers, travels, lands. */
export function easeInOutCubic(t: number): number {
  const u = clamp(t, 0, 1)
  return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2
}

/** Release duration (ms): shorter the less there is left to travel, and
    shorter still after a fast flick — the page keeps the finger's pace. */
export function curlSettleMs(remaining: number, speed: number): number {
  const base = 150 + 330 * clamp(remaining, 0, 1)
  const quick = clamp(Math.abs(speed) / 1.5, 0, 1)
  return Math.round(base * (1 - 0.4 * quick))
}

/** Pages kept mounted around the one in view: the leaf behind, the leaf
    under, one more ahead so its raster is ready when the turn lands. */
export function curlWindow(
  index: number,
  pageCount: number,
  extra: readonly number[] = [],
): number[] {
  const set = new Set<number>()
  for (const center of [index, ...extra]) {
    for (let offset = -1; offset <= 2; offset += 1) {
      const page = center + offset
      if (page >= 0 && page < pageCount) set.add(page)
    }
  }
  return Array.from(set).sort((a, b) => a - b)
}
