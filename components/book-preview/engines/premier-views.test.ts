import { describe, expect, test } from 'bun:test'
import { spreadSlots, spreadStep } from './premier-math'

describe('premier spread pairing', () => {
  test('page 1 opens beside page 2 — a paper has no lone cover', () => {
    expect(spreadSlots(0, 10)).toEqual({ pair: 0, left: 0, right: 1 })
    expect(spreadSlots(1, 10)).toEqual({ pair: 0, left: 0, right: 1 })
  })

  test('faces pair (1|2), (3|4)… with the even face on the left', () => {
    expect(spreadSlots(2, 10)).toEqual({ pair: 1, left: 2, right: 3 })
    expect(spreadSlots(3, 10)).toEqual({ pair: 1, left: 2, right: 3 })
    expect(spreadSlots(9, 10)).toEqual({ pair: 4, left: 8, right: 9 })
  })

  test('only a final odd page stands alone', () => {
    expect(spreadSlots(8, 9)).toEqual({ pair: 4, left: 8, right: -1 })
  })

  test('a one-page document is one lone face', () => {
    expect(spreadSlots(0, 1)).toEqual({ pair: 0, left: 0, right: -1 })
  })
})

describe('premier spread stepping', () => {
  test("steps pair by pair and lands on each pair's left face", () => {
    expect(spreadStep(0, 1, 10)).toBe(2)
    expect(spreadStep(1, 1, 10)).toBe(4)
    expect(spreadStep(2, -1, 10)).toBe(2)
    expect(spreadStep(1, -1, 10)).toBe(0)
  })

  test('never steps past either end', () => {
    expect(spreadStep(0, -1, 10)).toBeNull()
    expect(spreadStep(4, 1, 10)).toBeNull()
    // The last pair can be a lone face.
    expect(spreadStep(3, 1, 9)).toBe(8)
    expect(spreadStep(4, 1, 9)).toBeNull()
  })

  test('single-face documents stay put', () => {
    expect(spreadStep(0, 1, 1)).toBeNull()
    expect(spreadStep(0, -1, 1)).toBeNull()
  })
})

describe('premier spread pairing with a cover', () => {
  test('the cover stands alone, then (2|3), (4|5)…', () => {
    expect(spreadSlots(0, 10, true)).toEqual({ pair: 0, left: -1, right: 0 })
    expect(spreadSlots(1, 10, true)).toEqual({ pair: 1, left: 1, right: 2 })
    expect(spreadSlots(2, 10, true)).toEqual({ pair: 1, left: 1, right: 2 })
    expect(spreadSlots(9, 10, true)).toEqual({ pair: 5, left: 9, right: -1 })
  })

  test('steps land on the first face of each pair', () => {
    expect(spreadStep(0, 1, 10, true)).toBe(1)
    expect(spreadStep(1, 1, 10, true)).toBe(3)
    expect(spreadStep(1, -1, 10, true)).toBe(0)
    expect(spreadStep(5, 1, 10, true)).toBeNull()
  })
})
