'use client'

import { createPortal } from 'react-dom'
import { CurlStage } from './curl-stage'
import { curlLeaves } from './flip-sheet'
import { pageSearchText } from '../normalize'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { resolvePdfOutline } from '../pdf-runtime'
import { useEffect, useMemo, useState } from 'react'
import { PdfPasswordGate } from './pdf-password-gate'
import { PdfPreparingBadge } from './pdf-preparing-badge'
import { useBookPreview } from '../book-preview-provider'
import { SpeakingBars } from '../speaking-bars'
import { IconPlayerPlay, IconSearch } from '@tabler/icons-react'
import { useStableHandler } from '../hooks/use-stable-handler'
import { usePdfSheets, type PdfSheet } from '../hooks/use-pdf-sheets'
import type { BookPreviewEngineProps, BookPreviewPage } from '../types'
import { DEFAULT_CAPABILITIES, hasSpeechSupport } from '../capabilities'
import { CURL_PAGE_RATIO, CURL_RASTER_WIDTH } from './curl-geometry'

type SearchMatch = { key: string; label: string; index: number }

function usePageSpeech({
  usePdf,
  sheets,
  pageIndex,
  current,
}: {
  usePdf: boolean
  sheets: PdfSheet[] | null
  pageIndex: number
  current: BookPreviewPage | undefined
}) {
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [pageIndex])

  const spokenText = usePdf
    ? (sheets?.[pageIndex]?.text ?? '')
    : current
      ? pageSearchText(current)
      : ''

  const toggleSpeech = () => {
    if (!hasSpeechSupport() || !spokenText) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(spokenText)
    // Property handlers, not addEventListener — the utterance is transient,
    // so its listeners die with it; nothing to clean up.
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    setSpeaking(true)
  }

  return { speaking, spokenText, toggleSpeech }
}

function ArchivalSearchControls({
  query,
  usePdf,
  speaking,
  speechDisabled,
  onQueryChange,
  onToggleSpeech,
}: {
  query: string
  usePdf: boolean
  speaking: boolean
  speechDisabled: boolean
  onQueryChange: (query: string) => void
  onToggleSpeech: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-[12rem] flex-1">
        <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={usePdf ? 'Search document' : 'Search plates'}
          className="pl-8"
          aria-label={usePdf ? 'Search document' : 'Search plates'}
        />
      </div>
      <Button
        type="button"
        variant={speaking ? 'secondary' : 'outline'}
        size="sm"
        onClick={onToggleSpeech}
        disabled={speechDisabled}
        aria-pressed={speaking}
        data-book-preview-press
      >
        {speaking ? (
          <SpeakingBars data-icon="inline-start" className="mr-1" />
        ) : (
          <IconPlayerPlay data-icon="inline-start" />
        )}
        {speaking ? 'Stop reading' : 'Read page'}
      </Button>
    </div>
  )
}

function ArchivalMatchList({
  query,
  matches,
  usePdf,
  preparing,
  onSelect,
}: {
  query: string
  matches: SearchMatch[]
  usePdf: boolean
  preparing: boolean
  onSelect: (index: number) => void
}) {
  if (!query) return null
  return (
    <div
      className="flex max-h-24 flex-wrap gap-2 overflow-auto"
      aria-live="polite"
    >
      {matches.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          {usePdf && preparing
            ? 'Still reading the document\u2026'
            : 'No matches.'}
        </p>
      ) : (
        matches.map((match) => (
          <Button
            key={match.key}
            type="button"
            size="xs"
            variant="outline"
            onClick={() => onSelect(match.index)}
            data-book-preview-press
          >
            {match.label}
          </Button>
        ))
      )}
    </div>
  )
}

