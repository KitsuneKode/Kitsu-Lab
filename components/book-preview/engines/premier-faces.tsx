/** The shared face list every premier view renders from — page-data sources
    hand over React leaves; PDF sources hand over raster sheets that fill in
    (and release) around the reading position. */

import type { ReactNode } from 'react'
import { pageSearchText } from '../normalize'
import type { PdfSheet } from '../hooks/use-pdf-sheets'
import { BookPreviewPageView } from '../book-preview-page'
import { BookPreviewFitPage } from '../book-preview-fit-page'
import type { BookPreviewAppearance, BookPreviewPage } from '../types'

export type PremierFace = {
  key: string
  /** width / height — null until a pdf page's real size is known. */
  aspect: number | null
  /** Plain page text — feeds the text view, search, and read-aloud. */
  text: string
  /** One-based PDF page number when the face came from a document. */
  pageNumber: number | null
  /** False while a pdf face waits on its bitmap — overlays hold off until
      real pixels exist to sit on. */
  hasRaster: boolean
  content: ReactNode
}

export const FALLBACK_ASPECT = 370 / 530

export function buildPremierFaces(input: {
  usePdf: boolean
  sheets: PdfSheet[] | null
  pages: BookPreviewPage[]
  appearance: BookPreviewAppearance
}): PremierFace[] {
  const { usePdf, sheets, pages, appearance } = input
  if (usePdf) {
    return (sheets ?? []).map((sheet, index) => ({
      key: sheet.id,
      aspect: sheet.height > 0 ? sheet.width / sheet.height : null,
      text: sheet.text,
      pageNumber: index + 1,
      hasRaster: Boolean(sheet.src),
      content: sheet.src ? (
        // Object URLs are generated locally and cannot be optimized by
        // next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sheet.src}
          alt={`Page ${index + 1}`}
          draggable={false}
          className="h-full w-full object-contain"
        />
      ) : (
        // Paper-coloured placeholder: a pending PDF page is still a white
        // page, so its arrival never flashes dark → white.
        <div
          className="h-full w-full animate-pulse bg-neutral-100"
          aria-hidden
        />
      ),
    }))
  }
  return pages.map((page, index) => ({
    key: page.id,
    aspect: null,
    text: pageSearchText(page),
    pageNumber: null,
    hasRaster: true,
    content: (
      <BookPreviewFitPage>
        <BookPreviewPageView
          page={page}
          appearance={appearance}
          // Spreads pair (1|2), (3|4)…: the even index is the left-hand page.
          isLeftPage={index % 2 === 0}
        />
      </BookPreviewFitPage>
    ),
  }))
}
