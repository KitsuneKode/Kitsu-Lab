"use client"

import { useEffect } from "react"
import { BookPreviewPageView } from "../book-preview-page"
import { DEFAULT_CAPABILITIES } from "../capabilities"
import { usePdfSheets } from "../hooks/use-pdf-sheets"
import { useStableHandler } from "../hooks/use-stable-handler"
import type { BookPreviewEngineProps } from "../types"
import { CURL_MAX_PAGES, CURL_PAGE_RATIO, CURL_RASTER_WIDTH } from "./curl-geometry"
import { CurlStage } from "./curl-stage"
import { CurlPdfSheet } from "./curl-pdf-sheet"
import { PdfPreparingBadge } from "./pdf-preparing-badge"
import { FlipSheet } from "./flip-sheet"

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

  const { sheets, ratio, prepared, preparing } = usePdfSheets({
    pdfUrl,
    enabled: usePdf,
    pageIndex,
    rasterWidth: CURL_RASTER_WIDTH,
    sizing: "uniform",
    maxPages: CURL_MAX_PAGES,
    maxPagesMessage: `This document is longer than ${CURL_MAX_PAGES} pages — too heavy for the page-flip reader, which paints every page up front. Scroll or PDF mode handles it instead.`,
    onError: reportError,
    errorMessage: "This PDF could not be opened for curl.",
  })

  const totalPages = usePdf ? sheets?.length ?? 0 : pages.length

  useEffect(() => {
    if (usePdf) {
      if (!sheets) return
      reportReady({
        totalPages: sheets.length,
        capabilities: {
          ...DEFAULT_CAPABILITIES,
          curl: true,
          spreads: true,
          appearance: false,
          download: Boolean(source.downloadUrl || source.pdfUrl),
        },
      })
      return
    }
    if (pages.length === 0) {
      reportError({ kind: "empty", message: "The curl reader needs page data or a PDF." })
      return
    }
    reportReady({
      totalPages: pages.length,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        curl: true,
        spreads: true,
        download: Boolean(source.downloadUrl),
      },
    })
  }, [pages.length, reportError, reportReady, sheets, source.downloadUrl, source.pdfUrl, usePdf])

  if (usePdf && !sheets) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Opening PDF…
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      <CurlStage
        pageIndex={pageIndex}
        pageRatio={usePdf ? ratio ?? CURL_PAGE_RATIO : CURL_PAGE_RATIO}
        canGoPrev={pageIndex > 0}
        canGoNext={pageIndex < Math.max(totalPages, 1) - 1}
        reducedMotion={reducedMotion}
        soundEnabled={soundEnabled}
        // Deliberately structural: the key must not change as pages paint, or
        // every finished raster would re-clone the whole book. Painted images
        // reach the flip book through CurlStage's own <img> sync instead.
        contentKey={
          usePdf
            ? `pdf:${sheets?.length ?? 0}`
            : `${appearance}:${pages.map((page) => page.id).join(",")}`
        }
        onPageChange={onPageChange}
        onEngineError={(message) => reportError({ kind: "engine-load", message })}
      >
        {usePdf && sheets
          ? sheets.map((sheet) => (
              <FlipSheet key={sheet.id}>
                <CurlPdfSheet src={sheet.src} />
              </FlipSheet>
            ))
          : pages.map((page, index) => (
              <FlipSheet key={page.id}>
                <BookPreviewPageView
                  page={page}
                  appearance={appearance}
                  isLeftPage={index % 2 === 1}
                />
              </FlipSheet>
            ))}
      </CurlStage>
      {preparing && sheets ? (
        <PdfPreparingBadge prepared={prepared} total={sheets.length} />
      ) : null}
    </div>
  )
}
