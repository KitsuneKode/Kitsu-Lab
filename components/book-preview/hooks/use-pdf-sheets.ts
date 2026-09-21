"use client"

import { useEffect, useRef, useState } from "react"
import {
  extractPdfPageText,
  loadPdfDocument,
  pdfPageAspectRatio,
  rasterizePdfPage,
  releaseRasterUrl,
} from "../pdf-runtime"
import type { BookPreviewError } from "../types"

export type PdfSheet = {
  id: string
  src: string
  width: number
  height: number
  /** Plain page text, when extraction is enabled. Empty for image-only pages. */
  text: string
}

type UsePdfSheetsOptions = {
  pdfUrl: string | undefined
  /** False for page-backed sources; the hook then does no work at all. */
  enabled: boolean
  /** Rasterization is reordered so the page being read paints first. */
  pageIndex: number
  rasterWidth: number
  /**
   * "uniform" sizes every sheet to page 1's aspect ratio, which is what a
   * bound book needs -- leaves cannot each be a different shape. "per-page"
   * measures each page, for continuous scrolling.
   */
  sizing: "uniform" | "per-page"
  /** Pull plain text per page so the reader can search and speak a PDF. */
  extractText?: boolean
  onError: (error: BookPreviewError) => void
  errorMessage: string
}

type UsePdfSheetsResult = {
  sheets: PdfSheet[] | null
  /** height / width of page 1, once known. Null until the document opens. */
  ratio: number | null
  prepared: number
  preparing: boolean
}

/**
 * Opens a PDF and rasterizes its pages into image sheets.
 *
 * Every sheet is mounted up front with an empty src so the reader knows the
 * page count immediately and stays usable while pages fill in behind it.
 * Rasters are object URLs, released together when the document is torn down --
 * they cannot be released per sheet, because the curl engine clones the <img>
 * nodes into a flip book that React does not own.
 */
export function usePdfSheets({
  pdfUrl,
  enabled,
  pageIndex,
  rasterWidth,
  sizing,
  extractText = false,
  onError,
  errorMessage,
}: UsePdfSheetsOptions): UsePdfSheetsResult {
  // Sheets are keyed to the url that produced them: when pdfUrl changes the
  // stale document stops matching the gate below, so no effect-body reset is
  // needed and a superseded load can never publish its pages.
  const [doc, setDoc] = useState<{
    url: string
    ratio: number | null
    sheets: PdfSheet[] | null
  } | null>(null)
  const priorityRef = useRef(pageIndex + 1)
  const reportError = useRef(onError)
  const message = useRef(errorMessage)

  useEffect(() => {
    priorityRef.current = pageIndex + 1
    reportError.current = onError
    message.current = errorMessage
  })

  useEffect(() => {
    if (!enabled || !pdfUrl) return
    let cancelled = false
    let loaded: Awaited<ReturnType<typeof loadPdfDocument>> | null = null
    let uniformHeight = 0
    let pixelRatio = 1
    const minted: string[] = []
    const queue = new Set<number>()

    // Pages commit through this guarded writer. It stays a flat async
    // function — not a loop body — so each post-await state write is provably
    // dominated by a cancellation check.
    async function renderSheet(url: string, pageNumber: number): Promise<void> {
      if (cancelled || !loaded) return
      try {
        const page = await loaded.doc.getPage(pageNumber)
        // Text first: it is cheap, and it makes the page findable before
        // its bitmap has finished painting.
        const text = extractText ? await extractPdfPageText(page) : ""
        if (cancelled) return
        const cssHeight =
          sizing === "uniform"
            ? uniformHeight
            : Math.round(rasterWidth * pdfPageAspectRatio(page))
        const raster = await rasterizePdfPage({
          page,
          cssWidth: rasterWidth,
          cssHeight,
          pixelRatio,
        })
        if (cancelled) {
          releaseRasterUrl(raster.src)
          return
        }
        minted.push(raster.src)
        const id = `pdf-${pageNumber}`
        setDoc(
          (current) =>
            current && current.url === url && current.sheets
              ? {
                  ...current,
                  sheets: current.sheets.map((sheet) =>
                    sheet.id === id
                      ? {
                          ...sheet,
                          src: raster.src,
                          width: raster.width,
                          height: raster.height,
                          text,
                        }
                      : sheet
                  ),
                }
              : current
        )
      } catch {
        // A single bad page stays blank instead of failing the document.
      }
    }

    // Sequential, priority-aware drain — recursive so no setter sits in a
    // loop body after an await.
    async function drain(url: string): Promise<void> {
      if (cancelled) return
      const priority = priorityRef.current
      let pageNumber: number | undefined
      if (queue.delete(priority)) {
        pageNumber = priority
      } else {
        pageNumber = queue.values().next().value
        if (pageNumber !== undefined) queue.delete(pageNumber)
      }
      if (pageNumber === undefined) return
      await renderSheet(url, pageNumber)
      return drain(url)
    }

    async function open(url: string) {
      try {
        const result = await loadPdfDocument(url)
        loaded = result
        if (cancelled) {
          await result.task.destroy()
          return
        }
        const count = result.doc.numPages
        // A 960px sheet at 2x is already roughly a 4MP bitmap. Capping DPR
        // avoids turning high-density phones into a large memory multiplier.
        pixelRatio =
          typeof window === "undefined" ? 1 : Math.min(2, Math.max(1, window.devicePixelRatio || 1))

        const firstPage = await result.doc.getPage(1)
        if (cancelled) return
        const baseRatio = pdfPageAspectRatio(firstPage)
        uniformHeight = Math.round(rasterWidth * baseRatio)

        setDoc({
          url,
          ratio: baseRatio,
          sheets: Array.from({ length: count }, (_, index) => ({
            id: `pdf-${index + 1}`,
            src: "",
            width: rasterWidth,
            height: uniformHeight,
            text: "",
          })),
        })

        for (let index = 1; index <= count; index++) queue.add(index)
        await drain(url)
      } catch {
        if (!cancelled) {
          reportError.current({ kind: "pdf-render", message: message.current })
        }
      }
    }

    void open(pdfUrl)
    return () => {
      cancelled = true
      if (loaded) void loaded.task.destroy()
      for (const src of minted) releaseRasterUrl(src)
      minted.length = 0
    }
  }, [enabled, pdfUrl, rasterWidth, sizing, extractText])

  const active = enabled && pdfUrl && doc?.url === pdfUrl ? doc : null
  const activeSheets = active?.sheets ?? null
  const prepared = activeSheets?.filter((sheet) => sheet.src).length ?? 0
  return {
    sheets: activeSheets,
    ratio: active?.ratio ?? null,
    prepared,
    preparing: enabled && activeSheets !== null && prepared < activeSheets.length,
  }
}
