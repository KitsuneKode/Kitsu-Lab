import { describe, expect, test } from 'bun:test'
import {
  ASK_PAGE_TEXT_LIMIT,
  buildAskPrompt,
  chainAiAdapters,
  parseSseChunk,
  streamAnswer,
  type BookPreviewAiAdapter,
} from './ai'

async function* chunks(...parts: string[]) {
  for (const part of parts) yield part
}

describe('ask prompt', () => {
  test('grounds the question in the page, selection, and document', () => {
    const { system, user } = buildAskPrompt({
      question: '  Why?  ',
      selection: 'the  owl\nhunts',
      pageIndex: 4,
      pageText: 'Owls   hunt at night.',
      title: 'Birds',
      author: 'Reed',
    })
    expect(system).toContain('page text')
    expect(user).toContain('Document: Birds by Reed')
    expect(user).toContain('Page 5 text')
    expect(user).toContain('Owls hunt at night.')
    expect(user).toContain('the owl hunts')
    expect(user.endsWith('Question: Why?')).toBe(true)
  })

  test('trims long pages and says when a page has no text', () => {
    const long = buildAskPrompt({
      question: 'q',
      pageIndex: 0,
      pageText: 'a'.repeat(ASK_PAGE_TEXT_LIMIT + 50),
    }).user
    expect(long).toContain('a'.repeat(ASK_PAGE_TEXT_LIMIT) + ' …')
    expect(
      buildAskPrompt({ question: 'q', pageIndex: 0, pageText: ' ' }).user,
    ).toContain('no extractable text')
  })
})

describe('streaming', () => {
  test('parseSseChunk splits complete events and keeps the remainder', () => {
    const parsed = parseSseChunk('data: {"a":1}\n\ndata: [DONE]\n\ndata: {"b"')
    expect(parsed.events).toEqual(['{"a":1}', '[DONE]'])
    expect(parsed.rest).toBe('data: {"b"')
  })

  test('streamAnswer accumulates iterables and accepts plain promises', async () => {
    const seen: string[] = []
    expect(await streamAnswer(chunks('Hel', 'lo'), (t) => seen.push(t))).toBe(
      'Hello',
    )
    expect(seen).toEqual(['Hel', 'Hello'])
    expect(await streamAnswer(Promise.resolve('Hi'), () => {})).toBe('Hi')
  })

  test('chainAiAdapters uses the first available adapter', async () => {
    const off: BookPreviewAiAdapter = {
      label: 'off',
      isAvailable: () => false,
      ask: () => Promise.resolve('never'),
    }
    const on: BookPreviewAiAdapter = {
      label: 'on',
      isAvailable: async () => true,
      ask: () => chunks('ok'),
    }
    const chain = chainAiAdapters(off, on)
    expect(await chain.isAvailable?.()).toBe(true)
    expect(chain.label).toBe('on')
    const answer = await streamAnswer(
      chain.ask(
        { question: 'q', pageIndex: 0, pageText: '' },
        { signal: new AbortController().signal },
      ),
      () => {},
    )
    expect(answer).toBe('ok')
    expect(await chainAiAdapters(off).isAvailable?.()).toBe(false)
  })
})
