/**
 * "Ask" — a provider-agnostic hook for putting a model next to the page.
 *
 * The reader never talks to a vendor itself. A host passes an adapter: the
 * on-device one below (Chrome's built-in model — private, free, offline), an
 * OpenAI-compatible endpoint (Ollama or LM Studio on localhost), or its own
 * server route that holds the API key. Every adapter gets the same grounded
 * context — the selection, the page text, the document title — and streams
 * text back.
 */

export type BookPreviewAskRequest = {
  question: string
  /** The passage the reader selected, if the question is about one. */
  selection?: string
  pageIndex: number
  /** Plain text of the current page (and the facing page in spreads). */
  pageText: string
  title?: string
  author?: string
}

export type BookPreviewAiAdapter = {
  /** Shown under the answer, e.g. "On-device · Gemini Nano". */
  label: string
  /** Resolves false when the adapter cannot run here; the Ask tab then
      explains instead of failing mid-question. */
  isAvailable?: () => Promise<boolean> | boolean
  ask: (
    request: BookPreviewAskRequest,
    options: { signal: AbortSignal },
  ) => AsyncIterable<string> | Promise<string>
}

/** Page text past this is trimmed from the prompt — enough for a dense page
    and its facing page, small enough for on-device context windows. */
export const ASK_PAGE_TEXT_LIMIT = 6000

export const ASK_SYSTEM_PROMPT =
  'You are a reading companion inside a book and document reader. Answer ' +
  'using the provided page text first; say plainly when the page does not ' +
  'contain the answer and you are drawing on general knowledge. Be concise ' +
  'and concrete. Quote short phrases from the page when they help.'

export const ASK_QUICK_PROMPTS = [
  { label: 'Explain', question: 'Explain this in simple terms.' },
  { label: 'Summarize page', question: 'Summarize this page in 3 bullets.' },
  { label: 'Define', question: 'Define the key terms here.' },
  {
    label: 'Quiz me',
    question: 'Ask me 3 questions to check I understood this page.',
  },
] as const

export function buildAskPrompt(request: BookPreviewAskRequest): {
  system: string
  user: string
} {
  const page = request.pageText.replace(/\s+/g, ' ').trim()
  const trimmed =
    page.length > ASK_PAGE_TEXT_LIMIT
      ? `${page.slice(0, ASK_PAGE_TEXT_LIMIT)} …`
      : page
  const parts: string[] = []
  const doc = [request.title, request.author && `by ${request.author}`]
    .filter(Boolean)
    .join(' ')
  if (doc) parts.push(`Document: ${doc}`)
  parts.push(
    `Page ${request.pageIndex + 1} text:\n"""\n${trimmed || '(no extractable text on this page)'}\n"""`,
  )
  if (request.selection?.trim()) {
    parts.push(
      `The reader selected this passage:\n"""\n${request.selection.replace(/\s+/g, ' ').trim()}\n"""`,
    )
  }
  parts.push(`Question: ${request.question.trim()}`)
  return { system: ASK_SYSTEM_PROMPT, user: parts.join('\n\n') }
}

/** Collects an adapter's answer as it streams, whether it returned a
    string or an async iterable of chunks. */
export async function streamAnswer(
  result: AsyncIterable<string> | Promise<string>,
  onChunk: (text: string) => void,
): Promise<string> {
  if (typeof (result as Promise<string>).then === 'function') {
    const text = await (result as Promise<string>)
    onChunk(text)
    return text
  }
  let text = ''
  for await (const chunk of result as AsyncIterable<string>) {
    text += chunk
    onChunk(text)
  }
  return text
}

type BuiltInLanguageModel = {
  availability: () => Promise<string>
  create: (options: {
    initialPrompts?: { role: 'system'; content: string }[]
    signal?: AbortSignal
  }) => Promise<{
    promptStreaming: (
      input: string,
      options?: { signal?: AbortSignal },
    ) => AsyncIterable<string>
    destroy: () => void
  }>
}

function builtInModel(): BuiltInLanguageModel | null {
  const candidate = (globalThis as { LanguageModel?: BuiltInLanguageModel })
    .LanguageModel
  return candidate && typeof candidate.create === 'function' ? candidate : null
}

/**
 * The browser's own on-device model (Chrome's Prompt API). Nothing leaves
 * the machine and there is no key to manage. Unavailable in other browsers,
 * so hosts usually chain it before a server adapter.
 */
