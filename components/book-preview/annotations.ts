/**
 * Highlights, notes, and bookmarks — the pure half. No DOM here, so bun tests
 * it directly; the browser half (text indexing, ranges, painting) lives in
 * annotation-dom.ts.
 *
 * Anchoring follows the W3C Web Annotation TextQuoteSelector: a highlight
 * remembers the exact words plus a little context either side, never DOM
 * positions. The PDF text layer is rebuilt on every zoom and differs between
 * views, so node offsets would rot within seconds; a quote survives zoom,
 * view switches, reloads, and devices.
 */

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink'] as const
export type BookPreviewHighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export type BookPreviewTextQuote = {
  exact: string
  prefix: string
  suffix: string
}

type AnnotationBase = {
  id: string
  /** Zero-based page the annotation belongs to. */
  pageIndex: number
  /** Epoch milliseconds — lets a sync backend resolve conflicts
      last-write-wins without inventing its own clock. */
  createdAt: number
  updatedAt: number
}

export type BookPreviewHighlight = AnnotationBase & {
  kind: 'highlight'
  quote: BookPreviewTextQuote
  color: BookPreviewHighlightColor
  note?: string
}

export type BookPreviewBookmark = AnnotationBase & {
  kind: 'bookmark'
  label?: string
}

export type BookPreviewAnnotation = BookPreviewHighlight | BookPreviewBookmark

export const QUOTE_CONTEXT_CHARS = 32

let idCounter = 0
export function createAnnotationId(): string {
  idCounter += 1
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `ann_${Date.now().toString(36)}_${random}${idCounter}`
}

export function createHighlight(input: {
  pageIndex: number
  quote: BookPreviewTextQuote
  color: BookPreviewHighlightColor
  note?: string
}): BookPreviewHighlight {
  const now = Date.now()
  return {
    id: createAnnotationId(),
    kind: 'highlight',
    createdAt: now,
    updatedAt: now,
    ...input,
  }
}

/** Applies an edit and stamps `updatedAt` — the field sync merges on. */
export function editAnnotation<T extends BookPreviewAnnotation>(
  item: T,
  patch: Partial<Omit<T, 'id' | 'kind' | 'createdAt'>>,
): T {
  return { ...item, ...patch, updatedAt: Date.now() }
}

/** Collapses runs of whitespace — text layers and page markup disagree on
    spacing, and a quote must match either way. */
export function normalizeQuoteText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Builds a quote selector for [start, end) of a page's text. */
export function createTextQuote(
  text: string,
  start: number,
  end: number,
  context = QUOTE_CONTEXT_CHARS,
): BookPreviewTextQuote {
  const from = Math.max(0, Math.min(start, end))
  const to = Math.min(text.length, Math.max(start, end))
  return {
    exact: text.slice(from, to),
    prefix: text.slice(Math.max(0, from - context), from),
    suffix: text.slice(to, to + context),
  }
}

function commonSuffixLength(a: string, b: string): number {
  let count = 0
  while (
    count < a.length &&
    count < b.length &&
    a[a.length - 1 - count] === b[b.length - 1 - count]
  ) {
    count += 1
  }
  return count
}

function commonPrefixLength(a: string, b: string): number {
  let count = 0
  while (count < a.length && count < b.length && a[count] === b[count]) {
    count += 1
  }
  return count
}

/** Strips all whitespace and keeps, for each kept character, its offset in
    the original string. Text layers, page markup, and extracted text disagree
    about spaces between runs ("hello world" vs "helloworld"), so matching
    happens on the compacted form and maps back. */
export function compactWithMap(text: string): { text: string; map: number[] } {
  const map: number[] = []
  let out = ''
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (/\s/.test(char)) continue
    out += char
    map.push(index)
  }
  return { text: out, map }
}

const compact = (text: string) => text.replace(/\s+/g, '')

/**
 * Finds a quote in a page's text and returns its [start, end) offsets into
 * the original text, or null. Matching ignores whitespace, so a quote taken
 * in one view (the PDF text layer) still lands in another (the text view).
 * When the words occur more than once (a repeated phrase, a running header),
 * the surrounding context picks the right occurrence.
 */
export function locateTextQuote(
  text: string,
  quote: BookPreviewTextQuote,
): { start: number; end: number } | null {
  const exact = compact(quote.exact)
  if (!exact) return null
  const haystack = compactWithMap(text)
  const prefix = compact(quote.prefix)
  const suffix = compact(quote.suffix)
  const hits: number[] = []
  let from = haystack.text.indexOf(exact)
  while (from !== -1) {
    hits.push(from)
    from = haystack.text.indexOf(exact, from + 1)
  }
  if (hits.length === 0) return null
  let best = hits[0]
  if (hits.length > 1) {
    let bestScore = -1
    for (const hit of hits) {
      const before = haystack.text.slice(Math.max(0, hit - prefix.length), hit)
      const after = haystack.text.slice(
        hit + exact.length,
        hit + exact.length + suffix.length,
      )
      const score =
        commonSuffixLength(before, prefix) + commonPrefixLength(after, suffix)
      if (score > bestScore) {
        best = hit
        bestScore = score
      }
    }
  }
  const start = haystack.map[best]
  const end = haystack.map[best + exact.length - 1] + 1
  return { start, end }
}

