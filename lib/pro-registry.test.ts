import { describe, expect, test } from 'bun:test'

import { isAuthorized, parseItemName, readKeys } from './pro-registry'

const KEY = 'kp_live_0123456789abcdef'

describe('parseItemName', () => {
  test('accepts registry item names with or without .json', () => {
    expect(parseItemName('promo-pill.json')).toBe('promo-pill')
    expect(parseItemName('registry')).toBe('registry')
  })

  test('rejects anything that could leave the folder', () => {
    for (const bad of [
      '../secret.json',
      '..%2Fx',
      'a/b',
      '',
      '.json',
      'Promo',
      'x'.repeat(80),
    ])
      expect(parseItemName(bad)).toBeNull()
  })
})

describe('readKeys', () => {
  test('splits on commas and newlines and drops short keys', () => {
    expect(readKeys(`${KEY}, short,\n${KEY}2`)).toEqual([KEY, `${KEY}2`])
    expect(readKeys(undefined)).toEqual([])
  })
})

describe('isAuthorized', () => {
  test('needs a matching bearer key', () => {
    expect(isAuthorized(`Bearer ${KEY}`, [KEY])).toBe(true)
    expect(isAuthorized(`bearer ${KEY}`, ['other-key-000000000', KEY])).toBe(
      true,
    )
    expect(isAuthorized(`Bearer ${KEY}x`, [KEY])).toBe(false)
    expect(isAuthorized(KEY, [KEY])).toBe(false)
    expect(isAuthorized(null, [KEY])).toBe(false)
  })

  test('is closed when no keys are configured', () => {
    expect(isAuthorized(`Bearer ${KEY}`, [])).toBe(false)
  })
})