export default function ArchivalCurlEngine({
  source,
  pageIndex,
  appearance,
  soundEnabled,
  reducedMotion,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const [query, setQuery] = useState('')
  const pages = source.pages
  const pdfUrl = source.pdfUrl
  const usePdf = Boolean(pdfUrl) && pages.length === 0
  const current = pages[pageIndex]
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)
  const { chromeHost } = useBookPreview()

  const {
    sheets,
    ratio,
    prepared,
    preparing,
    doc,
    passwordRequest,
    submitPassword,
    cancelPassword,
  } = usePdfSheets({
    pdfUrl,
    enabled: usePdf,
    pageIndex,
    rasterWidth: CURL_RASTER_WIDTH,
    sizing: 'uniform',
    // An archival reader that cannot find a word in the document is a viewer.
    extractText: true,
    windowRadius: 3,
    onError: reportError,
    errorMessage: 'This PDF could not be opened for the archival reader.',
  })

  const matches = useMemo<
    { key: string; label: string; index: number }[]
  >(() => {
    const value = query.trim().toLowerCase()
    if (!value) return []
    if (usePdf) {
      return (sheets ?? [])
        .map((sheet, index) => ({ sheet, index }))
        .filter(({ sheet }) => sheet.text.toLowerCase().includes(value))
        .map(({ sheet, index }) => ({
          key: sheet.id,
          label: `Page ${index + 1}`,
          index,
        }))
    }
    return pages
      .map((page, index) => ({ page, index }))
      .filter(({ page }) => pageSearchText(page).toLowerCase().includes(value))
      .map(({ page, index }) => ({
        key: page.id,
        label: page.title ?? `Page ${page.pageNumber}`,
        index,
      }))
  }, [pages, query, sheets, usePdf])

  useEffect(() => {
    if (usePdf) {
      if (!sheets) return
      reportReady({
        totalPages: sheets.length,
        capabilities: {
          ...DEFAULT_CAPABILITIES,
          curl: true,
          search: true,
          speech: hasSpeechSupport(),
          // The document brings its own paper; ours would fight it.
          appearance: false,
          thumbnails: true,
          download: Boolean(source.downloadUrl || source.pdfUrl),
        },
      })
      return
    }
    if (pages.length === 0) {
      reportError({
        kind: 'empty',
        message: 'The archival curl reader needs page data or a PDF.',
      })
      return
    }
    reportReady({
      totalPages: pages.length,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        curl: true,
        search: true,
        speech: hasSpeechSupport(),
        thumbnails: true,
        download: Boolean(source.downloadUrl),
      },
    })
  }, [
    pages.length,
    reportError,
    reportReady,
    sheets,
    source.downloadUrl,
    source.pdfUrl,
    usePdf,
  ])

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

  // The author's outline becomes the reader's table of contents — a second
  // ready call so a slow bookmark walk never delays the first page.
  useEffect(() => {
    if (!doc) return
    let cancelled = false
    void resolvePdfOutline(doc).then((contents) => {
      if (cancelled || contents.length === 0) return
      reportReady({
        totalPages: doc.numPages,
        capabilities: {
          ...DEFAULT_CAPABILITIES,
          curl: true,
          search: true,
          speech: hasSpeechSupport(),
          appearance: false,
          thumbnails: true,
          download: Boolean(source.downloadUrl || source.pdfUrl),
        },
        contents,
      })
    })
    return () => {
      cancelled = true
    }
  }, [doc, reportReady, source.downloadUrl, source.pdfUrl])

  const { speaking, spokenText, toggleSpeech } = usePageSpeech({
    usePdf,
    sheets,
    pageIndex,
    current,
  })

  if (usePdf && !sheets) {
    if (passwordRequest) {
      return (
        <div className="flex h-full items-center justify-center p-4">
          <PdfPasswordGate
            fileName={source.pdfFileName}
            incorrect={passwordRequest.incorrect}
            onSubmit={submitPassword}
            onCancel={cancelPassword}
          />
        </div>
      )
    }
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Opening PDF…
      </div>
    )
  }

  const controls = (
    <ArchivalSearchControls
      query={query}
      usePdf={usePdf}
      speaking={speaking}
      speechDisabled={!hasSpeechSupport() || !spokenText}
      onQueryChange={setQuery}
      onToggleSpeech={toggleSpeech}
    />
  )

  return (
    <div
      data-book-preview-engine-frame
      className="flex h-full w-full flex-col gap-3 p-4"
    >
      {chromeHost ? createPortal(controls, chromeHost) : controls}
      <ArchivalMatchList
        query={query}
        matches={matches}
        usePdf={usePdf}
        preparing={preparing}
        onSelect={onPageChange}
      />
      <div className="relative min-h-0 flex-1">
        <CurlStage
          pageIndex={pageIndex}
          {...curlLeaves({ usePdf, sheets, pages, appearance })}
          pageRatio={usePdf ? (ratio ?? CURL_PAGE_RATIO) : CURL_PAGE_RATIO}
          reducedMotion={reducedMotion}
          soundEnabled={soundEnabled}
          onPageChange={onPageChange}
        />
        {preparing && sheets ? (
          <PdfPreparingBadge prepared={prepared} total={sheets.length} />
        ) : null}
      </div>
    </div>
  )
}
