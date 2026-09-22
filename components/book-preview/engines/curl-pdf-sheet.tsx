'use client'

/**
 * One rasterized PDF page inside the flip book.
 *
 * The <img> is always present, even before its raster exists. The flip book
 * clones these nodes into its own DOM and later syncs them back by index, so
 * a sheet that rendered a <div> placeholder instead would shift every index
 * after it and paint pages into the wrong leaves. The skeleton therefore sits
 * behind the image rather than replacing it.
 */
export function CurlPdfSheet({ src }: { src: string }) {
  return (
    <div className="bg-background relative h-full w-full">
      <div
        data-book-preview-sheet-skeleton
        className="bg-muted/50 absolute inset-0 animate-pulse"
        aria-hidden
      />
      {/* Object URLs are generated locally and cannot be optimized by next/image. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-book-preview-sheet-img
        src={src || undefined}
        alt=""
        draggable={false}
        className="relative h-full w-full object-contain"
      />
    </div>
  )
}
