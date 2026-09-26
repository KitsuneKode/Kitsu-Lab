'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useBookPreview } from './book-preview-provider'
import {
  IconCopy,
  IconNote,
  IconShare,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  HIGHLIGHT_COLORS,
  createHighlight,
  createTextQuote,
  editAnnotation,
  highlightsAt,
  locateTextQuote,
  normalizeQuoteText,
  removeAnnotation,
  upsertAnnotation,
  type BookPreviewHighlight,
  type BookPreviewHighlightColor,
  type BookPreviewTextQuote,
} from './annotations'
import {
  ANNOTATABLE_SELECTOR,
  annotatableFor,
  buildTextIndex,
  caretFromPoint,
  clearHighlights,
  offsetFromPoint,
  pageIndexOf,
  paintHighlights,
  rangeFromOffsets,
  supportsHighlightPainting,
} from './annotation-dom'
import { formatQuoteForShare } from './share'

export const HIGHLIGHT_SWATCHES: Record<
  BookPreviewHighlightColor,
  { label: string; fill: string }
> = {
  yellow: { label: 'Yellow', fill: 'rgb(250 204 21)' },
  green: { label: 'Green', fill: 'rgb(74 222 128)' },
  blue: { label: 'Blue', fill: 'rgb(96 165 250)' },
  pink: { label: 'Pink', fill: 'rgb(244 114 182)' },
}

/** The four highlight inks plus a transient "you jumped here" flash. */
const PAINT_COLORS = HIGHLIGHT_COLORS

type Anchor = {
  top: number
  bottom: number
  left: number
  width: number
  /** The reader's width when the card opened — for edge clamping. */
  rootWidth: number
}

type Card =
  | {
      mode: 'selection'
      pageIndex: number
      quote: BookPreviewTextQuote
      anchor: Anchor
    }
  | { mode: 'highlight'; id: string; anchor: Anchor }
  | { mode: 'note'; id: string; anchor: Anchor }

const CARD_GAP = 10

function anchorFromRect(rect: DOMRect, root: HTMLElement): Anchor {
  const box = root.getBoundingClientRect()
  return {
    top: rect.top - box.top,
    bottom: rect.bottom - box.top,
    left: rect.left - box.left,
    width: rect.width,
    rootWidth: box.width,
  }
}

/**
 * Highlights and notes, engine-agnostic. Any page surface that marks its
 * text root `data-bp-annotatable` + `data-page-index` (premier faces, the PDF
 * text layer, page leaves) gets: highlights painted from the notebook, a
 * floating card on selection (four inks, note, copy, ask), and a tap on an
 * existing highlight to recolour, annotate, or delete it.
 *
 * Painting uses the CSS Custom Highlight API, so the DOM the engines own is
 * never touched — a MutationObserver simply repaints when a text layer or
 * face re-renders.
 */
