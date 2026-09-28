'use client'

import type { ReactNode } from 'react'
import { BookPreviewPageView } from '../book-preview-page'
import { BookPreviewFitPage } from '../book-preview-fit-page'
import type { PdfSheet } from '../hooks/use-pdf-sheets'
import type { BookPreviewEngineProps, BookPreviewPage } from '../types'
import { CurlPdfSheet } from './curl-pdf-sheet'

export function FlipSheet({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background h-full w-full overflow-hidden">
      <div className="[pointer-events:none] h-full w-full [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        {children}
      </div>
    </div>
  )
}

/** One leaf of a curl book, from whichever source the book has. */
export function renderCurlLeaf(
  source: {
    usePdf: boolean
    sheets: PdfSheet[] | null
    pages: BookPreviewPage[]
    appearance: BookPreviewEngineProps['appearance']
  },
  index: number,
  side: 'left' | 'right' = 'right',
): ReactNode {
  if (source.usePdf) {
    const sheet = source.sheets?.[index]
    return sheet ? (
      <FlipSheet>
        <CurlPdfSheet src={sheet.src} />
      </FlipSheet>
    ) : null
  }
  const page = source.pages[index]
  return page ? (
    <FlipSheet>
      <BookPreviewFitPage>
        <BookPreviewPageView
          page={page}
          appearance={source.appearance}
          // Gutter shading sits on the spine side: a single-leaf book is bound
          // on the left (every leaf a right-hand page); a spread says which.
          isLeftPage={side === 'left'}
        />
      </BookPreviewFitPage>
    </FlipSheet>
  ) : null
}

/** Leaf count and a leaf renderer for a CurlStage. */
export function curlLeaves(source: Parameters<typeof renderCurlLeaf>[0]) {
  return {
    pageCount: source.usePdf
      ? (source.sheets?.length ?? 0)
      : source.pages.length,
    renderPage: (index: number, side: 'left' | 'right') =>
      renderCurlLeaf(source, index, side),
    // Rasterized pages are white paper whatever the theme.
    leafBack: source.usePdf ? '#fff' : undefined,
  }
}
