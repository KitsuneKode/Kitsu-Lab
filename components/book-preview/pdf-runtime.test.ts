import { describe, expect, test } from 'bun:test'
import {
  pdfjsNeedsLegacyBuild,
  resolvePdfOutline,
  resolvePdfPageLinks,
  sanitizePdfLinkUrl,
  type PdfAnnotation,
  type PdfDocumentProxy,
  type PdfOutlineNode,
  type PdfPageProxy,
} from './pdf-runtime'
import { countOccurrences, createPdfSearchIndex } from './engines/pdf-search'

function mockDoc(
  pages: string[],
  outline?: PdfOutlineNode[] | null,
): PdfDocumentProxy {
  return {
    numPages: pages.length,
    getPage: async (pageNumber: number) => ({
      getViewport: () => ({ width: 612, height: 792 }),
      getTextContent: async () => ({
        items: [{ str: pages[pageNumber - 1] ?? '' }],
      }),
      render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    }),
    getOutline: outline === undefined ? undefined : async () => outline,
    getDestination: async (id: string) => [
      { num: Number(id.replace('p', '')), gen: 0 },
    ],
    getPageIndex: async (ref) => ref.num - 1,
  }
}

describe('countOccurrences', () => {
  test('counts overlapping-free matches', () => {
    expect(countOccurrences('the cat sat on the mat', 'the')).toBe(2)
  })

  test('returns zero for empty needle or no match', () => {
    expect(countOccurrences('abc', '')).toBe(0)
    expect(countOccurrences('abc', 'z')).toBe(0)
  })
})

describe('createPdfSearchIndex', () => {
  test('finds pages containing the query', async () => {
    const index = createPdfSearchIndex(
      mockDoc(['hello world', 'nothing here', 'world peace']),
    )
    const hits = await index.search('world', () => false)
    expect(hits).toEqual([
      { page: 1, count: 1 },
      { page: 3, count: 1 },
    ])
  })

  test('caches page text between queries', async () => {
    let calls = 0
    const doc: PdfDocumentProxy = {
      numPages: 1,
      getPage: async () => {
        calls += 1
        return {
          getViewport: () => ({ width: 1, height: 1 }),
          getTextContent: async () => ({
            items: [{ str: 'alpha beta alpha' }],
          }),
          render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
        }
      },
    }
    const index = createPdfSearchIndex(doc)
    await index.search('alpha', () => false)
    const hits = await index.search('beta', () => false)
    expect(hits).toEqual([{ page: 1, count: 1 }])
    expect(calls).toBe(1)
  })

  test('stops early when cancelled', async () => {
    const index = createPdfSearchIndex(mockDoc(['a', 'b', 'c']))
    let visited = 0
    const hits = await index.search('a', () => {
      visited += 1
      return visited > 1
    })
    expect(hits).toEqual([])
  })
})

describe('resolvePdfOutline', () => {
  test('returns empty when the document has no outline API', async () => {
    const doc = mockDoc(['x'])
    delete doc.getOutline
    expect(await resolvePdfOutline(doc)).toEqual([])
  })

  test('flattens a nested outline into indented contents', async () => {
    const doc = mockDoc(
      ['x', 'y', 'z'],
      [
        {
          title: 'Part I',
          dest: [{ num: 1, gen: 0 }],
          items: [
            { title: 'Chapter 1', dest: [{ num: 2, gen: 0 }], items: [] },
          ],
        },
        { title: 'External link', dest: null, items: [] },
      ],
    )
    const entries = await resolvePdfOutline(doc)
    expect(entries).toEqual([
      { title: 'Part I', pageIndex: 0, depth: 0 },
      { title: 'Chapter 1', pageIndex: 1, depth: 1 },
    ])
  })

  test('resolves named destinations', async () => {
    const doc = mockDoc(['x', 'y'], [{ title: 'Named', dest: 'p2', items: [] }])
    expect(await resolvePdfOutline(doc)).toEqual([
      { title: 'Named', pageIndex: 1, depth: 0 },
    ])
  })

  test('drops destinations outside the document', async () => {
    const doc = mockDoc(
      ['only page'],
      [{ title: 'Far away', dest: [{ num: 99, gen: 0 }], items: [] }],
    )
    expect(await resolvePdfOutline(doc)).toEqual([])
  })

  test('resolves a bare numeric destination', async () => {
    const doc = mockDoc(
      ['x', 'y', 'z'],
      [{ title: 'Direct', dest: [2], items: [] }],
    )
    expect(await resolvePdfOutline(doc)).toEqual([
      { title: 'Direct', pageIndex: 2, depth: 0 },
    ])
  })
})

