'use client'

import { useEffect, useRef } from 'react'
import { resolvePdfOutline } from '../pdf-runtime'
import { PdfPasswordGate } from './pdf-password-gate'
import type { BookPreviewEngineProps } from '../types'
import { DEFAULT_CAPABILITIES } from '../capabilities'
import { usePdfSheets } from '../hooks/use-pdf-sheets'
import { PdfPreparingBadge } from './pdf-preparing-badge'
import { BookPreviewPageView } from '../book-preview-page'
import { useStableHandler } from '../hooks/use-stable-handler'

const SCROLL_RASTER_WIDTH = 840
// Keep ~2*radius+1 live rasters instead of the whole document — a 200-page
// PDF must not hold 200 decoded bitmaps on a phone.
const SCROLL_WINDOW_RADIUS = 4

export default function ScrollEngine({
  source,
  pageIndex,
  appearance,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const pages = source.pages
  const pdfUrl = source.pdfUrl
  const usePdf = Boolean(pdfUrl) && pages.length === 0
  const scrollerRef = useRef<HTMLDivElement | null>(null)
  const pageIndexRef = useRef(pageIndex)
  const lockScrollRef = useRef(false)
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)
  const reportPageChange = useStableHandler(onPageChange)

  useEffect(() => {
    pageIndexRef.current = pageIndex
  }, [pageIndex])

  // Continuous reading measures each page, so a landscape figure page keeps
  // its own shape instead of being forced into page 1's aspect ratio.
  const {
    sheets,
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
    rasterWidth: SCROLL_RASTER_WIDTH,
    sizing: 'per-page',
    windowRadius: SCROLL_WINDOW_RADIUS,
    onError: reportError,
    errorMessage: 'This PDF could not be opened for scrolling.',
  })

  useEffect(() => {
    if (usePdf) {
      if (!sheets) return
      reportReady({
        totalPages: sheets.length,
        capabilities: {
          ...DEFAULT_CAPABILITIES,
          appearance: false,
          sound: false,
          download: Boolean(source.downloadUrl || source.pdfUrl),
        },
      })
      return
    }
    if (pages.length === 0) {
      reportError({
        kind: 'empty',
        message: 'The scroll reader needs page data or a PDF.',
      })
      return
    }
    reportReady({
      totalPages: pages.length,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
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
          appearance: false,
          sound: false,
          download: Boolean(source.downloadUrl || source.pdfUrl),
        },
        contents,
      })
    })
    return () => {
      cancelled = true
    }
  }, [doc, reportReady, source.downloadUrl, source.pdfUrl])

  const total = usePdf ? (sheets?.length ?? 0) : pages.length

  useEffect(() => {
    const root = scrollerRef.current
    if (!root || total === 0) return
    const items = Array.from(root.querySelectorAll('[data-page-index]'))
    if (items.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (lockScrollRef.current) return
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .toSorted((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (!visible) return
        const index = Number(visible.target.getAttribute('data-page-index'))
        if (!Number.isFinite(index) || index === pageIndexRef.current) return
        reportPageChange(index)
      },
      { root, threshold: [0.35, 0.55, 0.75] },
    )
    for (const item of items) observer.observe(item)
    return () => observer.disconnect()
  }, [pages.length, reportPageChange, sheets, total])

  useEffect(() => {
    const root = scrollerRef.current
    if (!root) return
    const target = root.querySelector(`[data-page-index="${pageIndex}"]`)
    if (!(target instanceof HTMLElement)) return
    if (Math.abs(target.offsetTop - root.scrollTop) < 24) return
    lockScrollRef.current = true
    target.scrollIntoView({ block: 'start', behavior: 'auto' })
    const timer = window.setTimeout(() => {
      lockScrollRef.current = false
    }, 80)
    return () => window.clearTimeout(timer)
  }, [pageIndex])

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
    <div className="relative h-full w-full min-w-0">
      <div
        ref={scrollerRef}
        className="h-full overflow-y-auto overscroll-contain px-3 py-4 sm:px-6"
        data-book-preview-scroll
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
          {usePdf && sheets
            ? sheets.map((sheet, index) => (
                <article
                  key={sheet.id}
                  data-page-index={index}
                  className="bg-background ring-foreground/10 overflow-hidden rounded-sm shadow-sm ring-1"
                >
                  {sheet.src ? (
                    // Object URLs are generated locally and cannot be optimized
                    // by next/image.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={sheet.src}
                      alt=""
                      draggable={false}
                      loading="lazy"
                      decoding="async"
                      data-book-preview-sheet-img
                      className="bg-background h-auto w-full"
                    />
                  ) : (
                    <div
                      data-book-preview-sheet-skeleton
                      className="bg-muted/50 w-full animate-pulse"
                      style={{
                        aspectRatio: `${sheet.width} / ${sheet.height}`,
                      }}
                    />
                  )}
                </article>
              ))
            : pages.map((page, index) => (
                <article
                  key={page.id}
                  data-page-index={index}
                  className="ring-foreground/10 min-h-[min(28rem,70svh)] overflow-hidden rounded-sm shadow-sm ring-1"
                >
                  <BookPreviewPageView
                    page={page}
                    appearance={appearance}
                    isLeftPage={index % 2 === 1}
                  />
                </article>
              ))}
        </div>
      </div>
      {preparing && sheets ? (
        <PdfPreparingBadge prepared={prepared} total={sheets.length} />
      ) : null}
    </div>
  )
}