/** Page order, then creation order — the order a reader meets them. */
export function sortAnnotations<T extends BookPreviewAnnotation>(
  list: readonly T[],
): T[] {
  return [...list].sort(
    (a, b) => a.pageIndex - b.pageIndex || a.createdAt - b.createdAt,
  )
}

export function upsertAnnotation(
  list: readonly BookPreviewAnnotation[],
  next: BookPreviewAnnotation,
): BookPreviewAnnotation[] {
  const index = list.findIndex((item) => item.id === next.id)
  if (index === -1) return [...list, next]
  const copy = [...list]
  copy[index] = next
  return copy
}

export function removeAnnotation(
  list: readonly BookPreviewAnnotation[],
  id: string,
): BookPreviewAnnotation[] {
  return list.filter((item) => item.id !== id)
}

export function findBookmark(
  list: readonly BookPreviewAnnotation[],
  pageIndex: number,
): BookPreviewBookmark | undefined {
  return list.find(
    (item): item is BookPreviewBookmark =>
      item.kind === 'bookmark' && item.pageIndex === pageIndex,
  )
}

export function toggleBookmark(
  list: readonly BookPreviewAnnotation[],
  pageIndex: number,
  now = Date.now(),
): BookPreviewAnnotation[] {
  const existing = findBookmark(list, pageIndex)
  if (existing) return removeAnnotation(list, existing.id)
  return [
    ...list,
    {
      id: createAnnotationId(),
      kind: 'bookmark',
      pageIndex,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/** Highlights whose [start, end) on a page contains `offset`. Newest first,
    so a tap on overlapping highlights edits the one made last. */
export function highlightsAt(
  located: readonly { id: string; start: number; end: number }[],
  offset: number,
): string[] {
  return located
    .filter((item) => offset >= item.start && offset < item.end)
    .map((item) => item.id)
    .reverse()
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object'

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

/** Drops anything malformed from stored or synced data rather than letting
    one bad record break the whole notebook. */
export function sanitizeAnnotations(raw: unknown): BookPreviewAnnotation[] {
  if (!Array.isArray(raw)) return []
  const out: BookPreviewAnnotation[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    if (typeof item.id !== 'string' || !item.id) continue
    if (!isFiniteNumber(item.pageIndex) || item.pageIndex < 0) continue
    const createdAt = isFiniteNumber(item.createdAt) ? item.createdAt : 0
    const updatedAt = isFiniteNumber(item.updatedAt)
      ? item.updatedAt
      : createdAt
    const base = {
      id: item.id,
      pageIndex: Math.trunc(item.pageIndex),
      createdAt,
      updatedAt,
    }
    if (item.kind === 'bookmark') {
      out.push({
        ...base,
        kind: 'bookmark',
        ...(typeof item.label === 'string' ? { label: item.label } : {}),
      })
      continue
    }
    if (item.kind !== 'highlight' || !isRecord(item.quote)) continue
    const quote = item.quote
    if (typeof quote.exact !== 'string' || !quote.exact) continue
    const color = (HIGHLIGHT_COLORS as readonly string[]).includes(
      item.color as string,
    )
      ? (item.color as BookPreviewHighlightColor)
      : 'yellow'
    out.push({
      ...base,
      kind: 'highlight',
      color,
      quote: {
        exact: quote.exact,
        prefix: typeof quote.prefix === 'string' ? quote.prefix : '',
        suffix: typeof quote.suffix === 'string' ? quote.suffix : '',
      },
      ...(typeof item.note === 'string' && item.note
        ? { note: item.note }
        : {}),
    })
  }
  return out
}

export function annotationsStorageKey(sourceKey: string): string {
  return `book-preview:annotations:${sourceKey}`
}

/** A reader's notebook as Markdown — quotes as blockquotes, notes beneath,
    bookmarks as a list — ready for Obsidian, Notion, or an email. */
export function annotationsToMarkdown(
  list: readonly BookPreviewAnnotation[],
  meta: { title?: string; author?: string } = {},
): string {
  const lines: string[] = []
  lines.push(`# ${meta.title ?? 'Reading notes'}`)
  if (meta.author) lines.push('', `_${meta.author}_`)
  const sorted = sortAnnotations(list)
  const bookmarks = sorted.filter((item) => item.kind === 'bookmark')
  const highlights = sorted.filter(
    (item): item is BookPreviewHighlight => item.kind === 'highlight',
  )
  if (bookmarks.length > 0) {
    lines.push('', '## Bookmarks', '')
    for (const mark of bookmarks) {
      lines.push(
        `- Page ${mark.pageIndex + 1}${mark.label ? ` — ${mark.label}` : ''}`,
      )
    }
  }
  if (highlights.length > 0) {
    lines.push('', '## Highlights')
    for (const item of highlights) {
      lines.push(
        '',
        `**Page ${item.pageIndex + 1}** · ${item.color}`,
        '',
        `> ${normalizeQuoteText(item.quote.exact)}`,
      )
      if (item.note) lines.push('', item.note.trim())
    }
  }
  if (bookmarks.length === 0 && highlights.length === 0) {
    lines.push('', '_No highlights or bookmarks yet._')
  }
  return `${lines.join('\n')}\n`
}