export function createBuiltInAiAdapter(): BookPreviewAiAdapter {
  return {
    label: 'On-device model',
    async isAvailable() {
      const model = builtInModel()
      if (!model) return false
      try {
        return (await model.availability()) !== 'unavailable'
      } catch {
        return false
      }
    },
    async *ask(request, { signal }) {
      const model = builtInModel()
      if (!model) throw new Error('The on-device model is not available here.')
      const prompt = buildAskPrompt(request)
      const session = await model.create({
        initialPrompts: [{ role: 'system', content: prompt.system }],
        signal,
      })
      try {
        let previous = ''
        for await (const chunk of session.promptStreaming(prompt.user, {
          signal,
        })) {
          // Early Chrome builds streamed the whole answer so far; later ones
          // stream deltas. Accept both.
          if (chunk.startsWith(previous) && previous) {
            yield chunk.slice(previous.length)
            previous = chunk
          } else {
            yield chunk
            previous += chunk
          }
        }
      } finally {
        session.destroy()
      }
    },
  }
}

/** Parses one server-sent-events buffer into complete `data:` payloads and
    the unfinished remainder. */
export function parseSseChunk(buffer: string): {
  events: string[]
  rest: string
} {
  const events: string[] = []
  const blocks = buffer.split(/\r?\n\r?\n/)
  const rest = blocks.pop() ?? ''
  for (const block of blocks) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (data) events.push(data)
  }
  return { events, rest }
}

/**
 * Any OpenAI-compatible chat endpoint — Ollama (`http://localhost:11434/v1`),
 * LM Studio, vLLM, or a hosted gateway. For local models the page itself can
 * call localhost; for hosted ones, point `baseUrl` at your own proxy so keys
 * never reach the browser.
 */
export function createOpenAICompatibleAdapter(options: {
  baseUrl: string
  model: string
  label?: string
  headers?: Record<string, string>
}): BookPreviewAiAdapter {
  const base = options.baseUrl.replace(/\/$/, '')
  return {
    label: options.label ?? options.model,
    // A quick look at /models tells a running local server from a closed
    // port, so the Ask tab can explain instead of failing mid-question.
    async isAvailable() {
      try {
        const response = await fetch(`${base}/models`, {
          headers: options.headers,
          signal: AbortSignal.timeout(1500),
        })
        return response.ok
      } catch {
        return false
      }
    },
    async *ask(request, { signal }) {
      const prompt = buildAskPrompt(request)
      const response = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', ...options.headers },
        body: JSON.stringify({
          model: options.model,
          stream: true,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user },
          ],
        }),
      })
      if (!response.ok || !response.body) {
        throw new Error(`The model endpoint answered ${response.status}.`)
      }
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += value
        const parsed = parseSseChunk(buffer)
        buffer = parsed.rest
        for (const data of parsed.events) {
          if (data === '[DONE]') return
          try {
            const delta = JSON.parse(data)?.choices?.[0]?.delta?.content
            if (typeof delta === 'string' && delta) yield delta
          } catch {
            // Keep-alive comments and partial frames are not answers.
          }
        }
      }
    },
  }
}

/**
 * Posts the request to the host's own route and streams the plain-text
 * response body. The route holds the provider key and picks the model — the
 * right shape for hosted models (Claude, GPT, Gemini) in production.
 */
export function createFetchAiAdapter(options: {
  url: string
  label?: string
  headers?: Record<string, string>
}): BookPreviewAiAdapter {
  return {
    label: options.label ?? 'Assistant',
    async *ask(request, { signal }) {
      const response = await fetch(options.url, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', ...options.headers },
        body: JSON.stringify({ ...request, prompt: buildAskPrompt(request) }),
      })
      if (!response.ok || !response.body) {
        throw new Error(`The assistant answered ${response.status}.`)
      }
      const reader = response.body
        .pipeThrough(new TextDecoderStream())
        .getReader()
      while (true) {
        const { value, done } = await reader.read()
        if (done) return
        if (value) yield value
      }
    },
  }
}

/** Tries adapters in order and uses the first that is available — e.g.
    on-device first, then the host's server route. */
export function chainAiAdapters(
  ...adapters: BookPreviewAiAdapter[]
): BookPreviewAiAdapter {
  let chosen: BookPreviewAiAdapter | null | undefined
  const choose = async () => {
    if (chosen !== undefined) return chosen
    for (const adapter of adapters) {
      const ok = adapter.isAvailable ? await adapter.isAvailable() : true
      if (ok) {
        chosen = adapter
        return adapter
      }
    }
    chosen = null
    return null
  }
  return {
    get label() {
      return chosen?.label ?? adapters.map((item) => item.label).join(' / ')
    },
    async isAvailable() {
      return (await choose()) !== null
    },
    async *ask(request, options) {
      const adapter = await choose()
      if (!adapter) throw new Error('No assistant is available here.')
      const result = adapter.ask(request, options)
      if (typeof (result as Promise<string>).then === 'function') {
        yield await (result as Promise<string>)
        return
      }
      yield* result as AsyncIterable<string>
    },
  }
}
