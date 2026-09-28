/**
 * Follows narration word by word: as the speech engine reaches a word, the
 * same word lights up on the page, with the CSS Custom Highlight API, so the
 * engine's DOM is never touched. Where the browser gives no word boundaries
 * (some network voices), or has no highlight API, nothing is painted and
 * reading carries on as before.
 */

const NAME = 'bp-speaking'
const STYLE_ID = 'bp-speaking-style'

/** The word spoken at `charIndex`; `charLength` when the engine provides it. */
export function spokenWord(
  text: string,
  charIndex: number,
  charLength?: number,
): string {
  if (charIndex < 0 || charIndex >= text.length) return ''
  if (charLength && charLength > 0)
    return text.slice(charIndex, charIndex + charLength).trim()
  const match = /^[\p{L}\p{N}'’-]+/u.exec(text.slice(charIndex))
  return match ? match[0] : ''
}

/**
 * The next whole-word, case-insensitive occurrence of `word` in `haystack`
 * at or after `from`; -1 when there is none. Reading moves forward, so a
 * repeated word lights up where the voice actually is.
 */
export function nextWordMatch(
  haystack: string,
  word: string,
  from: number,
): number {
  if (!word) return -1
  const lower = haystack.toLowerCase()
  const needle = word.toLowerCase()
  const isWordChar = (char: string | undefined) =>
    char !== undefined && /[\p{L}\p{N}]/u.test(char)
  for (
    let at = lower.indexOf(needle, Math.max(0, from));
    at !== -1;
    at = lower.indexOf(needle, at + 1)
  ) {
    if (!isWordChar(lower[at - 1]) && !isWordChar(lower[at + needle.length]))
      return at
  }
  return -1
}

/**
 * Joins text nodes into one searchable string, a space between each, so
 * words that meet at a node edge ("Preface" then "Ornithologia") stay two
 * words. `starts[i]` is where part `i` begins in `text`.
 */
export function joinParts(parts: readonly string[]): {
  text: string
  starts: number[]
} {
  let text = ''
  const starts: number[] = []
  for (const part of parts) {
    if (text) text += ' '
    starts.push(text.length)
    text += part
  }
  return { text, starts }
}

/**
 * Where the spoken `word` is: forward from the cursor first; failing that,
 * from the top, since a voice may read page furniture (a running head) in
 * a different order from the page.
 */
export function followWord(text: string, word: string, cursor: number) {
  const ahead = nextWordMatch(text, word, cursor)
  return ahead === -1 ? nextWordMatch(text, word, 0) : ahead
}

type HighlightRegistry = Map<string, unknown>
type HighlightConstructor = new (...ranges: Range[]) => unknown

function api(): {
  registry: HighlightRegistry
  Highlight: HighlightConstructor
} | null {
  if (typeof globalThis.CSS === 'undefined') return null
  const registry = (globalThis.CSS as { highlights?: HighlightRegistry })
    .highlights
  const Highlight = (globalThis as { Highlight?: HighlightConstructor })
    .Highlight
  return registry && Highlight ? { registry, Highlight } : null
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return
  const style = document.createElement('style')
  style.id = STYLE_ID
  // Injected at runtime: build-time CSS parsers do not know ::highlight().
  style.textContent = `::highlight(${NAME}) {
  background-color: color-mix(in oklab, var(--primary, #2563eb) 24%, transparent);
  color: inherit;
}
@media (forced-colors: active) { ::highlight(${NAME}) { background-color: Highlight; color: HighlightText; } }`
  document.head.append(style)
}

export type SpeechFollower = { at: (word: string) => void; clear: () => void }

/** Lights up spoken words inside `root`, moving forward through its text. */
export function createSpeechFollower(root: Element): SpeechFollower {
  const highlights = api()
  const nodes: Text[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode())
    nodes.push(node as Text)
  const { text, starts } = joinParts(nodes.map((n) => n.textContent ?? ''))
  const segments = nodes.map((node, i) => ({ node, start: starts[i]! }))
  let cursor = 0

  const locate = (offset: number) => {
    let low = 0
    let high = segments.length - 1
    while (low < high) {
      const mid = (low + high + 1) >> 1
      if (segments[mid]!.start <= offset) low = mid
      else high = mid - 1
    }
    const segment = segments[low]!
    return { node: segment.node, offset: offset - segment.start }
  }

  return {
    at(word) {
      if (!highlights || segments.length === 0) return
      const index = followWord(text, word, cursor)
      if (index === -1) return
      const start = locate(index)
      const end = locate(index + word.length)
      const range = document.createRange()
      range.setStart(start.node, start.offset)
      range.setEnd(end.node, end.offset)
      ensureStyle()
      highlights.registry.set(NAME, new highlights.Highlight(range))
      cursor = index + word.length
    },
    clear() {
      highlights?.registry.delete(NAME)
    },
  }
}
