"use client"

import { useEffect, useRef, useState } from "react"
import {
  extractPdfPageText,
  loadPdfDocument,
  pdfPageAspectRatio,
  rasterizePdfPage,
  releaseRasterUrl,
  type PdfDocumentProxy,
  type PdfLoadingTask,
} from "../pdf-runtime"
import type { BookPreviewError } from "../types"

export type PdfSheet = {
  id: string
  src: string
  width: number
  height: number
  /** Plain page text, when extraction is enabled. Empty for image-only pages. */
  text: string
  /** True once extraction ran for this page — distinguishes "no text" from
      "not read yet", which windowed search needs. */
  textExtracted: boolean
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
  /**
   * Bound live rasters to +/- this many pages around the reading position.
   * Pages that fall outside are revoked and re-render on return, so a long
   * document holds ~2*windowRadius+1 decoded bitmaps instead of all of them.
   * Omit for engines that must keep every sheet painted (the curl flip book
   * owns all leaves at once).
   */
  windowRadius?: number
  /**
   * Fail with `maxPagesMessage` when the document exceeds this page count.
   * For engines that hold every raster at once, a page-flip of a 400-page
   * file is a hang, not a feature — they should point the reader at a
   * bounded mode instead of starting work.
   */
  maxPages?: number
  maxPagesMessage?: string
  onError: (error: BookPreviewError) => void
  errorMessage: string
}

