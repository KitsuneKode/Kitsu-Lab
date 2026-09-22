'use client'

import { findBookmark } from './annotations'
import { useBookPreview } from './book-preview-provider'

/** A silk ribbon on the top edge of a bookmarked page — the quiet, physical
    answer to "did I mark this?". Decorative; the toolbar button and the
    notebook carry the state for assistive tech. */
export function BookPreviewBookmarkRibbon() {
  const { annotations, state } = useBookPreview()
  if (state.status !== 'ready' || state.totalPages === 0) return null
  const bookmark = findBookmark(annotations, state.pageIndex)
  if (!bookmark) return null
  return (
    <div
      key={bookmark.id}
      aria-hidden
      data-book-preview-ribbon
      className="pointer-events-none absolute top-0 right-6 z-30 h-9 w-5 shadow-md"
      style={{
        // Silk-ribbon red reads on every paper — white, sepia, and night.
        background: 'var(--book-preview-ribbon, oklch(0.56 0.19 25))',
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 78%, 0 100%)',
      }}
    />
  )
}
