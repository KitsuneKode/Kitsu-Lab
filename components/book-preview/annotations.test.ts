import { describe, expect, test } from 'bun:test'
import {
  annotationsToMarkdown,
  createTextQuote,
  findBookmark,
  highlightsAt,
  locateTextQuote,
  removeAnnotation,
  sanitizeAnnotations,
  sortAnnotations,
  toggleBookmark,
  upsertAnnotation,
  type BookPreviewAnnotation,
  type BookPreviewHighlight,
} from './annotations'

const TEXT =
  'The owl hunts at night. The owl rests by day. Owls are birds of prey.'

function highlight(
  overrides: Partial<BookPreviewHighlight> = {},
): BookPreviewHighlight {
  return {
    id: 'h1',
    kind: 'highlight',
    pageIndex: 0,
    createdAt: 1,
    updatedAt: 1,
    color: 'yellow',
    quote: { exact: 'owl', prefix: '', suffix: '' },
    ...overrides,
  }
}

describe('text quotes', () => {
  test('createTextQuote captures exact words and bounded context', () => {
    const start = TEXT.indexOf('rests')
    const quote = createTextQuote(TEXT, start, start + 5, 8)
    expect(quote.exact).toBe('rests')
    expect(quote.prefix).toBe('The owl ')
    expect(quote.suffix).toBe(' by day.')
  })

  test('locateTextQuote uses context to pick the right repeat', () => {
    const second = TEXT.indexOf('owl', TEXT.indexOf('owl') + 1)
    const quote = createTextQuote(TEXT, second, second + 3)
    expect(locateTextQuote(TEXT, quote)).toEqual({
      start: second,
      end: second + 3,
    })
    const first = TEXT.indexOf('owl')
    expect(
      locateTextQuote(TEXT, createTextQuote(TEXT, first, first + 3)),
    ).toEqual({ start: first, end: first + 3 })
  })

  test('locateTextQuote ignores whitespace differences between views', () => {
    const layer = 'Attention  is all\nyou need.'
    const quote = {
      exact: 'is all you need',
      prefix: 'Attention ',
      suffix: '.',
    }
    const found = locateTextQuote(layer, quote)
    expect(found).not.toBeNull()
    expect(layer.slice(found!.start, found!.end)).toBe('is all\nyou need')
    // Runs joined without spaces in one view still match.
    expect(locateTextQuote('Attentionisallyouneed', quote)).toEqual({
      start: 9,
      end: 21,
    })
  })

  test('locateTextQuote returns null for missing or empty quotes', () => {
    expect(
      locateTextQuote(TEXT, { exact: 'eagle', prefix: '', suffix: '' }),
    ).toBeNull()
    expect(
      locateTextQuote(TEXT, { exact: '   ', prefix: '', suffix: '' }),
    ).toBeNull()
  })
})

describe('annotation lists', () => {
  test('upsert inserts then replaces; remove drops by id', () => {
    let list: BookPreviewAnnotation[] = []
    list = upsertAnnotation(list, highlight())
    list = upsertAnnotation(list, highlight({ color: 'blue' }))
    expect(list).toHaveLength(1)
    expect((list[0] as BookPreviewHighlight).color).toBe('blue')
    expect(removeAnnotation(list, 'h1')).toEqual([])
  })

  test('toggleBookmark adds and removes the page bookmark', () => {
    const once = toggleBookmark([], 4, 10)
    expect(findBookmark(once, 4)?.createdAt).toBe(10)
    expect(findBookmark(toggleBookmark(once, 4), 4)).toBeUndefined()
  })

  test('sortAnnotations orders by page then time', () => {
    const sorted = sortAnnotations([
      highlight({ id: 'c', pageIndex: 2, createdAt: 1 }),
      highlight({ id: 'b', pageIndex: 0, createdAt: 5 }),
      highlight({ id: 'a', pageIndex: 0, createdAt: 2 }),
    ])
    expect(sorted.map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  test('highlightsAt returns the newest overlapping highlight first', () => {
    expect(
      highlightsAt(
        [
          { id: 'old', start: 0, end: 10 },
          { id: 'new', start: 5, end: 8 },
        ],
        6,
      ),
    ).toEqual(['new', 'old'])
    expect(highlightsAt([{ id: 'x', start: 0, end: 3 }], 3)).toEqual([])
  })

  test('sanitizeAnnotations drops junk and repairs soft fields', () => {
    const clean = sanitizeAnnotations([
      null,
      { id: 'b', kind: 'bookmark', pageIndex: 2.7, createdAt: 3 },
      {
        id: 'h',
        kind: 'highlight',
        pageIndex: 1,
        color: 'purple',
        quote: { exact: 'owl' },
      },
      { id: 'bad', kind: 'highlight', pageIndex: 1, quote: { exact: '' } },
      { id: 'neg', kind: 'bookmark', pageIndex: -1 },
    ])
    expect(clean).toHaveLength(2)
    expect(clean[0]).toMatchObject({ id: 'b', pageIndex: 2, updatedAt: 3 })
    expect(clean[1]).toMatchObject({
      id: 'h',
      color: 'yellow',
      quote: { exact: 'owl', prefix: '', suffix: '' },
    })
    expect(sanitizeAnnotations('nope')).toEqual([])
  })

  test('annotationsToMarkdown exports bookmarks, quotes and notes', () => {
    const md = annotationsToMarkdown(
      [
        highlight({
          note: 'Nocturnal!',
          quote: { exact: 'hunts  at\nnight', prefix: '', suffix: '' },
        }),
        { id: 'b', kind: 'bookmark', pageIndex: 3, createdAt: 1, updatedAt: 1 },
      ],
      { title: 'Owls', author: 'A. Birder' },
    )
    expect(md).toContain('# Owls')
    expect(md).toContain('_A. Birder_')
    expect(md).toContain('- Page 4')
    expect(md).toContain('> hunts at night')
    expect(md).toContain('Nocturnal!')
    expect(annotationsToMarkdown([])).toContain('No highlights')
  })
})
