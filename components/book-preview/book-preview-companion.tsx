'use client'

import { cn } from '@/lib/utils'
import { useNarrowLayout } from './media'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useBookPreview } from './book-preview-provider'
import { HIGHLIGHT_SWATCHES } from './book-preview-annotation-layer'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  ASK_QUICK_PROMPTS,
  streamAnswer,
  type BookPreviewAiAdapter,
} from './ai'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  HIGHLIGHT_COLORS,
  annotationsToMarkdown,
  editAnnotation,
  normalizeQuoteText,
  removeAnnotation,
  sortAnnotations,
  upsertAnnotation,
  type BookPreviewAnnotation,
  type BookPreviewBookmark,
  type BookPreviewHighlight,
  type BookPreviewHighlightColor,
  type BookPreviewInk,
} from './annotations'
import { INK_SWATCHES, inkPath, unflattenInk } from './ink'
import {
  IconArrowUp,
  IconBookmark,
  IconCopy,
  IconDownload,
  IconHighlight,
  IconPencil,
  IconPlayerStopFilled,
  IconSparkles,
  IconTrash,
} from '@tabler/icons-react'

type Filter =
  | 'all'
  | 'notes'
  | 'bookmarks'
  | 'drawings'
  | BookPreviewHighlightColor

/**
 * The reader's companion sheet: everything they marked (the notebook) and a
 * place to ask about the page (Ask). One surface, two tabs — the things a
 * reader reaches for *about* the book, kept out of the way of the book.
 */
