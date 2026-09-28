import { describe, expect, test } from 'bun:test'

import {
  followWord,
  joinParts,
  nextWordMatch,
  spokenWord,
} from './speech-highlight'

describe('speech highlight', () => {
  const text = 'The eye is caught first by motion and color. The eye follows.'

  test('reads the word at a boundary, with or without its length', () => {
    expect(spokenWord(text, 4, 3)).toBe('eye')
    expect(spokenWord(text, 4)).toBe('eye')
    expect(spokenWord(text, 38)).toBe('color')
    expect(spokenWord('naturalist’s memory', 0)).toBe('naturalist’s')
    expect(spokenWord(text, 999)).toBe('')
  })

  test('finds whole words only, case-insensitively, moving forward', () => {
    expect(nextWordMatch(text, 'the', 0)).toBe(0)
    // "the" inside "The" at 45, not inside another word.
    expect(nextWordMatch(text, 'the', 1)).toBe(45)
    expect(nextWordMatch('other then', 'the', 0)).toBe(-1)
    expect(nextWordMatch(text, 'eye', 8)).toBe(49)
    expect(nextWordMatch(text, '', 0)).toBe(-1)
  })

  test('node edges are word breaks', () => {
    const { text, starts } = joinParts([
      'Order PASSERES',
      'Historical',
      'MCMXV',
      'In this',
    ])
    expect(text).toBe('Order PASSERES Historical MCMXV In this')
    expect(starts).toEqual([0, 15, 26, 32])
    expect(nextWordMatch(text, 'historical', 0)).toBe(15)
    expect(nextWordMatch(text, 'in', 0)).toBe(32)
  })

  test('a word read out of page order does not strand the cursor', () => {
    const { text } = joinParts([
      'Order PASSERES',
      'Perching Birds',
      'Historical',
    ])
    // The voice reads the title first, then the running head above it.
    let cursor = 0
    const at = (word: string) => {
      const index = followWord(text, word, cursor)
      cursor = index + word.length
      return index
    }
    expect(at('Historical')).toBe(30)
    expect(at('Perching')).toBe(15)
    expect(at('Birds')).toBe(24)
    expect(at('missing')).toBe(-1)
  })
})
