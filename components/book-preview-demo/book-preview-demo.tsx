'use client'

import { Badge } from '@/components/ui/badge'
import { DEMO_BOOK_PAGES } from './sample-pages'
import { useEffect, useMemo, useState } from 'react'
import { BookPreview } from '@/components/book-preview'
import { DEMO_ARCHIVAL_PAGES } from './sample-archival-pages'
import { BookPreviewComparison } from './book-preview-comparison'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { optionalBookPreviewEngines } from '@/components/book-preview/optional-engines'
import { useUrlParam } from '@/components/book-preview/hooks/use-url-param'
import {
  chainAiAdapters,
  createBuiltInAiAdapter,
  createOpenAICompatibleAdapter,
} from '@/components/book-preview/ai'
import {
  pickAllowed,
  writeUrlParams,
} from '@/components/book-preview/url-state'
import type {
  BookPreviewMode,
  BookPreviewSource,
} from '@/components/book-preview'

const DEMO_MODES: BookPreviewMode[] = [
  'page',
  'premier',
  'curl',
  'scroll',
  'spread',
  'archival-curl',
  'webgl',
  'pdf',
]

const PDF_SPECIMENS = [
  { url: '/sample-book.pdf', name: 'sample-book.pdf', label: 'Sample book' },
  {
    url: '/sample-text-book.pdf',
    name: 'sample-text-book.pdf',
    label: 'Vector text',
  },
  {
    url: '/specimens/attention-is-all-you-need.pdf',
    name: 'attention-is-all-you-need.pdf',
    label: 'Attention paper',
  },
  {
    url: '/specimens/elements-of-statistical-learning.pdf',
    name: 'elements-of-statistical-learning.pdf',
    label: 'Stat learning (764p)',
  },
] as const

type SpecimenUrl = (typeof PDF_SPECIMENS)[number]['url']

const DEMO_DOCUMENTS = [
  { value: 'bird', label: 'Bird book' },
  { value: 'celestial', label: 'Celestial' },
  { value: 'pdf', label: 'PDF' },
] as const

type DemoDocument = (typeof DEMO_DOCUMENTS)[number]['value']

// Ask runs on the reader's own machine: the browser's built-in model when it
// has one, otherwise a local Ollama server (`OLLAMA_ORIGINS=* ollama serve`).
// Nothing is sent to a hosted API from this demo.
const DEMO_AI = chainAiAdapters(
  createBuiltInAiAdapter(),
  createOpenAICompatibleAdapter({
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    label: 'Ollama · llama3.2 (local)',
  }),
)

const engineLabel = (id: BookPreviewMode) =>
  optionalBookPreviewEngines.find((engine) => engine.id === id)?.label ?? id