export function BookPreviewCompanion() {
  const { companion, setCompanionOpen, setCompanionTab, ai } = useBookPreview()
  const narrow = useNarrowLayout()

  return (
    <Sheet open={companion.open} onOpenChange={setCompanionOpen}>
      <SheetContent
        side={narrow ? 'bottom' : 'right'}
        className={cn(
          'gap-0 p-0',
          narrow ? 'max-h-[85dvh] rounded-t-2xl' : 'w-full sm:max-w-md',
        )}
      >
        <SheetHeader className="pb-2">
          <SheetTitle>Companion</SheetTitle>
          <SheetDescription className="text-xs">
            Your highlights, notes, drawings and bookmarks
            {ai ? ' — and a place to ask about the page.' : '.'}
          </SheetDescription>
        </SheetHeader>
        <Tabs
          value={companion.tab}
          onValueChange={(value) =>
            setCompanionTab(value === 'ask' ? 'ask' : 'notes')
          }
          className="min-h-0 flex-1 flex-col gap-0"
        >
          <TabsList className="mx-4 h-8 w-[calc(100%-2rem)] shrink-0">
            <TabsTrigger value="notes">
              <IconHighlight data-icon="inline-start" />
              Notebook
            </TabsTrigger>
            <TabsTrigger value="ask">
              <IconSparkles data-icon="inline-start" />
              Ask
            </TabsTrigger>
          </TabsList>
          <TabsContent value="notes" className="flex min-h-0 flex-1 flex-col">
            <NotebookPanel />
          </TabsContent>
          <TabsContent value="ask" className="flex min-h-0 flex-1 flex-col">
            {ai ? <AskPanel ai={ai} /> : <AskUnavailable />}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

function NotebookPanel() {
  const {
    annotations,
    updateAnnotations,
    goToPage,
    setCompanionOpen,
    source,
    state,
  } = useBookPreview()
  const [filter, setFilter] = useState<Filter>('all')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const sorted = useMemo(() => sortAnnotations(annotations), [annotations])
  // Strokes are many small records; the notebook shows one entry per page.
  const drawings = useMemo(() => {
    const byPage = new Map<number, BookPreviewInk[]>()
    for (const item of sorted) {
      if (item.kind !== 'ink') continue
      const list = byPage.get(item.pageIndex) ?? []
      list.push(item)
      byPage.set(item.pageIndex, list)
    }
    return [...byPage.entries()]
  }, [sorted])
  const shownDrawings =
    filter === 'all' || filter === 'drawings' ? drawings : []
  const shown = sorted.filter(
    (item): item is BookPreviewHighlight | BookPreviewBookmark => {
      if (item.kind === 'ink' || filter === 'drawings') return false
      if (filter === 'all') return true
      if (filter === 'bookmarks') return item.kind === 'bookmark'
      if (item.kind !== 'highlight') return false
      if (filter === 'notes') return Boolean(item.note)
      return item.color === filter
    },
  )
  const markdown = () =>
    annotationsToMarkdown(annotations, {
      title: source.title ?? source.pdfFileName,
      author: source.author,
    })

  const jump = (item: BookPreviewAnnotation) => {
    goToPage(item.pageIndex)
    setCompanionOpen(false)
  }

  const exportMarkdown = () => {
    const blob = new Blob([markdown()], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${
      (source.title ?? source.pdfFileName ?? 'notes')
        .replace(/\.pdf$/i, '')
        .replace(/[^\w\- ]+/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .toLowerCase() || 'notes'
    }-notes.md`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown())
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      // Clipboard permission denied — export still works.
    }
  }

  const saveNote = (item: BookPreviewHighlight) => {
    const note = draft.trim()
    updateAnnotations((list) =>
      upsertAnnotation(list, editAnnotation(item, { note: note || undefined })),
    )
    setEditing(null)
  }

  if (annotations.length === 0) {
    return (
      <Empty className="flex-1 border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconHighlight />
          </EmptyMedia>
          <EmptyTitle>Nothing marked yet</EmptyTitle>
          <EmptyDescription>
            Select any passage to highlight it or add a note. Press B to
            bookmark the page you are on.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-2 px-4 pt-3 pb-2">
        <ToggleGroup
          value={[filter]}
          onValueChange={(value) => {
            if (value[0]) setFilter(value[0] as Filter)
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Filter notebook"
          className="w-full"
        >
          <ToggleGroupItem
            value="all"
            aria-label="Everything"
            className="flex-1"
          >
            All
          </ToggleGroupItem>
          <ToggleGroupItem
            value="notes"
            aria-label="With notes"
            className="flex-1"
          >
            Notes
          </ToggleGroupItem>
          <ToggleGroupItem
            value="bookmarks"
            aria-label="Bookmarks"
            className="flex-1"
          >
            <IconBookmark />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="drawings"
            aria-label="Drawings"
            className="flex-1"
          >
            <IconPencil />
          </ToggleGroupItem>
          {HIGHLIGHT_COLORS.map((color) => (
            <ToggleGroupItem
              key={color}
              value={color}
              aria-label={`${HIGHLIGHT_SWATCHES[color].label} highlights`}
              className="flex-1"
            >
              <span
                aria-hidden
                className="size-3 rounded-full border border-black/10"
                style={{ background: HIGHLIGHT_SWATCHES[color].fill }}
              />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <ol className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain px-4 pb-3">
        {shown.map((item, position) => (
          <li
            key={item.id}
            data-book-preview-notebook-item
            style={
              {
                '--bp-stagger': `${Math.min(position, 10) * 30}ms`,
              } as CSSProperties
            }
            className={cn(
              'bg-card group relative flex flex-col gap-2 rounded-lg border p-3',
              item.pageIndex === state.pageIndex && 'ring-ring/40 ring-1',
            )}
          >
            {item.kind === 'bookmark' ? (
              <div className="flex items-center gap-2">
                <IconBookmark className="text-primary size-4 shrink-0" />
                <button
                  type="button"
                  onClick={() => jump(item)}
                  className="hover:text-foreground text-left text-sm font-medium"
                >
                  Page {item.pageIndex + 1}
                  {item.label ? ` — ${item.label}` : ''}
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => jump(item)}
                  className="border-l-[3px] pl-3 text-left font-serif text-sm leading-relaxed"
                  style={{ borderColor: HIGHLIGHT_SWATCHES[item.color].fill }}
                >
                  <span className="line-clamp-5">
                    {normalizeQuoteText(item.quote.exact)}
                  </span>
                </button>
                {editing === item.id ? (
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(event) => {
                      event.preventDefault()
                      saveNote(item)
                    }}
                  >
                    <textarea
                      // Editing was just asked for.
                      // oxlint-disable-next-line jsx-a11y/no-autofocus
                      autoFocus
                      rows={3}
                      value={draft}
                      aria-label="Note"
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (
                          event.key === 'Enter' &&
                          (event.metaKey || event.ctrlKey)
                        ) {
                          event.preventDefault()
                          saveNote(item)
                        }
                        if (event.key === 'Escape') {
                          event.stopPropagation()
                          setEditing(null)
                        }
                      }}
                      className="border-input focus-visible:border-ring focus-visible:ring-ring/50 w-full resize-none rounded-md border bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:ring-[3px]"
                    />
                    <div className="flex justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => setEditing(null)}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" size="xs">
                        Save
                      </Button>
                    </div>
                  </form>
                ) : item.note ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(item.note ?? '')
                      setEditing(item.id)
                    }}
                    className="text-muted-foreground hover:text-foreground text-left text-xs whitespace-pre-wrap transition-colors"
                  >
                    {item.note}
                  </button>
                ) : null}
              </>
            )}
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <span className="font-mono">p. {item.pageIndex + 1}</span>
              <div className="flex items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
                {item.kind === 'highlight' && editing !== item.id ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setDraft(item.note ?? '')
                      setEditing(item.id)
                    }}
                  >
                    {item.note ? 'Edit note' : 'Add note'}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Delete"
                  onClick={() =>
                    updateAnnotations((list) => removeAnnotation(list, item.id))
                  }
                >
                  <IconTrash />
                </Button>
              </div>
            </div>
          </li>
        ))}
        {shownDrawings.map(([page, strokes], position) => (
          <li
            key={`ink-${page}`}
            data-book-preview-notebook-item
            style={
              {
                '--bp-stagger': `${Math.min(shown.length + position, 10) * 30}ms`,
              } as CSSProperties
            }
            className={cn(
              'bg-card group relative flex flex-col gap-2 rounded-lg border p-3',
              page === state.pageIndex && 'ring-ring/40 ring-1',
            )}
          >
            <button
              type="button"
              onClick={() => {
                goToPage(page)
                setCompanionOpen(false)
              }}
              className="flex items-center gap-3 text-left"
            >
              <InkPreview strokes={strokes} />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">Drawing</span>
                <span className="text-muted-foreground text-xs">
                  {strokes.length} {strokes.length === 1 ? 'stroke' : 'strokes'}
                </span>
              </span>
            </button>
            <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
              <span className="font-mono">p. {page + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() =>
                  updateAnnotations((list) =>
                    list.filter(
                      (entry) =>
                        !(entry.kind === 'ink' && entry.pageIndex === page),
                    ),
                  )
                }
              >
                Clear page
              </Button>
            </div>
          </li>
        ))}
        {shown.length === 0 && shownDrawings.length === 0 ? (
          <li className="text-muted-foreground py-6 text-center text-xs">
            Nothing matches this filter.
          </li>
        ) : null}
      </ol>
      <div className="flex items-center gap-2 border-t p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={exportMarkdown}
          data-book-preview-press
        >
          <IconDownload data-icon="inline-start" />
          Export Markdown
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={copyMarkdown}
          data-book-preview-press
        >
          <IconCopy data-icon="inline-start" />
          {copied ? 'Copied' : 'Copy'}
        </Button>
      </div>
    </>
  )
}

/** A thumbnail of a page's strokes on a paper-shaped card. */
function InkPreview({ strokes }: { strokes: BookPreviewInk[] }) {
  const width = 48
  const height = 64
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 rounded-sm border bg-white text-zinc-900"
    >
      {strokes.map((stroke) => (
        <path
          key={stroke.id}
          d={inkPath(unflattenInk(stroke.points), width, height)}
          fill="none"
          stroke={INK_SWATCHES[stroke.color].stroke}
          strokeWidth={Math.max(stroke.width * width, 0.8)}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={stroke.tool === 'marker' ? 0.4 : 1}
        />
      ))}
    </svg>
  )
}

function AskUnavailable() {
  return (
    <Empty className="flex-1 border-none">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconSparkles />
        </EmptyMedia>
        <EmptyTitle>Ask isn&apos;t connected</EmptyTitle>
        <EmptyDescription>
          Pass an <code>ai</code> adapter to the reader — the browser&apos;s
          on-device model, a local Ollama server, or your own API route.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

type Turn = {
  id: number
  question: string
  answer: string
  status: 'streaming' | 'done' | 'error' | 'stopped'
}

function AskPanel({ ai }: { ai: BookPreviewAiAdapter }) {
  const { companion, state, source, getPageText } = useBookPreview()
  const seed = companion.askSeed
  const [available, setAvailable] = useState<boolean | null>(
    ai.isAvailable ? null : true,
  )
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  // A new "Ask about this" starts a fresh thread about that passage.
  const [seenNonce, setSeenNonce] = useState(seed?.nonce)
  if (seed?.nonce !== seenNonce) {
    setSeenNonce(seed?.nonce)
    setTurns([])
  }
  const selection = seed?.selection
  const pageIndex = seed?.pageIndex ?? state.pageIndex

  useEffect(() => {
    if (!ai.isAvailable) return
    let cancelled = false
    void Promise.resolve(ai.isAvailable()).then(
      (ok) => {
        if (!cancelled) setAvailable(ok)
      },
      () => {
        if (!cancelled) setAvailable(false)
      },
    )
    return () => {
      cancelled = true
    }
  }, [ai])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    inputRef.current?.focus()
  }, [seed?.nonce])

  const ask = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const id = Date.now()
      setQuestion('')
      setTurns((list) => [
        ...list,
        { id, question: trimmed, answer: '', status: 'streaming' },
      ])
      const patch = (next: Partial<Turn>) =>
        setTurns((list) =>
          list.map((turn) => (turn.id === id ? { ...turn, ...next } : turn)),
        )
      try {
        await streamAnswer(
          ai.ask(
            {
              question: trimmed,
              selection,
              pageIndex,
              pageText: getPageText(pageIndex),
              title: source.title ?? source.pdfFileName,
              author: source.author,
            },
            { signal: controller.signal },
          ),
          (answer) => {
            if (!controller.signal.aborted) patch({ answer })
          },
        )
        if (!controller.signal.aborted) patch({ status: 'done' })
      } catch (error) {
        if (controller.signal.aborted) {
          patch({ status: 'stopped' })
          return
        }
        patch({
          status: 'error',
          answer:
            error instanceof Error ? error.message : 'The assistant failed.',
        })
      }
    },
    [ai, getPageText, pageIndex, selection, source],
  )

  // Keep the newest answer in view while it streams.
  const lastAnswer = turns[turns.length - 1]?.answer
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lastAnswer, turns.length])

  const streaming = turns.some((turn) => turn.status === 'streaming')

  if (available === false) {
    return (
      <Empty className="flex-1 border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <IconSparkles />
          </EmptyMedia>
          <EmptyTitle>{ai.label} isn&apos;t available here</EmptyTitle>
          <EmptyDescription>
            This browser can&apos;t run it. The notebook still works — and the
            host can add a server-backed assistant as a fallback.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <>
      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 pt-3 pb-2"
        aria-live="polite"
      >
        <div className="bg-muted/50 rounded-lg border p-3 text-xs">
          <p className="text-muted-foreground mb-1 font-medium">
            About page {pageIndex + 1}
          </p>
          {selection ? (
            <p className="line-clamp-4 font-serif text-sm leading-relaxed">
              “{selection}”
            </p>
          ) : (
            <p className="text-muted-foreground">
              Ask about anything on this page, or select a passage first.
            </p>
          )}
        </div>
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {ASK_QUICK_PROMPTS.map((prompt) => (
              <Button
                key={prompt.label}
                type="button"
                variant="outline"
                size="xs"
                disabled={available === null}
                onClick={() => void ask(prompt.question)}
                data-book-preview-press
              >
                {prompt.label}
              </Button>
            ))}
          </div>
        ) : null}
        {turns.map((turn) => (
          <div key={turn.id} className="flex flex-col gap-1.5">
            <p className="bg-primary text-primary-foreground self-end rounded-2xl rounded-br-md px-3 py-1.5 text-sm">
              {turn.question}
            </p>
            <div
              className={cn(
                'text-sm leading-relaxed whitespace-pre-wrap',
                turn.status === 'error' && 'text-destructive',
              )}
            >
              {turn.answer ||
                (turn.status === 'streaming' ? (
                  <span className="text-muted-foreground inline-flex items-center gap-2">
                    <Spinner />
                    Reading the page…
                  </span>
                ) : null)}
              {turn.status === 'stopped' ? (
                <span className="text-muted-foreground"> (stopped)</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          void ask(question)
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          value={question}
          aria-label="Ask about this page"
          placeholder={
            available === null
              ? 'Checking the assistant…'
              : 'Ask about this page…'
          }
          disabled={available === null}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void ask(question)
            }
          }}
          className="border-input focus-visible:border-ring focus-visible:ring-ring/50 [field-sizing:content] max-h-32 min-h-9 flex-1 resize-none rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px]"
        />
        {streaming ? (
          <Button
            type="button"
            size="icon-sm"
            variant="secondary"
            aria-label="Stop"
            onClick={() => abortRef.current?.abort()}
            data-book-preview-press
          >
            <IconPlayerStopFilled />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon-sm"
            aria-label="Ask"
            disabled={!question.trim() || available === null}
            data-book-preview-press
          >
            <IconArrowUp />
          </Button>
        )}
      </form>
      <p className="text-muted-foreground px-4 pb-3 text-[11px]">
        {ai.label} · answers can be wrong — check them against the page.
      </p>
    </>
  )
}
