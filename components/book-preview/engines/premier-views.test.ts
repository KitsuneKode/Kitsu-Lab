import { describe, expect, test } from 'bun:test'
import { spreadSlots, spreadStep } from './premier-math'

describe('premier spread pairing', () => {
  test('the cover sits alone', () => {
    expect(spreadSlots(0, 10)).toEqual({ pair: 0, left: 0, right: -1 })
  })

  test('odd-indexed faces open on the left of their pair', () => {
    expect(spreadSlots(1, 10)).toEqual({ pair: 1, left: 1, right: 2 })
    expect(spreadSlots(3, 10)).toEqual({ pair: 2, left: 3, right: 4 })
  })

  test('even faces land on the right of their pair', () => {
    expect(spreadSlots(2, 10)).toEqual({ pair: 1, left: 1, right: 2 })
    expect(spreadSlots(4, 10)).toEqual({ pair: 2, left: 3, right: 4 })
  })

  test('a lone last face has no right partner', () => {
    expect(spreadSlots(9, 10)).toEqual({ pair: 5, left: 9, right: -1 })
  })
})

describe('premier spread stepping', () => {
  test("steps pair by pair and lands on each pair's left face", () => {
    expect(spreadStep(0, 1, 10)).toBe(1)
    expect(spreadStep(1, 1, 10)).toBe(3)
    expect(spreadStep(2, -1, 10)).toBe(1)
    expect(spreadStep(1, -1, 10)).toBe(0)
  })

  test('never steps past either end', () => {
    expect(spreadStep(0, -1, 10)).toBeNull()
    expect(spreadStep(5, 1, 10)).toBeNull()
    // The last pair can be a lone face; stepping past it is out of range.
    expect(spreadStep(4, 1, 10)).toBe(9)
    expect(spreadStep(5, 1, 9)).toBeNull()
  })

  test('single-face documents stay put', () => {
    expect(spreadStep(0, 1, 1)).toBeNull()
    expect(spreadStep(0, -1, 1)).toBeNull()
  })
})
