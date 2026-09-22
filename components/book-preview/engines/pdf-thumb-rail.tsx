"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  pdfPageAspectRatio,
  rasterizePdfPage,
  releaseRasterUrl,
  type PdfDocumentProxy,
} from "../pdf-runtime"

const THUMB_WIDTH = 96
// Render a thumb only when it nears the rail viewport — a 300-page document
// must not queue 300 rasters just because the rail opened once.
const THUMB_ROOT_MARGIN = "240px"

/**
 * Lazily rasterizes page thumbnails for the rail. Work is requested by an
 * IntersectionObserver as each placeholder nears view, rendered one at a
 * time, and cached in state — a thumb is ~60KB, so the cache stays small
 * even on long documents. All URLs are revoked when the rail unmounts or
 * the document changes.
 */
function usePdfThumbnails({
  doc,
  railRef,
}: {
  doc: PdfDocumentProxy
  railRef: RefObject<HTMLDivElement | null>
}) {
  const [thumbs, setThumbs] = useState<Map<number, string>>(new Map())

  // A different document must never show the previous file's bitmaps; the
  // effect below revokes their URLs at the same time.
  const [prevDoc, setPrevDoc] = useState(doc)
  if (prevDoc !== doc) {
    setPrevDoc(doc)
    setThumbs(new Map())
  }

  useEffect(() => {
    const rendered = new Map<number, string>()
    const queue: number[] = []
    const queued = new Set<number>()
    let cancelled = false
    let working = false

    const pump = async () => {
      if (working) return
      working = true
      while (!cancelled) {
        const next = queue.shift()
        if (next === undefined) break
        try {
          const page = await doc.getPage(next)
          const ratio = pdfPageAspectRatio(page)
          const raster = await rasterizePdfPage({
            page,
            cssWidth: THUMB_WIDTH,
            cssHeight: Math.round(THUMB_WIDTH * ratio),
            // Thumbs are decorative navigation — 1x is plenty and keeps the
            // worker free for the page the reader is actually looking at.
            pixelRatio: 1,
          })
          if (cancelled) {
            releaseRasterUrl(raster.src)
            break
          }
          rendered.set(next, raster.src)
          setThumbs(new Map(rendered))
        } catch {
          // A failed thumb stays a skeleton; it does not block the queue.
        }
      }
      working = false
    }

    const request = (page: number) => {
      if (rendered.has(page) || queued.has(page)) return
      queued.add(page)
      queue.push(page)
      void pump()
    }

    const rail = railRef.current
    let observer: IntersectionObserver | null = null
    if (rail && typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue
            const page = Number((entry.target as HTMLElement).dataset.thumbPage)
            if (Number.isFinite(page)) request(page)
            observer?.unobserve(entry.target)
          }
        },
        { root: rail, rootMargin: THUMB_ROOT_MARGIN }
      )
      for (const node of rail.querySelectorAll("[data-thumb-page]")) {
        observer.observe(node)
      }
    } else if (rail) {
      // No observer support — fall back to rendering the first screenful.
      for (let page = 1; page <= Math.min(doc.numPages, 12); page += 1) request(page)
    }

    return () => {
      cancelled = true
      observer?.disconnect()
      for (const src of rendered.values()) releaseRasterUrl(src)
      rendered.clear()
    }
  }, [doc, railRef])

  return thumbs
}

export function PdfThumbRail({
  doc,
  pageIndex,
  open,
  onSelect,
}: {
  doc: PdfDocumentProxy | null
  pageIndex: number
  open: boolean
  onSelect: (pageIndex: number) => void
}) {
  if (!doc || !open) return null
  return (
    <ThumbList
      doc={doc}
      pageIndex={pageIndex}
      onSelect={onSelect}
      className="hidden w-28 shrink-0 flex-col gap-2 overflow-y-auto overscroll-contain border-r pr-2 sm:flex"
    />
  )
}

/** Bottom-sheet thumbnail grid for narrow layouts, where a side rail would
 *  eat most of the reading width. Selecting a page closes the sheet. */
export function PdfThumbSheet({
  doc,
  pageIndex,
  open,
  onOpenChange,
  onSelect,
}: {
  doc: PdfDocumentProxy | null
  pageIndex: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (pageIndex: number) => void
}) {
  if (!doc) return null
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[70dvh] gap-2 rounded-t-xl"
        aria-label="Page thumbnails"
      >
        <SheetHeader className="pb-0">
          <SheetTitle>Pages</SheetTitle>
        </SheetHeader>
        {open ? (
          <ThumbList
            doc={doc}
            pageIndex={pageIndex}
            onSelect={(index) => {
              onSelect(index)
              onOpenChange(false)
            }}
            grid
            className="grid min-h-0 flex-1 grid-cols-3 content-start gap-2 overflow-y-auto overscroll-contain pb-2"
          />
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function ThumbList({
  doc,
  pageIndex,
  onSelect,
  className,
  grid,
}: {
  doc: PdfDocumentProxy
  pageIndex: number
  onSelect: (pageIndex: number) => void
  className?: string
  grid?: boolean
}) {
  const railRef = useRef<HTMLDivElement | null>(null)
  const thumbs = usePdfThumbnails({ doc, railRef })

  useEffect(() => {
    railRef.current
      ?.querySelector(`[data-thumb-page="${pageIndex + 1}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }, [pageIndex])

  return (
    <div ref={railRef} className={className} role="navigation" aria-label="Page thumbnails">
      {Array.from({ length: doc.numPages }, (_, index) => {
        const page = index + 1
        const src = thumbs.get(page)
        const current = index === pageIndex
        return (
          <button
            key={page}
            type="button"
            data-thumb-page={page}
            data-book-preview-press
            aria-current={current ? "page" : undefined}
            aria-label={`Page ${page}`}
            onClick={() => onSelect(index)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-md p-1 outline-none transition-colors",
              grid && "min-h-11",
              current
                ? "bg-accent ring-1 ring-foreground/30"
                : "hover:bg-muted/60 focus-visible:bg-muted/60"
            )}
          >
            <span className="block w-full overflow-hidden rounded-sm border bg-background">
              {src ? (
                // Locally generated object URL — next/image cannot help here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  loading="lazy"
                  decoding="async"
                  className="block h-auto w-full"
                />
              ) : (
                <span className="block aspect-[3/4] w-full animate-pulse bg-muted/60" />
              )}
            </span>
            <span
              className={cn(
                "font-mono text-[10px]",
                current ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {page}
            </span>
          </button>
        )
      })}
    </div>
  )
}
