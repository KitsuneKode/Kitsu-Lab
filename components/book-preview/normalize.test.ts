import { describe, expect, test } from 'bun:test'
import {
  clampPageIndex,
  isEmptySource,
  normalizePages,
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

describe('image pages', () => {
  const image = {
    src: ' /p/1.webp ',
    width: 1240,
    height: 1754,
    alt: ' Page one ',
  }

  test('keeps a valid image and trims it', () => {
    const [page] = normalizeSource({
      pages: [{ id: 'p1', pageNumber: 1, image }],
    }).pages
    expect(page?.image).toEqual({
      src: '/p/1.webp',
      width: 1240,
      height: 1754,
      alt: 'Page one',
      srcSet: undefined,
      sizes: undefined,
    })
  })

  test('drops an image with no source or no intrinsic size', () => {
    const pages = normalizeSource({
      pages: [
        { id: 'a', pageNumber: 1, image: { ...image, src: ' ' } },
        { id: 'b', pageNumber: 2, image: { ...image, width: 0 } },
        { id: 'c', pageNumber: 3, image: { ...image, height: Number.NaN } },
      ],
    }).pages
    expect(pages.map((page) => page.image)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
  })

  test('a changed page image changes the source identity', () => {
    const a = normalizeSource({ pages: [{ id: 'p', pageNumber: 1, image }] })
    const b = normalizeSource({
      pages: [
        { id: 'p', pageNumber: 1, image: { ...image, src: '/p/1-v2.webp' } },
      ],
    })
    expect(sourceIdentity(a)).not.toBe(sourceIdentity(b))
  })

  test('an image-only source is not empty', () => {
    expect(
      isEmptySource(
        normalizeSource({ pages: [{ id: 'p', pageNumber: 1, image }] }),
      ),
    ).toBe(false)
  })
})

describe('image pages that fail validation', () => {
  test('fall back to their description instead of rendering blank', () => {
    const [page] = normalizePages([
      {
        id: 'a',
        pageNumber: 3,
        image: {
          src: ' ',
          alt: 'A map of the valley',
          width: 800,
          height: 1000,
        },
      },
    ])
    expect(page?.image).toBeUndefined()
    expect(page?.paragraphs).toEqual(['A map of the valley'])
  })

  test('use a generic line when there is no description', () => {
    const [page] = normalizePages([
      {
        id: 'b',
        pageNumber: 4,
        image: { src: '/x.webp', alt: '', width: 0, height: 10 },
      },
    ])
    expect(page?.paragraphs).toEqual(['Page 4 could not be shown.'])
  })

  test('keep their own text when they have some', () => {
    const [page] = normalizePages([
      {
        id: 'c',
        pageNumber: 5,
        paragraphs: ['Real text'],
        image: { src: '', alt: 'x', width: 1, height: 1 },
      },
    ])
    expect(page?.paragraphs).toEqual(['Real text'])
  })
})
