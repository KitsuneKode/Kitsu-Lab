import { extractPdfPageText, type PdfDocumentProxy } from '../pdf-runtime'

export type PdfSearchHit = {
  /** 1-based page number. */
  page: number
  /** Occurrences of the query on that page. */
  count: number
}

export function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let from = 0
  for (;;) {
    const hit = haystack.indexOf(needle, from)
    if (hit === -1) return count
    count += 1
    from = hit + needle.length
  }
}

/**
 * Page-text index for in-document search.
 *
 * Text is extracted per page and cached for the document's lifetime, so the
 * first query costs one pass over the file and later queries are free. The
 * sequential walk yields between pages, which keeps the UI responsive on
 * long documents; `isCancelled` lets a new query abandon the walk early.
 */
export function createPdfSearchIndex(doc: PdfDocumentProxy) {
  const cache = new Map<number, Promise<string>>()

  const pageText = (pageNumber: number): Promise<string> => {
    const cached = cache.get(pageNumber)
    if (cached) return cached
    const task = doc
      .getPage(pageNumber)
      .then((page) => extractPdfPageText(page))
      .catch(() => '')
    cache.set(pageNumber, task)
    return task
  }

  const search = async (
    query: string,
    isCancelled: () => boolean,
  ): Promise<PdfSearchHit[]> => {
    const needle = query.trim().toLowerCase()
    if (!needle) return []
    const hits: PdfSearchHit[] = []
    for (let page = 1; page <= doc.numPages; page += 1) {
      if (isCancelled()) return []
      const text = await pageText(page)
      if (isCancelled()) return []
      const count = countOccurrences(text.toLowerCase(), needle)
      if (count > 0) hits.push({ page, count })
    }
    return hits
  }

  return { search, pageText }
}

export const PDF_SEARCH_HIT_ATTR = 'data-pdf-search-hit'

/**
 * Marks every text-layer span intersecting a query match. Spans carry one
 * text item each, so a phrase can straddle several spans — offsets are
 * accumulated over the concatenated text so all of them light up, the same
 * way the browser's own find highlights a range.
 */
export function highlightTextLayer(
  container: HTMLElement,
  query: string,
): number {
  const needle = query.trim().toLowerCase()
  const spans = Array.from(
    container.querySelectorAll<HTMLElement>('span:not(.markedContent)'),
  )
  for (const span of spans) span.removeAttribute(PDF_SEARCH_HIT_ATTR)
  if (!needle) return 0

  let text = ''
  const offsets: { start: number; end: number; el: HTMLElement }[] = []
  for (const span of spans) {
    const content = span.textContent ?? ''
    offsets.push({
      start: text.length,
      end: text.length + content.length,
      el: span,
    })
    text += content
  }
  const haystack = text.toLowerCase()

  let total = 0
  let from = 0
  for (;;) {
    const hit = haystack.indexOf(needle, from)
    if (hit === -1) break
    const hitEnd = hit + needle.length
    for (const { start, end, el } of offsets) {
      if (end > hit && start < hitEnd) el.setAttribute(PDF_SEARCH_HIT_ATTR, '')
    }
    total += 1
    from = hitEnd
  }
  return total
}
