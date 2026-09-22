import { describe, expect, test } from 'bun:test'
import { archivalFilterModeFor } from './archival-filter-mode'

describe('archival filter mode', () => {
  test('dark appearances select the night plate', () => {
    expect(archivalFilterModeFor('dark')).toBe('night')
    expect(archivalFilterModeFor('oled')).toBe('night')
  })

  test('light selects the museum plate', () => {
    expect(archivalFilterModeFor('light')).toBe('museum')
  })

  test('system and sepia keep the aged facsimile', () => {
    expect(archivalFilterModeFor('system')).toBe('aged')
    expect(archivalFilterModeFor('sepia')).toBe('aged')
  })
})
