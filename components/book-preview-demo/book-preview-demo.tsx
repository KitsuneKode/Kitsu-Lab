'use client'

import { Badge } from '@/components/ui/badge'
import { DEMO_BOOK_PAGES } from './sample-pages'
import { useEffect, useMemo, useState } from 'react'
import { BookPreview } from '@/components/book-preview'
import { DEMO_ARCHIVAL_PAGES } from './sample-archival-pages'
import { BookPreviewComparison } from './book-preview-comparison'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { optionalBookPreviewEngines } from '@/components/book-preview/optional-engines'
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

const DEMO_DOCUMENTS = [
  { value: 'bird', label: 'Bird book' },
  { value: 'celestial', label: 'Celestial' },
  { value: 'pdf', label: 'PDF' },
] as const

type DemoDocument = (typeof DEMO_DOCUMENTS)[number]['value']

const engineLabel = (id: BookPreviewMode) =>
  optionalBookPreviewEngines.find((engine) => engine.id === id)?.label ?? id

export function BookPreviewDemo() {
  const [mode, setMode] = useState<BookPreviewMode>('page')
  const [fallbackNote, setFallbackNote] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<(typeof PDF_SPECIMENS)[number]['url']>(
    '/specimens/attention-is-all-you-need.pdf',
  )
  const [docKind, setDocKind] = useState<DemoDocument>('bird')
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
      const ok = new Set(entries.filter(([, fine]) => fine).map(([url]) => url))
      setReachable(ok)
      setPdfUrl((current) =>
        ok.has(current)
          ? current
          : (PDF_SPECIMENS.find((item) => ok.has(item.url))?.url ?? current),
      )
    })
    return () => {
      cancelled = true
    }
  }, [])
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
          visits.
        </p>
      </div>
      <ToggleGroup
        value={[docKind]}
        onValueChange={(value) => {
          const next = value[0]
          if (DEMO_DOCUMENTS.some((item) => item.value === next)) {
            setDocKind(next as DemoDocument)
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
              setPdfUrl(next as (typeof PDF_SPECIMENS)[number]['url'])
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
        pageParam="page"
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
