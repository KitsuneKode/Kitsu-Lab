'use client'

import { useEffect, useRef } from 'react'

/**
 * One rasterized PDF page inside the flip book.
 *
 * The leaf is white paper from the first frame — a pending raster shows a
 * faint paper-toned shimmer, never the theme's dark background, so a page
 * arriving mid-turn cannot flash dark → white. The <img> keeps its element
 * across src changes, so the browser holds the old bitmap until the new one
 * has decoded.
 */
export function CurlPdfSheet({ src }: { src: string }) {
  const imgRef = useRef<HTMLImageElement | null>(null)
  // Leaves around the reading position are mounted hidden; decode their
  // bitmaps now, so the frame a turn reveals one is never a blank frame.
  useEffect(() => {
    if (!src) return
    imgRef.current?.decode?.().catch(() => {})
  }, [src])
  return (
    <div className="relative h-full w-full bg-white">
      <div
        data-book-preview-sheet-skeleton
        className="absolute inset-0 animate-pulse bg-neutral-100"
        aria-hidden
      />
      {/* Object URLs are generated locally and cannot be optimized by next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        data-book-preview-sheet-img
        src={src || undefined}
        alt=""
        draggable={false}
        className="relative h-full w-full object-contain"
      />
    </div>
  )
}