export function BookPreviewAnnotationLayer() {
  const {
    annotate,
    annotations,
    updateAnnotations,
    rootRef,
    ai,
    openCompanion,
    finePointer,
    share,
    sharePage,
    source,
    uploaded,
  } = useBookPreview()
  const instanceId = useId()
  const [card, setCard] = useState<Card | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const pointerDownRef = useRef(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  const highlights = useMemo(
    () =>
      annotations.filter(
        (item): item is BookPreviewHighlight => item.kind === 'highlight',
      ),
    [annotations],
  )
  const byId = useMemo(
    () => new Map(highlights.map((item) => [item.id, item])),
    [highlights],
  )

  // Paint every visible page's highlights, and repaint whenever an engine
  // rebuilds a text layer or swaps a face (coalesced to one frame).
  useEffect(() => {
    const root = rootRef.current
    if (!annotate || !root || !supportsHighlightPainting()) return
    const byPage = new Map<number, BookPreviewHighlight[]>()
    for (const item of highlights) {
      const list = byPage.get(item.pageIndex) ?? []
      list.push(item)
      byPage.set(item.pageIndex, list)
    }
    let frame = 0
    const paint = () => {
      frame = 0
      const byColor = new Map<BookPreviewHighlightColor, Range[]>()
      if (byPage.size > 0) {
        for (const container of root.querySelectorAll<HTMLElement>(
          ANNOTATABLE_SELECTOR,
        )) {
          const page = pageIndexOf(container)
          const list = page === null ? undefined : byPage.get(page)
          if (!list) continue
          const index = buildTextIndex(container)
          for (const item of list) {
            const found = locateTextQuote(index.text, item.quote)
            if (!found) continue
            const range = rangeFromOffsets(index, found.start, found.end)
            if (!range) continue
            const ranges = byColor.get(item.color) ?? []
            ranges.push(range)
            byColor.set(item.color, ranges)
          }
        }
      }
      paintHighlights(instanceId, byColor, PAINT_COLORS)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(paint)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
    })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
      clearHighlights(instanceId, PAINT_COLORS)
    }
  }, [annotate, highlights, instanceId, rootRef])

  const close = useCallback(() => {
    setCard(null)
    setCopied(false)
  }, [])

  // Selection → card. Waits for the pointer to lift so the card never
  // flickers along with a drag, and ignores selections outside page text.
  useEffect(() => {
    const root = rootRef.current
    if (!annotate || !root) return
    let frame = 0
    const read = () => {
      frame = 0
      if (pointerDownRef.current) return
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        setCard((current) => (current?.mode === 'selection' ? null : current))
        return
      }
      const range = selection.getRangeAt(0)
      const container = annotatableFor(range.startContainer)
      if (
        !container ||
        !root.contains(container) ||
        annotatableFor(range.endContainer) !== container
      ) {
        return
      }
      const pageIndex = pageIndexOf(container)
      if (pageIndex === null) return
      const index = buildTextIndex(container)
      const start = offsetFromPoint(
        index,
        range.startContainer,
        range.startOffset,
      )
      const end = offsetFromPoint(index, range.endContainer, range.endOffset)
      const quote = createTextQuote(index.text, start, end)
      if (!normalizeQuoteText(quote.exact)) return
      const rects = range.getClientRects()
      const rect = rects.length > 0 ? rects[0] : range.getBoundingClientRect()
      const last = rects.length > 0 ? rects[rects.length - 1] : rect
      const anchor = anchorFromRect(rect, root)
      anchor.bottom = last.bottom - root.getBoundingClientRect().top
      setCopied(false)
      setCard({ mode: 'selection', pageIndex, quote, anchor })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read)
    }
    const onDown = (event: PointerEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return
      pointerDownRef.current = true
    }
    const onUp = () => {
      pointerDownRef.current = false
      schedule()
    }
    document.addEventListener('selectionchange', schedule)
    root.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('selectionchange', schedule)
      root.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [annotate, rootRef])

  // Tapping painted text opens that highlight's card.
  useEffect(() => {
    const root = rootRef.current
    if (!annotate || !root || highlights.length === 0) return
    const onClick = (event: MouseEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return
      // A tap with the pen out is a dot of ink, not a highlight lookup.
      if (
        (event.target as Element).closest?.(
          '[data-bp-ink-surface][data-active]',
        )
      ) {
        return
      }
      const selection = window.getSelection()
      if (selection && !selection.isCollapsed) return
      const caret = caretFromPoint(event.clientX, event.clientY)
      if (!caret) return
      const container = annotatableFor(caret.node)
      if (!container || !root.contains(container)) return
      const page = pageIndexOf(container)
      if (page === null) return
      const onPage = highlights.filter((item) => item.pageIndex === page)
      if (onPage.length === 0) return
      const index = buildTextIndex(container)
      const offset = offsetFromPoint(index, caret.node, caret.offset)
      const located = onPage.flatMap((item) => {
        const found = locateTextQuote(index.text, item.quote)
        return found ? [{ id: item.id, ...found }] : []
      })
      const [hit] = highlightsAt(located, offset)
      if (!hit) return
      const found = located.find((item) => item.id === hit)
      const range = found
        ? rangeFromOffsets(index, found.start, found.end)
        : null
      if (!range) return
      event.stopPropagation()
      setCopied(false)
      setCard({
        mode: 'highlight',
        id: hit,
        anchor: anchorFromRect(range.getBoundingClientRect(), root),
      })
    }
    // Capture, so an engine's own tap-to-turn never also fires on the tap
    // that opened a highlight.
    root.addEventListener('click', onClick, true)
    return () => root.removeEventListener('click', onClick, true)
  }, [annotate, highlights, rootRef])

  // The card belongs to a spot on the page: scrolling, resizing, or turning
  // away dismisses it rather than leaving it floating over other text.
  useEffect(() => {
    const root = rootRef.current
    if (!card || !root) return
    const onScroll = (event: Event) => {
      if (cardRef.current?.contains(event.target as Node)) return
      if (card.mode !== 'note') close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
      }
    }
    const onDown = (event: PointerEvent) => {
      if (cardRef.current?.contains(event.target as Node)) return
      if (card.mode !== 'selection') close()
    }
    root.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    root.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      root.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
      root.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  }, [card, close, rootRef])

  // A highlight deleted elsewhere (the notebook, another tab) takes its card.
  const activeHighlight =
    card && card.mode !== 'selection' ? byId.get(card.id) : undefined
  if (card && card.mode !== 'selection' && !activeHighlight) {
    setCard(null)
  }

  if (!annotate || !card) return null

  const quoteText =
    card.mode === 'selection'
      ? normalizeQuoteText(card.quote.exact)
      : normalizeQuoteText(activeHighlight?.quote.exact ?? '')
  const pageIndex =
    card.mode === 'selection'
      ? card.pageIndex
      : (activeHighlight?.pageIndex ?? 0)

  const applyColor = (color: BookPreviewHighlightColor) => {
    if (card.mode === 'selection') {
      const created = createHighlight({
        pageIndex: card.pageIndex,
        quote: card.quote,
        color,
      })
      updateAnnotations((list) => upsertAnnotation(list, created))
      window.getSelection()?.removeAllRanges()
      setCard({ mode: 'highlight', id: created.id, anchor: card.anchor })
      return
    }
    if (!activeHighlight) return
    updateAnnotations((list) =>
      upsertAnnotation(list, editAnnotation(activeHighlight, { color })),
    )
  }

  const startNote = () => {
    if (card.mode === 'selection') {
      const created = createHighlight({
        pageIndex: card.pageIndex,
        quote: card.quote,
        color: 'yellow',
      })
      updateAnnotations((list) => upsertAnnotation(list, created))
      window.getSelection()?.removeAllRanges()
      setNoteDraft('')
      setCard({ mode: 'note', id: created.id, anchor: card.anchor })
      return
    }
    setNoteDraft(activeHighlight?.note ?? '')
    setCard({ mode: 'note', id: card.id, anchor: card.anchor })
  }

  const saveNote = () => {
    if (card.mode !== 'note' || !activeHighlight) return
    const note = noteDraft.trim()
    updateAnnotations((list) =>
      upsertAnnotation(
        list,
        editAnnotation(activeHighlight, { note: note || undefined }),
      ),
    )
    setCard({ mode: 'highlight', id: card.id, anchor: card.anchor })
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(quoteText)
      setCopied(true)
    } catch {
      // Clipboard permission denied — the native selection still copies.
    }
  }

  const remove = () => {
    if (card.mode === 'selection') return
    updateAnnotations((list) => removeAnnotation(list, card.id))
    close()
  }

  const shareQuote = () => {
    void sharePage({
      text: formatQuoteForShare({
        quote: quoteText,
        title: source.title ?? source.pdfFileName,
        pageIndex,
      }),
    }).then((outcome) => {
      if (outcome === 'copied') setCopied(true)
    })
  }

  const ask = () => {
    openCompanion('ask', { selection: quoteText, pageIndex })
    window.getSelection()?.removeAllRanges()
    close()
  }

  // Above the passage on fine pointers; below on touch, where the OS draws
  // its own copy/paste bubble above the selection.
  const rootWidth = card.anchor.rootWidth
  const placeBelow = !finePointer || card.anchor.top < 72
  const center = card.anchor.left + card.anchor.width / 2
  const style: CSSProperties = {
    left: Math.min(Math.max(center, 150), Math.max(rootWidth - 150, 150)),
    top: placeBelow
      ? card.anchor.bottom + CARD_GAP
      : card.anchor.top - CARD_GAP,
  }

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={card.mode === 'note' ? 'Edit note' : 'Highlight'}
      data-book-preview-annotation-card
      data-placement={placeBelow ? 'below' : 'above'}
      className="bg-popover text-popover-foreground ring-foreground/10 absolute z-50 flex max-w-[min(20rem,calc(100%-1rem))] flex-col gap-2 rounded-xl p-1.5 shadow-lg ring-1"
      style={style}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {card.mode === 'note' ? (
        <form
          className="flex w-72 max-w-full flex-col gap-2 p-1"
          onSubmit={(event) => {
            event.preventDefault()
            saveNote()
          }}
        >
          <p className="text-muted-foreground line-clamp-2 border-l-2 pl-2 text-xs italic">
            {quoteText}
          </p>
          <textarea
            // A note card exists to be typed into.
            // oxlint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={noteDraft}
            onChange={(event) => setNoteDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                saveNote()
              }
            }}
            rows={3}
            placeholder="Add a note…"
            aria-label="Note"
            className="border-input focus-visible:border-ring focus-visible:ring-ring/50 min-h-20 w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-[3px]"
          />
          <div className="flex items-center justify-end gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setCard({ mode: 'highlight', id: card.id, anchor: card.anchor })
              }
              data-book-preview-press
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" data-book-preview-press>
              Save
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center gap-0.5">
            <div
              role="group"
              aria-label="Highlight colour"
              className="flex items-center gap-1 px-1"
            >
              {HIGHLIGHT_COLORS.map((color) => {
                const active = activeHighlight?.color === color
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={`${HIGHLIGHT_SWATCHES[color].label} highlight`}
                    aria-pressed={active}
                    onClick={() => applyColor(color)}
                    data-book-preview-press
                    className={cn(
                      'focus-visible:ring-ring/60 size-7 rounded-full border border-black/10 outline-none focus-visible:ring-2 sm:size-6',
                      active && 'ring-foreground ring-2 ring-offset-1',
                    )}
                    style={{ background: HIGHLIGHT_SWATCHES[color].fill }}
                  />
                )
              })}
            </div>
            <span aria-hidden className="bg-border mx-1 h-5 w-px" />
            <CardAction label="Note" onClick={startNote}>
              <IconNote />
            </CardAction>
            <CardAction label={copied ? 'Copied' : 'Copy'} onClick={copy}>
              <IconCopy />
            </CardAction>
            {share ? (
              <CardAction
                label={uploaded ? 'Share quote' : 'Share quote and link'}
                onClick={shareQuote}
              >
                <IconShare />
              </CardAction>
            ) : null}
            {ai ? (
              <CardAction label="Ask" onClick={ask}>
                <IconSparkles />
              </CardAction>
            ) : null}
            {card.mode === 'highlight' ? (
              <CardAction label="Remove highlight" onClick={remove}>
                <IconTrash />
              </CardAction>
            ) : null}
          </div>
          {card.mode === 'highlight' && activeHighlight?.note ? (
            <button
              type="button"
              onClick={startNote}
              className="text-muted-foreground hover:text-foreground line-clamp-3 max-w-72 px-2 pb-1 text-left text-xs transition-colors"
            >
              {activeHighlight.note}
            </button>
          ) : null}
        </>
      )}
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Copied to clipboard' : ''}
      </span>
    </div>
  )
}

function CardAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-book-preview-press
      className="min-h-9 min-w-9 sm:min-h-7 sm:min-w-7"
    >
      {children}
    </Button>
  )
}