export function BookPreviewDemo() {
  const [mode, setMode] = useState<BookPreviewMode>('page')
  const [fallbackNote, setFallbackNote] = useState<string | null>(null)
  // The document itself is part of a shareable link: ?doc=pdf&file=… picks
  // it, and the reader adds ?mode, ?view, ?theme and ?page on top. A choice
  // made on the page wins over what the link asked for.
  const urlDoc = pickAllowed(
    useUrlParam('doc'),
    DEMO_DOCUMENTS.map((item) => item.value),
  )
  const urlFileName = useUrlParam('file')
  const urlFile = PDF_SPECIMENS.find((item) => item.name === urlFileName)?.url
  const [docChoice, setDocChoice] = useState<DemoDocument | null>(null)
  const [pdfChoice, setPdfChoice] = useState<SpecimenUrl | null>(null)
  const docKind = docChoice ?? urlDoc ?? 'bird'
  // The large specimens are local-only (gitignored), so a deployed build may
  // not have them — probe once and offer only what actually resolves. If the
  // selected specimen is gone, fall back to one that is.
  const [reachable, setReachable] = useState<Set<string> | null>(null)
  useEffect(() => {
    let cancelled = false
    void Promise.all(
      PDF_SPECIMENS.map((item) =>
        fetch(item.url, { method: 'HEAD' })
          .then((res) => [item.url, res.ok] as const)
          .catch(() => [item.url, false] as const),
      ),
    ).then((entries) => {
      if (cancelled) return
      setReachable(
        new Set(entries.filter(([, fine]) => fine).map(([url]) => url)),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])
  const requestedPdf: SpecimenUrl =
    pdfChoice ?? urlFile ?? '/specimens/attention-is-all-you-need.pdf'
  const pdfUrl =
    reachable && !reachable.has(requestedPdf)
      ? (PDF_SPECIMENS.find((item) => reachable.has(item.url))?.url ??
        requestedPdf)
      : requestedPdf
  const chooseDocument = (
    next: DemoDocument,
    nextUrl: SpecimenUrl = pdfUrl,
  ) => {
    setDocChoice(next)
    setPdfChoice(nextUrl)
    const file = PDF_SPECIMENS.find((item) => item.url === nextUrl)
    // A different document starts at its own first page — a stale ?page from
    // the last one would otherwise be restored into the new source.
    writeUrlParams({
      doc: next,
      file: next === 'pdf' ? (file?.name ?? null) : null,
      page: null,
    })
  }
  const specimens = reachable
    ? PDF_SPECIMENS.filter((item) => reachable.has(item.url))
    : PDF_SPECIMENS
  const pdfFile =
    PDF_SPECIMENS.find((item) => item.url === pdfUrl) ?? PDF_SPECIMENS[0]

  // The source depends on which document you picked, never on which view is
  // open. Deriving it from `mode` handed the reader a different document on
  // every view switch, which reset the reading position to page one.
  const source = useMemo<BookPreviewSource>(() => {
    if (docKind === 'bird') {
      return {
        title: 'The Bird Book',
        author: 'Chester A. Reed',
        pages: DEMO_ARCHIVAL_PAGES,
      }
    }
    if (docKind === 'pdf') {
      return {
        title: pdfFile.label,
        pdfUrl: pdfFile.url,
        pdfFileName: pdfFile.name,
        allowPdfUpload: true,
        downloadUrl: pdfFile.url,
        downloadFileName: pdfFile.name,
      }
    }
    return {
      title: 'The Celestial Mechanics',
      author: 'Kitsu Lab preview',
      pages: DEMO_BOOK_PAGES,
    }
  }, [docKind, pdfFile])

  const showPdfSpecimens = docKind === 'pdf'

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-24 pb-24 sm:pt-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <Badge variant="secondary">Book preview laboratory</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">
          Tactile book and PDF readers
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm">
          The reusable component picks the right reader for the document &mdash;
          a paged, selectable-text view for PDFs and a lightweight slide for
          book pages. Curl, scroll, WebGL, and PDF adapters load only after you
          select them. Drop a PDF anywhere on the reader to open it, search the
          whole document, browse its outline or thumbnails, swipe or drag to
          turn and pan, and pick up where you left off &mdash; even across
          visits. Select any passage to highlight it, add a note, or ask about
          it; the link in your address bar reopens exactly this view.
        </p>
      </div>
      <ToggleGroup
        value={[docKind]}
        onValueChange={(value) => {
          const next = value[0]
          if (DEMO_DOCUMENTS.some((item) => item.value === next)) {
            chooseDocument(next as DemoDocument)
          }
        }}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Document"
        className="mx-auto"
      >
        {DEMO_DOCUMENTS.map((item) => (
          <ToggleGroupItem
            key={item.value}
            value={item.value}
            aria-label={item.label}
          >
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {showPdfSpecimens ? (
        <ToggleGroup
          value={[pdfFile.url]}
          onValueChange={(value) => {
            const next = value[0]
            if (specimens.some((item) => item.url === next)) {
              chooseDocument('pdf', next as SpecimenUrl)
            }
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="PDF specimen"
          className="mx-auto"
        >
          {specimens.map((item) => (
            <ToggleGroupItem
              key={item.url}
              value={item.url}
              aria-label={item.label}
            >
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
      <BookPreview
        source={source}
        label="Interactive book preview"
        engines={optionalBookPreviewEngines}
        enabledModes={DEMO_MODES}
        mode={mode}
        onModeChange={(next) => {
          setMode(next)
          setFallbackNote(null)
        }}
        onModeFallback={(requested, actual) =>
          setFallbackNote(
            `${engineLabel(requested)} can't open this document — showing ${engineLabel(actual)} instead.`,
          )
        }
        persistPage
        persistPreferences
        persistAnnotations
        ai={DEMO_AI}
        urlState
        prefetchModes={['scroll', 'spread', 'curl']}
        defaultAppearance="system"
        defaultSound={false}
      />
      {fallbackNote ? (
        <p className="text-muted-foreground text-center text-xs">
          {fallbackNote}
        </p>
      ) : null}
      <BookPreviewComparison />
    </div>
  )
}
