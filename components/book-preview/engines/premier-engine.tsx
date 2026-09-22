'use client'

import { createPortal } from 'react-dom'
import { CurlStage } from './curl-stage'
import { FlipSheet } from './flip-sheet'
import { useNarrowLayout } from '../media'
import { pageSearchText } from '../normalize'
import { Input } from '@/components/ui/input'
import { CurlPdfSheet } from './curl-pdf-sheet'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { resolvePdfOutline } from '../pdf-runtime'
import { buildPremierFaces } from './premier-faces'
import { PdfPasswordGate } from './pdf-password-gate'
import { PdfPreparingBadge } from './pdf-preparing-badge'
import { useBookPreview } from '../book-preview-provider'
import { BookPreviewPageView } from '../book-preview-page'
import { PdfThumbRail, PdfThumbSheet } from './pdf-thumb-rail'
import { useStableHandler } from '../hooks/use-stable-handler'
import { usePdfSheets, type PdfSheet } from '../hooks/use-pdf-sheets'
import { DEFAULT_CAPABILITIES, hasSpeechSupport } from '../capabilities'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  CURL_MAX_PAGES,
  CURL_PAGE_RATIO,
  CURL_RASTER_WIDTH,
} from './curl-geometry'
import {
  readBookPreviewPrefs,
  writeBookPreviewPrefs,
  type PremierView,
} from '../prefs'
import {
  PremierScrollView,
  PremierSingleView,
  PremierSpreadView,
  PremierTextView,
} from './premier-views'
import type {
  BookPreviewCapabilities,
  BookPreviewEngineProps,
  BookPreviewError,
  BookPreviewPage,
  NormalizedBookSource,
} from '../types'
import {
  BookOpenIcon,
  Columns2Icon,
  FileUpIcon,
  PanelLeftIcon,
  RectangleVerticalIcon,
  ScrollIcon,
  SearchIcon,
  SpeechIcon,
  SquareIcon,
  TypeIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from 'lucide-react'

// Page chips keep search honest in a raster book — there is no text layer to
// highlight, so results name the pages worth flipping to. Past this count a
// summary stands in for the rest.
const MATCH_CHIP_LIMIT = 20
// Roughly 15 characters per second of speech, plus slack, bounds a page's
// narration. Chrome can silently drop onend for long utterances — the
// watchdog below forces the same advance path when that happens.
const SPEECH_CHARS_PER_SECOND = 15
const SPEECH_WATCHDOG_SLACK_MS = 8000

function premierCapabilities(
  source: NormalizedBookSource,
  usePdf: boolean,
): BookPreviewCapabilities {
  return {
    ...DEFAULT_CAPABILITIES,
    curl: true,
    search: true,
    speech: hasSpeechSupport(),
    // The document brings its own paper; ours would fight the scan.
    appearance: !usePdf,
    thumbnails: usePdf,
    download: Boolean(source.downloadUrl || source.pdfUrl),
    upload: !usePdf ? false : source.allowPdfUpload,
  }
}

/**
 * Continuous read-aloud: narrates the current page, turns when the utterance
 * ends, and skips silent pages so an image spread never stalls the story. A
 * manual turn mid-reading simply re-reads the page you land on.
 */
function useReadAloud({
  totalPages,
  pageIndex,
  textFor,
  onPageChange,
}: {
  totalPages: number
  pageIndex: number
  textFor: (index: number) => string
  onPageChange: (index: number) => void
}) {
  const [speaking, setSpeaking] = useState(false)
  const speakingRef = useRef(false)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)
  const watchdogRef = useRef<number | null>(null)
  const textForRef = useRef(textFor)
  const pageIndexRef = useRef(pageIndex)
  const totalPagesRef = useRef(totalPages)
  const reportPageChange = useStableHandler(onPageChange)

  useEffect(() => {
    textForRef.current = textFor
    pageIndexRef.current = pageIndex
    totalPagesRef.current = totalPages
  })

  const clearWatchdog = useCallback(() => {
    if (watchdogRef.current !== null) {
      window.clearTimeout(watchdogRef.current)
      watchdogRef.current = null
    }
  }, [])

  const stop = useCallback(() => {
    speakingRef.current = false
    setSpeaking(false)
    utteranceRef.current = null
    clearWatchdog()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [clearWatchdog])

  const stopRef = useRef(stop)
  useEffect(() => {
    stopRef.current = stop
  })

  // Narrate whatever page is current while `speaking` is on — turns arrive
  // here as pageIndex changes, so reading follows the book.
  useEffect(() => {
    if (
      !speaking ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return
    }
    window.speechSynthesis.cancel()
    clearWatchdog()
    const text = textForRef.current(pageIndex)
    if (!text.trim()) {
      // A silent page (plate, blank leaf) flips itself rather than stall.
      if (pageIndex < totalPagesRef.current - 1) {
        reportPageChange(pageIndex + 1)
        return
      }
      stopRef.current()
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    utteranceRef.current = utterance
    const finish = () => {
      if (utteranceRef.current !== utterance || !speakingRef.current) return
      utteranceRef.current = null
      clearWatchdog()
      const at = pageIndexRef.current
      if (at < totalPagesRef.current - 1) {
        reportPageChange(at + 1)
        return
      }
      stopRef.current()
    }
    utterance.addEventListener('end', finish)
    utterance.addEventListener('error', finish)
    window.speechSynthesis.speak(utterance)
    // Chrome's speech queue can drop onend on long text; a bounded watchdog
    // makes the same advance decision so reading never parks on a page.
    watchdogRef.current = window.setTimeout(
      finish,
      (text.length / SPEECH_CHARS_PER_SECOND) * 1000 + SPEECH_WATCHDOG_SLACK_MS,
    )
    return () => {
      utterance.removeEventListener('end', finish)
      utterance.removeEventListener('error', finish)
      if (utteranceRef.current === utterance) {
        utteranceRef.current = null
        window.speechSynthesis.cancel()
      }
      clearWatchdog()
    }
  }, [clearWatchdog, pageIndex, reportPageChange, speaking])

  // Speech must not outlive the engine.
  useEffect(() => {
    return () => stopRef.current()
  }, [])

  const toggle = useCallback(() => {
    if (speakingRef.current) {
      stopRef.current()
      return
    }
    speakingRef.current = true
    setSpeaking(true)
  }, [])

  return { speaking, toggle, stop }
}

type PageMatch = { index: number; label: string }

function PremierSheets({
  usePdf,
  sheets,
  pages,
  appearance,
}: {
  usePdf: boolean
  sheets: PdfSheet[] | null
  pages: BookPreviewPage[]
  appearance: BookPreviewEngineProps['appearance']
}) {
  if (usePdf && sheets) {
    return sheets.map((sheet) => (
      <FlipSheet key={sheet.id}>
        <CurlPdfSheet src={sheet.src} />
      </FlipSheet>
    ))
  }
  return pages.map((page, index) => (
    <FlipSheet key={page.id}>
      <BookPreviewPageView
        page={page}
        appearance={appearance}
        isLeftPage={index % 2 === 1}
      />
    </FlipSheet>
  ))
}

export default function PremierEngine({
  source,
  pageIndex,
  appearance,
  soundEnabled,
  reducedMotion,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const pages = source.pages
  const pdfUrl = source.pdfUrl
  const usePdf = Boolean(pdfUrl) && pages.length === 0
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)
  const reportPageChange = useStableHandler(onPageChange)
  const { engineShortcutsRef, uploadPdf, chromeHost } = useBookPreview()
  const narrow = useNarrowLayout()
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [thumbsOpen, setThumbsOpen] = useState(false)

  // The layout is the reader's setting — a remembered choice wins, then a
  // one-page view on narrow screens, and the flip book everywhere else.
  const [view, setView] = useState<PremierView>(
    () => readBookPreviewPrefs().premierView ?? (narrow ? 'single' : 'book'),
  )
  const [zoom, setZoom] = useState(1)
  const zoomIn = useCallback(
    () => setZoom((z) => Math.min(2.4, Math.round((z + 0.2) * 10) / 10)),
    [],
  )
  const zoomOut = useCallback(
    () => setZoom((z) => Math.max(0.6, Math.round((z - 0.2) * 10) / 10)),
    [],
  )
  const zoomReset = useCallback(() => setZoom(1), [])

  const setViewPref = useCallback((next: PremierView) => {
    setView(next)
    writeBookPreviewPrefs({ premierView: next })
  }, [])

  const bookView = view === 'book'

  // A pdf-render failure in book view is almost always the flip-book page cap
  // — bounded views still open the document, so drop down instead of failing.
  const reportSheetsError = useStableHandler((error: BookPreviewError) => {
    if (view === 'book' && error.kind === 'pdf-render') {
      setView('single')
      return
    }
    reportError(error)
  })

  const {
    sheets,
    ratio,
    prepared,
    preparing,
    textPending,
    doc,
    passwordRequest,
    submitPassword,
    cancelPassword,
  } = usePdfSheets({
    pdfUrl,
    enabled: usePdf,
    pageIndex,
    rasterWidth: CURL_RASTER_WIDTH,
    sizing: bookView ? 'uniform' : 'per-page',
    // Search and read-aloud both need page text; extraction rides the raster.
    extractText: true,
    // The flip book owns every leaf at once, so it keeps the page cap. The
    // flat views only hold pages near the reading position — a 700-page
    // document stays cheap there.
    windowRadius: bookView ? undefined : 5,
    maxPages: bookView ? CURL_MAX_PAGES : undefined,
    maxPagesMessage: `This document is longer than ${CURL_MAX_PAGES} pages — the flip book can't hold it, but the other premier views can.`,
    onError: reportSheetsError,
    errorMessage: 'This PDF could not be opened for the premier reader.',
  })

  const bookDisabled = usePdf && doc !== null && doc.numPages > CURL_MAX_PAGES

  const faces = useMemo(
    () => buildPremierFaces({ usePdf, sheets, pages, appearance }),
    [appearance, pages, sheets, usePdf],
  )

  const totalPages = usePdf ? (sheets?.length ?? 0) : pages.length

  const textFor = useCallback(
    (index: number) => {
      if (usePdf) return sheets?.[index]?.text ?? ''
      const page = pages[index]
      return page ? pageSearchText(page) : ''
    },
    [pages, sheets, usePdf],
  )

  const {
    speaking,
    toggle: toggleSpeech,
    stop: stopSpeech,
  } = useReadAloud({
    totalPages,
    pageIndex,
    textFor,
    onPageChange: reportPageChange,
  })

  // Page-level search: a raster leaf cannot highlight a hit, so results name
  // the pages worth turning to.
  const needle = query.trim().toLowerCase()
  const matches = useMemo<PageMatch[]>(() => {
    if (!needle) return []
    if (usePdf) {
      return (sheets ?? [])
        .map((sheet, index) => ({ sheet, index }))
        .filter(({ sheet }) => sheet.text.toLowerCase().includes(needle))
        .map(({ index }) => ({ index, label: `Page ${index + 1}` }))
    }
    return pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) => pageSearchText(page).toLowerCase().includes(needle))
      .map(({ page, index }) => ({
        index,
        label: page.title ?? `Page ${page.pageNumber}`,
      }))
  }, [needle, pages, sheets, usePdf])
  const shownMatches = matches.slice(0, MATCH_CHIP_LIMIT)

  const openSearch = useCallback(() => setSearchOpen(true), [])
  const closeSearch = useCallback(() => {
    setQuery('')
    setSearchOpen(false)
  }, [])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  // The engine owns its overlays, so it answers `/`, mod+F, and Escape
  // through the shell's shortcut channel.
  useEffect(() => {
    const ref = engineShortcutsRef
    ref.current = {
      search: openSearch,
      zoomIn,
      zoomOut,
      zoomReset,
      dismiss: () => {
        if (searchOpen) {
          closeSearch()
          return true
        }
        if (thumbsOpen) {
          setThumbsOpen(false)
          return true
        }
        return false
      },
    }
    return () => {
      ref.current = {}
    }
  }, [
    closeSearch,
    engineShortcutsRef,
    openSearch,
    searchOpen,
    thumbsOpen,
    zoomIn,
    zoomOut,
    zoomReset,
  ])

  useEffect(() => {
    if (usePdf) {
      if (!sheets) return
      reportReady({
        totalPages: sheets.length,
        capabilities: premierCapabilities(source, true),
      })
      return
    }
    if (pages.length === 0) {
      if (source.allowPdfUpload) {
        // Upload affordance, not an error — the empty state below renders the
        // picker, and a zero-page ready keeps the viewport out of "loading".
        reportReady({
          totalPages: 0,
          capabilities: {
            ...DEFAULT_CAPABILITIES,
            pagination: false,
            upload: true,
            appearance: false,
            sound: false,
          },
        })
        return
      }
      reportError({
        kind: 'empty',
        message: 'The premier reader needs page data or a PDF.',
      })
      return
    }
    reportReady({
      totalPages: pages.length,
      capabilities: premierCapabilities(source, false),
    })
  }, [pages.length, reportError, reportReady, sheets, source, usePdf])

  // A password prompt still counts as "open": reporting a zero-page ready
  // unblocks the viewport so the gate is visible, and pagination stays off
  // until the document's real page count arrives.
  useEffect(() => {
    if (!passwordRequest) return
    reportReady({
      totalPages: 0,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        pagination: false,
        appearance: false,
        sound: false,
        download: false,
      },
    })
  }, [passwordRequest, reportReady])

  // The author's outline becomes the table of contents — a second ready call
  // so a slow bookmark walk never delays the first page.
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    void resolvePdfOutline(doc).then((contents) => {
      if (cancelled || contents.length === 0) return
      reportReady({
        totalPages: doc.numPages,
        capabilities: premierCapabilities(source, true),
        contents,
      })
    })
    return () => {
      cancelled = true
    }
  }, [doc, reportReady, source])

  // A new document stops its narration — a side effect belongs in an effect,
  // not in the render-adjust below.
  const contentIdentity = usePdf ? sheets : pages
  useEffect(() => {
    return () => stopSpeech()
  }, [contentIdentity, stopSpeech])

  // A new document drops its search state too.
  const [prevSheets, setPrevSheets] = useState(sheets)
  const [prevPages, setPrevPages] = useState(pages)
  if (prevSheets !== sheets || prevPages !== pages) {
    setPrevSheets(sheets)
    setPrevPages(pages)
    setQuery('')
    setSearchOpen(false)
    setThumbsOpen(false)
  }

  const searchReady = usePdf ? Boolean(sheets) : pages.length > 0
  const speechDisabled = !hasSpeechSupport() || totalPages === 0

  const controls = (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <p className="text-muted-foreground max-w-[10rem] truncate text-xs sm:max-w-none">
        {source.pdfFileName ?? source.title ?? 'Document'}
      </p>
      <ToggleGroup
        value={[view]}
        onValueChange={(value) => {
          if (value[0]) setViewPref(value[0] as PremierView)
        }}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Reader view"
      >
        <ToggleGroupItem
          value="book"
          aria-label="Flip book view"
          disabled={bookDisabled}
          title={
            bookDisabled
              ? `The flip book holds up to ${CURL_MAX_PAGES} pages — this document is longer`
              : 'Flip book'
          }
        >
          <BookOpenIcon />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="single"
          aria-label="Single page"
          title="Single page"
        >
          <RectangleVerticalIcon />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="spread"
          aria-label="Two-page spread"
          title="Two-page spread"
        >
          <Columns2Icon />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="scroll"
          aria-label="Continuous scroll"
          title="Continuous scroll"
        >
          <ScrollIcon />
        </ToggleGroupItem>
        <ToggleGroupItem
          value="text"
          aria-label="Text only"
          title="Text only — the lightest way to read"
        >
          <TypeIcon />
        </ToggleGroupItem>
      </ToggleGroup>
      {searchOpen ? (
        <div className="flex items-center gap-1">
          <div className="relative">
            <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={usePdf ? 'Search document' : 'Search pages'}
              aria-label={usePdf ? 'Search document' : 'Search pages'}
              className="h-8 w-40 pl-7 text-xs sm:w-52"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && matches.length > 0) {
                  event.preventDefault()
                  // Enter lands on the next match from here, not the top
                  // of the list — search reads forward.
                  const next =
                    matches.find((match) => match.index >= pageIndex) ??
                    matches[0]
                  reportPageChange(next.index, 'instant')
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  closeSearch()
                  event.currentTarget.blur()
                }
              }}
            />
          </div>
          <span
            className="text-muted-foreground min-w-[5ch] text-center font-mono text-xs"
            aria-live="polite"
            title={textPending ? 'Still indexing the document' : undefined}
          >
            {needle
              ? preparing
                ? '…'
                : `${matches.length}${textPending ? '+' : ''} ${matches.length === 1 ? 'page' : 'pages'}`
              : ''}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Close search"
            onClick={closeSearch}
            data-book-preview-press
          >
            <XIcon />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={usePdf ? 'Search document' : 'Search pages'}
          aria-keyshortcuts="/ Control+F"
          disabled={!searchReady}
          onClick={openSearch}
          data-book-preview-press
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
        >
          <SearchIcon />
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom out"
        aria-keyshortcuts="-"
        onClick={zoomOut}
        disabled={zoom <= 0.6}
        data-book-preview-press
        className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
      >
        <ZoomOutIcon />
      </Button>
      <button
        type="button"
        aria-label="Reset zoom"
        aria-keyshortcuts="0"
        onClick={zoomReset}
        data-book-preview-press
        className="text-muted-foreground hover:text-foreground min-w-[5ch] text-center font-mono text-xs transition-colors"
      >
        {Math.round(zoom * 100)}%
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Zoom in"
        aria-keyshortcuts="+"
        onClick={zoomIn}
        disabled={zoom >= 2.4}
        data-book-preview-press
        className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
      >
        <ZoomInIcon />
      </Button>
      <Button
        type="button"
        variant={speaking ? 'secondary' : 'ghost'}
        size="icon-sm"
        aria-label={speaking ? 'Stop reading aloud' : 'Read aloud'}
        aria-pressed={speaking}
        disabled={speechDisabled}
        title={
          speaking
            ? 'Stop reading aloud'
            : 'Read aloud — turns the pages itself'
        }
        onClick={toggleSpeech}
        data-book-preview-press
        className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
      >
        {speaking ? <SquareIcon /> : <SpeechIcon />}
      </Button>
      {usePdf && doc && doc.numPages > 1 ? (
        <Button
          type="button"
          variant={thumbsOpen ? 'secondary' : 'ghost'}
          size="icon-sm"
          aria-label="Page thumbnails"
          aria-pressed={thumbsOpen}
          onClick={() => setThumbsOpen((open) => !open)}
          data-book-preview-press
          className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
        >
          <PanelLeftIcon />
        </Button>
      ) : null}
      <span className="sr-only" role="status" aria-live="polite">
        {speaking ? `Reading page ${pageIndex + 1}` : ''}
      </span>
    </div>
  )

  return (
    <div className="flex h-full w-full flex-col gap-3 p-4">
      {chromeHost ? createPortal(controls, chromeHost) : controls}
      <div className="bg-muted/30 flex min-h-0 flex-1 overflow-hidden rounded-lg border">
        {usePdf && doc ? (
          narrow ? (
            <PdfThumbSheet
              doc={doc}
              pageIndex={pageIndex}
              open={thumbsOpen}
              onOpenChange={setThumbsOpen}
              onSelect={(index) => reportPageChange(index, 'instant')}
            />
          ) : (
            <PdfThumbRail
              doc={doc}
              pageIndex={pageIndex}
              open={thumbsOpen}
              onSelect={(index) => reportPageChange(index, 'instant')}
            />
          )
        ) : null}
        <div className="relative min-w-0 flex-1">
          {usePdf && !sheets ? (
            passwordRequest ? (
              <div className="flex h-full items-center justify-center p-4">
                <PdfPasswordGate
                  fileName={source.pdfFileName}
                  incorrect={passwordRequest.incorrect}
                  onSubmit={submitPassword}
                  onCancel={cancelPassword}
                />
              </div>
            ) : pdfUrl ? (
              <div className="text-muted-foreground flex h-full items-center justify-center gap-2 text-sm">
                <Spinner />
                Opening PDF…
              </div>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Waiting for a document
              </div>
            )
          ) : !usePdf && pages.length === 0 ? (
            source.allowPdfUpload ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                <FileUpIcon className="text-muted-foreground/60 size-8" />
                <p className="text-muted-foreground max-w-52 text-sm">
                  Upload or drop a PDF to begin
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  data-book-preview-press
                >
                  Choose file
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  aria-label="Upload PDF"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) uploadPdf(file)
                    event.target.value = ''
                  }}
                />
              </div>
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Waiting for pages
              </div>
            )
          ) : view === 'book' ? (
            // CSS `zoom` resizes the whole flip stage — layout and pointer
            // math stay consistent, so corner drags still land.
            <div className="h-full w-full" style={{ zoom }}>
              <CurlStage
                pageIndex={pageIndex}
                pageRatio={
                  usePdf ? (ratio ?? CURL_PAGE_RATIO) : CURL_PAGE_RATIO
                }
                canGoPrev={pageIndex > 0}
                canGoNext={pageIndex < Math.max(totalPages, 1) - 1}
                reducedMotion={reducedMotion}
                soundEnabled={soundEnabled}
                contentKey={
                  usePdf
                    ? `pdf:${sheets?.length ?? 0}`
                    : `${appearance}:${pages.map((page) => page.id).join(',')}`
                }
                onPageChange={reportPageChange}
                onEngineError={(message) =>
                  reportError({ kind: 'engine-load', message })
                }
              >
                <PremierSheets
                  usePdf={usePdf}
                  sheets={sheets}
                  pages={pages}
                  appearance={appearance}
                />
              </CurlStage>
            </div>
          ) : view === 'spread' ? (
            <PremierSpreadView
              faces={faces}
              pageIndex={pageIndex}
              zoom={zoom}
              reducedMotion={reducedMotion}
              doc={doc}
              onZoom={setZoom}
              onPageChange={reportPageChange}
            />
          ) : view === 'scroll' ? (
            <PremierScrollView
              faces={faces}
              pageIndex={pageIndex}
              zoom={zoom}
              reducedMotion={reducedMotion}
              doc={doc}
              onZoom={setZoom}
              onPageChange={reportPageChange}
            />
          ) : view === 'text' ? (
            <PremierTextView
              faces={faces}
              pageIndex={pageIndex}
              zoom={zoom}
              reducedMotion={reducedMotion}
              onZoom={setZoom}
              onPageChange={reportPageChange}
            />
          ) : (
            <PremierSingleView
              faces={faces}
              pageIndex={pageIndex}
              zoom={zoom}
              reducedMotion={reducedMotion}
              doc={doc}
              onZoom={setZoom}
              onPageChange={reportPageChange}
            />
          )}
          {preparing && sheets ? (
            <PdfPreparingBadge prepared={prepared} total={sheets.length} />
          ) : null}
          {searchOpen && needle ? (
            <div
              className="bg-background/90 absolute inset-x-0 bottom-0 flex max-h-24 flex-wrap justify-center gap-1.5 overflow-auto border-t p-2 backdrop-blur-sm"
              aria-live="polite"
            >
              {matches.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  {usePdf && preparing
                    ? 'Still reading the document…'
                    : 'No pages match.'}
                </p>
              ) : (
                <>
                  {shownMatches.map((match) => (
                    <Button
                      key={match.index}
                      type="button"
                      size="xs"
                      variant={
                        match.index === pageIndex ? 'secondary' : 'outline'
                      }
                      onClick={() => reportPageChange(match.index, 'instant')}
                      data-book-preview-press
                    >
                      {match.label}
                    </Button>
                  ))}
                  {matches.length > shownMatches.length ? (
                    <span className="text-muted-foreground self-center text-xs">
                      +{matches.length - shownMatches.length} more
                    </span>
                  ) : null}
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
