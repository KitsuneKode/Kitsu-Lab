import { describe, expect, test } from 'bun:test'

import {
  CURL_STACK_MAX_PX,
  CURL_STACK_MIN_PX,
  curlOpeningKey,
  curlPageStacks,
} from './engines/curl-geometry'

describe('page stacks', () => {
  test('the sides share the block by how much has been read', () => {
    const start = curlPageStacks(0, 99)
    const middle = curlPageStacks(50, 49)
    const end = curlPageStacks(99, 0)
    expect(start.prev).toBe(0)
    expect(end.next).toBe(0)
    expect(middle.prev).toBeCloseTo(middle.next, 0)
    expect(start.next).toBe(start.total)
  })

  test('longer books are thicker, within the range', () => {
    expect(curlPageStacks(2, 2).total).toBe(CURL_STACK_MIN_PX)
    expect(curlPageStacks(500, 500).total).toBe(CURL_STACK_MAX_PX)
    expect(curlPageStacks(40, 40).total).toBeGreaterThan(
      curlPageStacks(10, 10).total,
    )
  })

  test('a side with leaves never vanishes', () => {
    expect(curlPageStacks(1, 400).prev).toBeGreaterThanOrEqual(1)
    expect(curlPageStacks(0, 0)).toEqual({ prev: 0, next: 0, total: 0 })
  })
})

describe('curlOpeningKey', () => {
  test('only a book that opens on a cover lifts it', () => {
    const cover = { id: 'cover', isCover: true }
    const page = { id: 'one' }
    expect(curlOpeningKey({ title: 'Birds', pages: [cover, page] })).toBe(
      'Birds|cover|2',
    )
    expect(curlOpeningKey({ title: 'Birds', pages: [page, cover] })).toBe(
      undefined,
    )
    expect(curlOpeningKey({ pdfUrl: '/a.pdf', pages: [] })).toBe(undefined)
  })
})
