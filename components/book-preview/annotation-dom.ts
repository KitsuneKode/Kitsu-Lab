/**
 * The browser half of annotations: turning a page's DOM into one searchable
 * string, mapping selections to offsets and offsets back to ranges, and
 * painting highlights with the CSS Custom Highlight API.
 *
 * The Highlight API paints ranges without touching the DOM — no <mark>
 * wrappers splitting pdf.js spans or React-owned text nodes, nothing for a
 * re-render to throw away. Where it is missing, highlights still live in the
 * notebook; they simply are not painted on the page.
 */

import type { BookPreviewHighlightColor } from './annotations'

/** Pages that can carry highlights mark their text root with this attribute
    plus `data-page-index`. Folio labels and other chrome inside a page opt
    out with `data-bp-annotate-skip`. */
export const ANNOTATABLE_SELECTOR = '[data-bp-annotatable]'

export type TextIndex = {
  text: string
  nodes: { node: Text; start: number }[]
}

export function buildTextIndex(container: Element): TextIndex {
  const nodes: TextIndex['nodes'] = []
  let text = ''
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (!parent || parent.closest('[data-bp-annotate-skip]')) {
        return NodeFilter.FILTER_REJECT
      }
      return node.nodeValue
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT
    },
  })
  let current = walker.nextNode()
  while (current) {
    const node = current as Text
    nodes.push({ node, start: text.length })
    text += node.nodeValue ?? ''
    current = walker.nextNode()
  }
  return { text, nodes }
}

/** A DOM boundary point → offset into the index text. Element boundaries
    (a selection that starts "between" spans) resolve to the next text node. */
export function offsetFromPoint(
  index: TextIndex,
  node: Node,
  offset: number,
): number {
  if (node.nodeType === Node.TEXT_NODE) {
    const entry = index.nodes.find((item) => item.node === node)
    if (entry) return entry.start + Math.min(offset, entry.node.length)
  }
  const probe = document.createRange()
  try {
    probe.setStart(node, offset)
  } catch {
    return index.text.length
  }
  for (const entry of index.nodes) {
    // A text node at or after the point is where the selection really begins.
    if (probe.comparePoint(entry.node, 0) >= 0) return entry.start
    if (probe.comparePoint(entry.node, entry.node.length) >= 0) {
      return entry.start + entry.node.length
    }
  }
  return index.text.length
}

export function rangeFromOffsets(
  index: TextIndex,
  start: number,
  end: number,
): Range | null {
  if (end <= start || index.nodes.length === 0) return null
  const locate = (offset: number, preferNext: boolean) => {
    for (let i = 0; i < index.nodes.length; i += 1) {
      const entry = index.nodes[i]
      const nodeEnd = entry.start + entry.node.length
      if (offset < nodeEnd || (!preferNext && offset === nodeEnd)) {
        return { node: entry.node, offset: Math.max(0, offset - entry.start) }
      }
    }
    const last = index.nodes[index.nodes.length - 1]
    return { node: last.node, offset: last.node.length }
  }
  const from = locate(start, true)
  const to = locate(end, false)
  const range = document.createRange()
  try {
    range.setStart(from.node, from.offset)
    range.setEnd(to.node, to.offset)
  } catch {
    return null
  }
  return range
}

export function annotatableFor(node: Node | null): HTMLElement | null {
  const element = node instanceof Element ? node : (node?.parentElement ?? null)
  return (element?.closest(ANNOTATABLE_SELECTOR) as HTMLElement | null) ?? null
}

export function pageIndexOf(container: HTMLElement): number | null {
  const raw = Number.parseInt(container.dataset.pageIndex ?? '', 10)
  return Number.isFinite(raw) && raw >= 0 ? raw : null
}

/** The caret under a point — standard API first, WebKit's fallback second. */
export function caretFromPoint(
  x: number,
  y: number,
): { node: Node; offset: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (
      x: number,
      y: number,
    ) => { offsetNode: Node; offset: number } | null
    caretRangeFromPoint?: (x: number, y: number) => Range | null
  }
  if (typeof doc.caretPositionFromPoint === 'function') {
    const position = doc.caretPositionFromPoint(x, y)
    return position
      ? { node: position.offsetNode, offset: position.offset }
      : null
  }
  if (typeof doc.caretRangeFromPoint === 'function') {
    const range = doc.caretRangeFromPoint(x, y)
    return range
      ? { node: range.startContainer, offset: range.startOffset }
      : null
  }
  return null
}

type HighlightRegistry = {
  set: (name: string, highlight: unknown) => void
  delete: (name: string) => void
}

function highlightApi(): {
  registry: HighlightRegistry
  Highlight: new (...ranges: Range[]) => unknown
} | null {
  if (typeof window === 'undefined') return null
  const registry = (globalThis.CSS as { highlights?: HighlightRegistry })
    ?.highlights
  const Highlight = (
    globalThis as { Highlight?: new (...ranges: Range[]) => unknown }
  ).Highlight
  return registry && Highlight ? { registry, Highlight } : null
}

// Translucent inks so the page — a raster under a transparent text layer, or
// real text — reads through. Injected once per document rather than shipped
// in the stylesheet: build-time CSS parsers do not know ::highlight() yet.
const HIGHLIGHT_STYLES = `
::highlight(bp-hl-yellow) { background-color: rgb(250 204 21 / 0.38); }
::highlight(bp-hl-green) { background-color: rgb(74 222 128 / 0.34); }
::highlight(bp-hl-blue) { background-color: rgb(96 165 250 / 0.34); }
::highlight(bp-hl-pink) { background-color: rgb(244 114 182 / 0.34); }
@media (prefers-contrast: more) {
  ::highlight(bp-hl-yellow), ::highlight(bp-hl-green),
  ::highlight(bp-hl-blue), ::highlight(bp-hl-pink) {
    text-decoration: underline 2px;
  }
}`

function ensureHighlightStyles() {
  if (document.getElementById('bp-highlight-styles')) return
  const style = document.createElement('style')
  style.id = 'bp-highlight-styles'
  style.textContent = HIGHLIGHT_STYLES
  document.head.append(style)
}

export function supportsHighlightPainting(): boolean {
  return highlightApi() !== null
}

export const highlightName = (color: BookPreviewHighlightColor) =>
  `bp-hl-${color}`

// The registry is document-global and names are fixed (CSS must reference
// them), so every reader instance contributes its ranges here and one commit
// merges them — two readers on a page never erase each other.
const layers = new Map<string, Map<BookPreviewHighlightColor, Range[]>>()

function commit(colors: readonly BookPreviewHighlightColor[]) {
  const api = highlightApi()
  if (!api) return
  for (const color of colors) {
    const ranges: Range[] = []
    for (const layer of layers.values())
      ranges.push(...(layer.get(color) ?? []))
    if (ranges.length === 0) api.registry.delete(highlightName(color))
    else api.registry.set(highlightName(color), new api.Highlight(...ranges))
  }
}

export function paintHighlights(
  instance: string,
  byColor: Map<BookPreviewHighlightColor, Range[]>,
  colors: readonly BookPreviewHighlightColor[],
) {
  ensureHighlightStyles()
  layers.set(instance, byColor)
  commit(colors)
}

export function clearHighlights(
  instance: string,
  colors: readonly BookPreviewHighlightColor[],
) {
  layers.delete(instance)
  commit(colors)
}
