import { describe, expect, test } from 'bun:test'
import {
  clampPageIndex,
  isEmptySource,
  normalizeSource,
  sourceIdentity,
} from './normalize'

describe('normalizeSource', () => {
  test('fills page ids and trims source fields', () => {
    const source = normalizeSource({
      title: '  Folio  ',
      pages: [
        { id: '', pageNumber: 0, title: 'Cover', paragraphs: ['', 'Hello'] },
      ],
      pdfUrl: ' /doc.pdf ',
    })
    expect(source.title).toBe('Folio')
    expect(source.pages[0]?.id).toBe('page-1')
    expect(source.pages[0]?.pageNumber).toBe(1)
    expect(source.pages[0]?.paragraphs).toEqual(['Hello'])
    expect(source.pdfUrl).toBe('/doc.pdf')
  })

  test('detects empty sources', () => {
    expect(isEmptySource(normalizeSource({}))).toBe(true)
    expect(isEmptySource(normalizeSource({ allowPdfUpload: true }))).toBe(false)
  })

  test('clamps page indexes', () => {
    expect(clampPageIndex(-2, 4)).toBe(0)
    expect(clampPageIndex(9, 4)).toBe(3)
    expect(clampPageIndex(1.8, 4)).toBe(1)
    expect(clampPageIndex(0, 0)).toBe(0)
  })

  test('changes identity when content changes even if page ids stay the same', () => {
    const first = normalizeSource({
      title: 'First edition',
      pages: [{ id: 'cover', pageNumber: 1, title: 'One' }],
    })
    const second = normalizeSource({
      title: 'Second edition',
      pages: [{ id: 'cover', pageNumber: 1, title: 'Two' }],
    })
    expect(sourceIdentity(first)).not.toBe(sourceIdentity(second))
  })

  test('lets render-only sources opt into explicit revision identity', () => {
    const first = normalizeSource({ revision: 'draft-1', pages: [] })
    const second = normalizeSource({ revision: 'draft-2', pages: [] })
    expect(sourceIdentity(first)).not.toBe(sourceIdentity(second))
  })
})