function mockPageWithLinks(annotations: PdfAnnotation[]): PdfPageProxy {
  return {
    getViewport: ({ scale }: { scale: number }) => ({
      width: 612 * scale,
      height: 792 * scale,
      // Viewport mapping: scale each coordinate (rotation ignored — the real
      // viewport handles it; tests only need a deterministic transform).
      convertToViewportRectangle: (rect: number[]) =>
        rect.map((value) => value * scale),
    }),
    getTextContent: async () => ({ items: [] }),
    render: () => ({ promise: Promise.resolve(), cancel: () => {} }),
    getAnnotations: async () => annotations,
  }
}

describe('sanitizePdfLinkUrl', () => {
  test('keeps safe protocols', () => {
    // new URL normalizes — a bare host gains a trailing slash.
    expect(sanitizePdfLinkUrl('https://example.com/x')).toBe(
      'https://example.com/x',
    )
    expect(sanitizePdfLinkUrl('mailto:a@b.c')).toBe('mailto:a@b.c')
    expect(sanitizePdfLinkUrl('tel:+15551234')).toBe('tel:+15551234')
  })

  test('rejects unsafe or malformed urls', () => {
    expect(sanitizePdfLinkUrl('javascript:alert(1)')).toBeNull()
    expect(sanitizePdfLinkUrl('data:text/html,<b>x</b>')).toBeNull()
    expect(sanitizePdfLinkUrl('file:///etc/passwd')).toBeNull()
    expect(sanitizePdfLinkUrl('not a url')).toBeNull()
    expect(sanitizePdfLinkUrl(null)).toBeNull()
    expect(sanitizePdfLinkUrl('')).toBeNull()
  })
})

describe('resolvePdfPageLinks', () => {
  test('maps external urls to sanitized link targets', async () => {
    const page = mockPageWithLinks([
      { subtype: 'Link', rect: [10, 20, 110, 40], url: 'https://example.com' },
    ])
    const links = await resolvePdfPageLinks({
      page,
      doc: mockDoc(['x']),
      scale: 2,
    })
    expect(links).toEqual([
      {
        left: 20,
        top: 40,
        width: 200,
        height: 40,
        target: { kind: 'url', url: 'https://example.com/' },
      },
    ])
  })

  test('resolves internal destinations to page indexes', async () => {
    const page = mockPageWithLinks([
      { subtype: 'Link', rect: [0, 0, 50, 10], dest: [{ num: 3, gen: 0 }] },
      { subtype: 'Link', rect: [0, 0, 50, 10], dest: 'p2' },
      { subtype: 'Link', rect: [0, 0, 50, 10], dest: [0] },
    ])
    const links = await resolvePdfPageLinks({
      page,
      doc: mockDoc(['a', 'b', 'c']),
      scale: 1,
    })
    expect(links.map((link) => link.target)).toEqual([
      { kind: 'page', pageIndex: 2 },
      { kind: 'page', pageIndex: 1 },
      { kind: 'page', pageIndex: 0 },
    ])
  })

  test('drops unsafe urls, dead destinations, and non-link annotations', async () => {
    const page = mockPageWithLinks([
      {
        subtype: 'Link',
        rect: [0, 0, 50, 10],
        unsafeUrl: 'javascript:alert(1)',
      },
      { subtype: 'Link', rect: [0, 0, 50, 10], dest: [{ num: 99, gen: 0 }] },
      { subtype: 'Link', rect: null },
      { subtype: 'Text', rect: [0, 0, 50, 10], url: 'https://example.com' },
    ])
    const links = await resolvePdfPageLinks({
      page,
      doc: mockDoc(['a']),
      scale: 1,
    })
    expect(links).toEqual([])
  })
})

describe('pdf.js build choice', () => {
  const modern = {
    Map: { prototype: { getOrInsertComputed() {} } },
    WeakMap: { prototype: { getOrInsertComputed() {} } },
    Promise: { try() {} },
    Math: { sumPrecise() {} },
    Uint8Array: { fromBase64() {} },
  }

  test('the newest engines get the lean modern build', () => {
    expect(pdfjsNeedsLegacyBuild(modern)).toBe(false)
  })

  test('missing any one modern API falls back to the polyfilled build', () => {
    expect(pdfjsNeedsLegacyBuild({ ...modern, Map: { prototype: {} } })).toBe(
      true,
    )
    expect(pdfjsNeedsLegacyBuild({ ...modern, Math: {} })).toBe(true)
    expect(pdfjsNeedsLegacyBuild({})).toBe(true)
  })
})
