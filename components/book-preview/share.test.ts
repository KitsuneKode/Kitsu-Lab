import { describe, expect, test } from 'bun:test'
import { downloadTarget, formatQuoteForShare, shareOrCopy } from './share'

describe('share', () => {
  test('formatQuoteForShare reads like a citation', () => {
    expect(
      formatQuoteForShare({
        quote: ' owls  hunt\nat night ',
        title: 'Birds',
        pageIndex: 4,
      }),
    ).toBe('“owls hunt at night” — Birds, p. 5')
    expect(formatQuoteForShare({ quote: 'x', pageIndex: 0 })).toBe('“x” — p. 1')
  })

  test('downloadTarget keeps the reader for cross-origin files', () => {
    const origin = 'https://reader.example'
    expect(downloadTarget('/book.pdf', origin)).toEqual({
      download: true,
      newTab: false,
    })
    expect(downloadTarget('blob:https://reader.example/1', origin)).toEqual({
      download: true,
      newTab: false,
    })
    expect(downloadTarget('https://cdn.example/book.pdf', origin)).toEqual({
      download: false,
      newTab: true,
    })
  })

  test('shareOrCopy prefers the share sheet', async () => {
    const shared: ShareData[] = []
    const outcome = await shareOrCopy(
      { title: 'T', url: 'https://x/?page=3' },
      { share: async (data) => void shared.push(data) },
    )
    expect(outcome).toBe('shared')
    expect(shared[0]).toEqual({ title: 'T', url: 'https://x/?page=3' })
  })

  test('shareOrCopy shares the file when the sheet can take it', async () => {
    const file = new File(['%PDF'], 'mine.pdf', { type: 'application/pdf' })
    const shared: ShareData[] = []
    await shareOrCopy(
      { title: 'T', file },
      { share: async (data) => void shared.push(data), canShare: () => true },
    )
    expect(shared[0].files?.[0]).toBe(file)
  })

  test('shareOrCopy falls back to the clipboard, and respects a dismissal', async () => {
    let copied = ''
    const clipboard = {
      writeText: async (text: string) => void (copied = text),
    }
    expect(await shareOrCopy({ url: 'https://x' }, { clipboard })).toBe(
      'copied',
    )
    expect(copied).toBe('https://x')
    const abort = Object.assign(new Error('no'), { name: 'AbortError' })
    expect(
      await shareOrCopy(
        { url: 'https://x' },
        { share: async () => Promise.reject(abort), clipboard },
      ),
    ).toBe('cancelled')
    expect(await shareOrCopy({ url: 'https://x' }, {})).toBe('failed')
  })
})