type UsePdfSheetsResult = {
  sheets: PdfSheet[] | null
  /** The open document, once loaded — engines use it for outlines etc. */
  doc: PdfDocumentProxy | null
  /** height / width of page 1, once known. Null until the document opens. */
  ratio: number | null
  prepared: number
  preparing: boolean
  /** True while the background text index still has pages to read — search
      results grow as it catches up. */
  textPending: boolean
  /** Set while the document waits on a password. `incorrect` means the last
      answer was rejected. */
  passwordRequest: { incorrect: boolean } | null
  submitPassword: (password: string) => void
  /** Abandon the prompt — the document load is destroyed and reported. */
  cancelPassword: () => void
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
  windowRadius,
  maxPages,
  maxPagesMessage,
  onError,
  errorMessage,
}: UsePdfSheetsOptions): UsePdfSheetsResult {
  // Sheets are keyed to the url that produced them: when pdfUrl changes the
  // stale document stops matching the gate below, so no effect-body reset is
  // needed and a superseded load can never publish its pages.
  const [doc, setDoc] = useState<{
    url: string
    proxy: PdfDocumentProxy
    ratio: number | null
    sheets: PdfSheet[] | null
  } | null>(null)
  const [passwordRequest, setPasswordRequest] = useState<{
    incorrect: boolean
  } | null>(null)
  const priorityRef = useRef(pageIndex + 1)
  const wakeRef = useRef<(() => void) | null>(null)
  const reportError = useRef(onError)
  const message = useRef(errorMessage)
  // The loading task is tracked from the moment it exists — a document that
  // is parked on a password prompt must still be destroyable on teardown.
  const taskRef = useRef<PdfLoadingTask | null>(null)
  const passwordSubmitRef = useRef<((password: string) => void) | null>(null)
  const passwordCancelledRef = useRef(false)

  const submitPassword = (password: string) => {
    passwordSubmitRef.current?.(password)
  }

  const cancelPassword = () => {
    passwordCancelledRef.current = true
    passwordSubmitRef.current = null
    setPasswordRequest(null)
    // Destroying the pending task rejects its promise; the open() catch turns
    // it into a "password required" error the reader can retry from.
    void taskRef.current?.destroy().catch(() => {})
  }

  useEffect(() => {
    priorityRef.current = pageIndex + 1
    reportError.current = onError
    message.current = errorMessage
    // Resume a parked windowed drain — the new reading position may need
    // pages the loop skipped.
    wakeRef.current?.()
  })

  useEffect(() => {
    if (!enabled || !pdfUrl) return
    let cancelled = false
    let loaded: Awaited<ReturnType<typeof loadPdfDocument>> | null = null
    let uniformHeight = 0
    let pixelRatio = 1
    // Live rasters by page number; doubles as the teardown revocation list.
    const rendered = new Map<number, string>()
    // Pages already tried — attempted failures stay blank rather than
    // re-failing on every pass, matching the old once-only queue.
    const attempted = new Set<number>()
    // Pages whose text has been read — the background index drain fills this
    // behind the raster window so search covers the whole document.
    const textDone = new Set<number>()

    const inWindow = (pageNumber: number, priority: number): boolean =>
      windowRadius === undefined || Math.abs(pageNumber - priority) <= windowRadius

    // Pages commit through this guarded writer. It stays a flat async
    // function — not a loop body — so each post-await state write is provably
    // dominated by a cancellation check.
    async function renderSheet(url: string, pageNumber: number): Promise<void> {
      if (cancelled || !loaded) return
      attempted.add(pageNumber)
      try {
        const page = await loaded.doc.getPage(pageNumber)
        // Text first: it is cheap, and it makes the page findable before
        // its bitmap has finished painting.
        const text = extractText ? await extractPdfPageText(page) : ""
        if (extractText) textDone.add(pageNumber)
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
        const previous = rendered.get(pageNumber)
        if (previous) releaseRasterUrl(previous)
        rendered.set(pageNumber, raster.src)
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
                          textExtracted: true,
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

    // Revokes rasters that fell behind the reading position. The extracted
    // text stays — it is small — so a pruned page re-renders its bitmap only.
    function prune(url: string, priority: number): void {
      if (windowRadius === undefined) return
      for (const [pageNumber, src] of rendered) {
        if (inWindow(pageNumber, priority)) continue
        rendered.delete(pageNumber)
        attempted.delete(pageNumber)
        releaseRasterUrl(src)
        const id = `pdf-${pageNumber}`
        setDoc((current) =>
          current && current.url === url && current.sheets
            ? {
                ...current,
                sheets: current.sheets.map((sheet) =>
                  sheet.id === id ? { ...sheet, src: "" } : sheet
                ),
              }
            : current
        )
      }
    }

    // Nearest unrendered page to the reading position, expanding outward —
    // a reader at page 50 gets 50, 51, 49, 52, 48… instead of waiting for
    // everything before it.
    function pickNext(priority: number, count: number): number | undefined {
      if (!attempted.has(priority) && priority <= count) return priority
      for (let distance = 1; distance < count; distance += 1) {
        if (windowRadius !== undefined && distance > windowRadius) break
        const before = priority - distance
        const after = priority + distance
        if (before >= 1 && inWindow(before, priority) && !attempted.has(before)) {
          return before
        }
        if (after <= count && inWindow(after, priority) && !attempted.has(after)) {
          return after
        }
        if (before < 1 && after > count) break
      }
      return undefined
    }

    // Text-only pass for pages outside the raster window — a few KB each,
    // so the whole document stays searchable without holding every bitmap.
    async function indexSheetText(url: string, pageNumber: number): Promise<void> {
      if (cancelled || !loaded) return
      textDone.add(pageNumber)
      try {
        const page = await loaded.doc.getPage(pageNumber)
        const text = await extractPdfPageText(page)
        if (cancelled) return
        const id = `pdf-${pageNumber}`
        setDoc((current) =>
          current && current.url === url && current.sheets
            ? {
                ...current,
                sheets: current.sheets.map((sheet) =>
                  sheet.id === id ? { ...sheet, text, textExtracted: true } : sheet
                ),
              }
            : current
        )
      } catch {
        // A page that will not yield text simply stays unsearchable.
      }
    }

    // One sequential worker per document. Without a window it ends when every
    // page is painted; with a window it keeps filling the text index in the
    // background, then parks — the priority effect above wakes it on the next
    // page turn.
    async function drain(url: string): Promise<void> {
      const count = loaded?.doc.numPages ?? 0
      while (!cancelled && loaded) {
        const priority = Math.min(Math.max(1, priorityRef.current), count)
        prune(url, priority)
        const next = pickNext(priority, count)
        if (next !== undefined) {
          await renderSheet(url, next)
          continue
        }
        // Rasters for the visible range are done — spend idle time on the
        // text index, nearest unread page to the reading position first.
        let textNext: number | undefined
        if (extractText) {
          if (!textDone.has(priority)) textNext = priority
          for (let distance = 1; textNext === undefined && distance < count; distance += 1) {
            if (priority - distance >= 1 && !textDone.has(priority - distance)) {
              textNext = priority - distance
            } else if (priority + distance <= count && !textDone.has(priority + distance)) {
              textNext = priority + distance
            }
          }
        }
        if (textNext !== undefined) {
          await indexSheetText(url, textNext)
          continue
        }
        if (windowRadius === undefined) return
        await new Promise<void>((resolve) => {
          wakeRef.current = resolve
        })
        wakeRef.current = null
      }
    }

    async function open(url: string) {
      try {
        passwordCancelledRef.current = false
        const result = await loadPdfDocument(url, {
          onTask: (task) => {
            taskRef.current = task
          },
          onPassword: (request) => {
            if (cancelled) return
            passwordSubmitRef.current = request.submit
            setPasswordRequest({ incorrect: request.incorrect })
          },
        })
        loaded = result
        taskRef.current = result.task
        passwordSubmitRef.current = null
        setPasswordRequest(null)
        if (cancelled) {
          await result.task.destroy()
          return
        }
        const count = result.doc.numPages
        if (maxPages !== undefined && count > maxPages) {
          loaded = null
          await result.task.destroy()
          if (!cancelled) {
            reportError.current({
              kind: "pdf-render",
              message: maxPagesMessage ?? message.current,
            })
          }
          return
        }
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
          proxy: result.doc,
          ratio: baseRatio,
          sheets: Array.from({ length: count }, (_, index) => ({
            id: `pdf-${index + 1}`,
            src: "",
            width: rasterWidth,
            height: uniformHeight,
            text: "",
            textExtracted: false,
          })),
        })

        await drain(url)
      } catch {
        if (!cancelled) {
          reportError.current({
            kind: "pdf-render",
            message: passwordCancelledRef.current
              ? "This PDF is password-protected. Retry to enter its password."
              : message.current,
          })
        }
      }
    }

    void open(pdfUrl)
    return () => {
      cancelled = true
      passwordSubmitRef.current = null
      setPasswordRequest(null)
      // Unpark the drain so it sees `cancelled` and exits.
      wakeRef.current?.()
      wakeRef.current = null
      // Destroy whichever task handle we hold — a password-pending document
      // never reached `loaded` but still owns a worker.
      void (taskRef.current ?? loaded?.task)?.destroy()
      taskRef.current = null
      for (const src of rendered.values()) releaseRasterUrl(src)
      rendered.clear()
    }
  }, [enabled, pdfUrl, rasterWidth, sizing, extractText, windowRadius, maxPages, maxPagesMessage])

  const active = enabled && pdfUrl && doc?.url === pdfUrl ? doc : null
  const activeSheets = active?.sheets ?? null
  const prepared = activeSheets?.filter((sheet) => sheet.src).length ?? 0
  // With a window, "preparing" means the visible range still has gaps — far
  // pages staying blank is the intended steady state, not ongoing work.
  const pendingInWindow =
    activeSheets?.some(
      (sheet, index) =>
        !sheet.src &&
        (windowRadius === undefined ||
          Math.abs(index + 1 - (pageIndex + 1)) <= windowRadius)
    ) ?? false
  return {
    sheets: activeSheets,
    doc: active?.proxy ?? null,
    ratio: active?.ratio ?? null,
    prepared,
    preparing: enabled && activeSheets !== null && pendingInWindow,
    textPending:
      extractText &&
      enabled &&
      activeSheets !== null &&
      activeSheets.some((sheet) => !sheet.textExtracted),
    passwordRequest: enabled && pdfUrl ? passwordRequest : null,
    submitPassword,
    cancelPassword,
  }
}
