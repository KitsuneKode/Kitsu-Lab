'use client'

import { useEffect } from 'react'
import { DEFAULT_CAPABILITIES } from '../capabilities'
import { usePdfSheets } from '../hooks/use-pdf-sheets'
import { useStableHandler } from '../hooks/use-stable-handler'
import type { BookPreviewEngineProps } from '../types'
import { CURL_PAGE_RATIO, CURL_RASTER_WIDTH } from './curl-geometry'
import { CurlStage } from './curl-stage'
import { PdfPasswordGate } from './pdf-password-gate'
import { PdfPreparingBadge } from './pdf-preparing-badge'
import { resolvePdfOutline } from '../pdf-runtime'
import { curlLeaves } from './flip-sheet'

export default function CurlEngine({
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
    // The book mounts only the leaves around the reading position, so
    // rasters stay bounded however long the document is.
    windowRadius: 3,
    onError: reportError,
    errorMessage: 'This PDF could not be opened for curl.',
  })

  useEffect(() => {
    if (usePdf) {
      if (!sheets) return
      reportReady({
        totalPages: sheets.length,
        capabilities: {
          ...DEFAULT_CAPABILITIES,
          curl: true,
          spreads: false,
          appearance: false,
          download: Boolean(source.downloadUrl || source.pdfUrl),
        },
      })
      return
    }
    if (pages.length === 0) {
      reportError({
        kind: 'empty',
        message: 'The curl reader needs page data or a PDF.',
      })
      return
    }
    reportReady({
      totalPages: pages.length,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        curl: true,
        spreads: false,
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
          spreads: false,
          appearance: false,
          download: Boolean(source.downloadUrl || source.pdfUrl),
        },
        contents,
      })
    })
    return () => {
      cancelled = true
    }
  }, [doc, reportReady, source.downloadUrl, source.pdfUrl])

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

  return (
    <div className="relative h-full w-full">
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
  )
}
