import { describe, expect, test } from 'bun:test'
import {
  applyCurlMatrix,
  clipPolygon,
  constrainCurlDrag,
  curlBackwardProgress,
  curlCornerFor,
  curlDragPoint,
  curlFold,
  curlForwardProgress,
  curlSettleMs,
  curlSpreadBackwardProgress,
  curlWindow,
  easeInOutCubic,
} from './engines/curl-math'

const W = 400
const H = 600

function area(points: { x: number; y: number }[]) {
  let sum = 0
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i]
    const b = points[(i + 1) % points.length]
    sum += a.x * b.y - b.x * a.y
  }
  return Math.abs(sum) / 2
}

describe('curl fold', () => {
  test('a flat leaf has no fold', () => {
    const corner = curlCornerFor(500, W, H)
    expect(curlFold(corner, corner, W, H)).toBeNull()
  })

  test('front and flap split the page without gaps', () => {
    const corner = curlCornerFor(500, W, H)
    const drag = constrainCurlDrag(corner, { x: 250, y: 520 }, H)
    const fold = curlFold(corner, drag, W, H)!
    expect(area(fold.front) + area(fold.flap)).toBeCloseTo(W * H, 3)
  })

  test('the flap lands with the grabbed corner on the drag point', () => {
    const corner = { x: W, y: H }
    const drag = constrainCurlDrag(corner, { x: 180, y: 480 }, H)
    const fold = curlFold(corner, drag, W, H)!
    const landed = applyCurlMatrix(fold.matrix, corner)
    expect(landed.x).toBeCloseTo(drag.x, 6)
    expect(landed.y).toBeCloseTo(drag.y, 6)
  })

  test('points on the fold stay put under the mirror', () => {
    const corner = { x: W, y: 0 }
    const fold = curlFold(corner, { x: 200, y: 90 }, W, H)!
    const onFold = applyCurlMatrix(fold.matrix, fold.origin)
    expect(onFold.x).toBeCloseTo(fold.origin.x, 6)
    expect(onFold.y).toBeCloseTo(fold.origin.y, 6)
  })

  test('a full turn folds along the spine', () => {
    const corner = { x: W, y: H }
    const drag = curlDragPoint(corner, 1, 0, H)
    const fold = curlFold(corner, drag, W, H)!
    expect(fold.origin.x).toBeCloseTo(0, 6)
    expect(area(fold.flap)).toBeCloseTo(W * H, 3)
  })
})

describe('curl constraints', () => {
  test('the spine corners never leave the flat side', () => {
    const corner = { x: W, y: H }
    for (const wild of [
      { x: -900, y: -900 },
      { x: -50, y: 1400 },
      { x: 100, y: -300 },
    ]) {
      const drag = constrainCurlDrag(corner, wild, H)
      expect(Math.hypot(drag.x, drag.y - H)).toBeLessThanOrEqual(W + 1e-6)
      expect(Math.hypot(drag.x, drag.y)).toBeLessThanOrEqual(
        Math.hypot(W, H) + 1e-6,
      )
    }
  })

  test('pulling past the corner edge folds nothing', () => {
    const corner = { x: W, y: H }
    const drag = constrainCurlDrag(corner, { x: W + 80, y: H }, H)
    expect(curlFold(corner, drag, W, H)).toBeNull()
  })

  test('clipPolygon keeps the requested side', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ]
    const right = clipPolygon(
      square,
      { x: 4, y: 0 },
      { x: 1, y: 0 },
      'positive',
    )
    expect(area(right)).toBeCloseTo(60, 6)
  })
})

describe('curl motion', () => {
  test('the corner arcs: a bottom corner rises mid-turn and lands level', () => {
    const corner = { x: W, y: H }
    expect(curlDragPoint(corner, 0.5, 0, H).y).toBeLessThan(H)
    expect(curlDragPoint(corner, 1, 0, H)).toEqual({ x: -W, y: H })
  })

  test('forward drags follow the finger one-to-one', () => {
    expect(curlForwardProgress(380, 380, W)).toBe(0)
    expect(curlForwardProgress(380, 180, W)).toBeCloseTo(0.25, 6)
  })

  test('backward drags unfold from where the press began', () => {
    expect(curlBackwardProgress(40, 40, W)).toBe(1)
    expect(curlBackwardProgress(40, W, W)).toBe(0)
    expect(curlBackwardProgress(40, 220, W)).toBeCloseTo(0.5, 6)
  })

  test('settling is quicker with less to travel and after a flick', () => {
    expect(curlSettleMs(0.1, 0)).toBeLessThan(curlSettleMs(0.9, 0))
    expect(curlSettleMs(0.5, 2)).toBeLessThan(curlSettleMs(0.5, 0))
  })

  test('easing runs 0 to 1', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
  })

  test('the mounted window covers behind, under and one ahead', () => {
    expect(curlWindow(0, 10)).toEqual([0, 1, 2])
    expect(curlWindow(5, 10)).toEqual([4, 5, 6, 7])
    expect(curlWindow(9, 10)).toEqual([8, 9])
    expect(curlWindow(5, 10, [6])).toEqual([4, 5, 6, 7, 8])
  })
})

describe('curl spreads', () => {
  test('a spread back-drag follows the finger across both pages', () => {
    expect(curlSpreadBackwardProgress(100, 100, W)).toBe(1)
    expect(curlSpreadBackwardProgress(100, 500, W)).toBeCloseTo(0.5, 6)
    expect(curlSpreadBackwardProgress(100, 900, W)).toBe(0)
  })
})
