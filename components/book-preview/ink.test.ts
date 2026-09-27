import { describe, expect, test } from 'bun:test'
import { sanitizeAnnotations, annotationsToMarkdown } from './annotations'
import {
  flattenInk,
  inkHit,
  inkPath,
  pushInkPoint,
  toPagePoint,
  unflattenInk,
  type InkPoint,
} from './ink'

describe('ink geometry', () => {
  test('toPagePoint is page-relative and clamped', () => {
    const rect = { left: 100, top: 50, width: 200, height: 400 }
    expect(toPagePoint(200, 250, rect)).toEqual({ x: 0.5, y: 0.5 })
    expect(toPagePoint(0, 9999, rect)).toEqual({ x: 0, y: 1 })
  })

  test('pushInkPoint drops jitter below the minimum step', () => {
    const points: InkPoint[] = []
    expect(pushInkPoint(points, { x: 0.5, y: 0.5 }, 1)).toBe(true)
    expect(pushInkPoint(points, { x: 0.5001, y: 0.5 }, 1)).toBe(false)
    expect(pushInkPoint(points, { x: 0.51, y: 0.5 }, 1)).toBe(true)
    expect(points).toHaveLength(2)
  })

  test('flatten/unflatten round-trips at storage precision', () => {
    const points = [
      { x: 0.123456, y: 0.654321 },
      { x: 1, y: 0 },
    ]
    const flat = flattenInk(points)
    expect(flat).toEqual([0.1235, 0.6543, 1, 0])
    expect(unflattenInk(flat)).toEqual([
      { x: 0.1235, y: 0.6543 },
      { x: 1, y: 0 },
    ])
    expect(unflattenInk([0.1, 0.2, 0.3])).toEqual([{ x: 0.1, y: 0.2 }])
  })

  test('inkPath scales to the box and smooths longer strokes', () => {
    expect(inkPath([], 100, 100)).toBe('')
    expect(inkPath([{ x: 0.5, y: 0.5 }], 100, 200)).toBe(
      'M 50.00 100.00 l 0.01 0',
    )
    expect(
      inkPath(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        10,
        10,
      ),
    ).toBe('M 0.00 0.00 L 10.00 10.00')
    const curve = inkPath(
      [
        { x: 0, y: 0 },
        { x: 0.5, y: 0.2 },
        { x: 1, y: 0 },
      ],
      100,
      100,
    )
    expect(curve).toContain(' Q ')
    expect(curve.endsWith('L 100.00 0.00')).toBe(true)
  })

  test('inkHit finds strokes near the eraser, aspect-aware', () => {
    const line = flattenInk([
      { x: 0.1, y: 0.5 },
      { x: 0.9, y: 0.5 },
    ])
    expect(inkHit(line, 0.004, { x: 0.5, y: 0.505 }, 0.01, 1)).toBe(true)
    expect(inkHit(line, 0.004, { x: 0.5, y: 0.6 }, 0.01, 1)).toBe(false)
    // On a wide page (aspect 2) a 0.01 height gap is only 0.005 page
    // widths, so a tight eraser reaches it; on a tall one it is 0.02.
    expect(inkHit(line, 0, { x: 0.5, y: 0.51 }, 0.006, 2)).toBe(true)
    expect(inkHit(line, 0, { x: 0.5, y: 0.51 }, 0.006, 0.5)).toBe(false)
    expect(
      inkHit(
        flattenInk([{ x: 0.2, y: 0.2 }]),
        0.01,
        { x: 0.2, y: 0.2 },
        0.001,
        1,
      ),
    ).toBe(true)
  })
})

describe('ink annotations', () => {
  test('sanitize keeps valid strokes and repairs soft fields', () => {
    const clean = sanitizeAnnotations([
      {
        id: 'i1',
        kind: 'ink',
        pageIndex: 2,
        tool: 'crayon',
        color: 'purple',
        width: 5,
        points: [0.1, 0.2, 1.5, -1, 0.3],
      },
      { id: 'i2', kind: 'ink', pageIndex: 0, points: [0.1] },
    ])
    expect(clean).toHaveLength(1)
    expect(clean[0]).toMatchObject({
      kind: 'ink',
      tool: 'pen',
      color: 'ink',
      width: 0.0035,
      points: [0.1, 0.2, 1, 0],
    })
  })

  test('markdown counts strokes per page', () => {
    const md = annotationsToMarkdown(
      sanitizeAnnotations([
        { id: 'a', kind: 'ink', pageIndex: 1, points: [0, 0, 1, 1] },
        { id: 'b', kind: 'ink', pageIndex: 1, points: [0, 0, 1, 1] },
      ]),
    )
    expect(md).toContain('## Drawings')
    expect(md).toContain('- Page 2 — 2 strokes')
  })
})
