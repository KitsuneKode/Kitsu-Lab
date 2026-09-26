import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_URL_KEYS,
  parsePageParam,
  patchSearch,
  pickAllowed,
  readParam,
  resolveUrlKeys,
} from './url-state'

describe('url state', () => {
  test('resolveUrlKeys: opt-in, renames, and the legacy page prop', () => {
    expect(resolveUrlKeys(undefined, undefined)).toEqual({})
    expect(resolveUrlKeys(true, undefined)).toEqual(DEFAULT_URL_KEYS)
    expect(resolveUrlKeys({ mode: 'reader' }, undefined)).toEqual({
      mode: 'reader',
    })
    expect(resolveUrlKeys(undefined, 'p')).toEqual({ page: 'p' })
    expect(resolveUrlKeys(true, 'p').page).toBe('p')
  })

  test('readParam ignores blanks and missing keys', () => {
    expect(readParam('?mode=premier', 'mode')).toBe('premier')
    expect(readParam('?mode=', 'mode')).toBeNull()
    expect(readParam('?mode=premier', undefined)).toBeNull()
    expect(readParam('', 'mode')).toBeNull()
  })

  test('parsePageParam is one-based and rejects junk', () => {
    expect(parsePageParam('12')).toBe(11)
    expect(parsePageParam('1')).toBe(0)
    expect(parsePageParam('0')).toBeNull()
    expect(parsePageParam('-3')).toBeNull()
    expect(parsePageParam('abc')).toBeNull()
    expect(parsePageParam(null)).toBeNull()
  })

  test('pickAllowed narrows to known values', () => {
    const views = ['book', 'single'] as const
    expect(pickAllowed('book', views)).toBe('book')
    expect(pickAllowed('nope', views)).toBeNull()
    expect(pickAllowed(null, views)).toBeNull()
  })

  test('patchSearch returns null when nothing changes', () => {
    expect(patchSearch('?page=2', { page: '2' })).toBeNull()
    expect(patchSearch('?page=2', { mode: undefined })).toBeNull()
    expect(patchSearch('', { page: null })).toBeNull()
  })

  test('patchSearch sets, replaces, removes, and keeps foreign keys', () => {
    expect(patchSearch('?utm=x&page=2', { page: '3', mode: 'premier' })).toBe(
      '?utm=x&page=3&mode=premier',
    )
    expect(patchSearch('?page=2&mode=pdf', { mode: null })).toBe('?page=2')
    expect(patchSearch('?page=2', { page: null })).toBe('')
  })
})
