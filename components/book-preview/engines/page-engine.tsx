'use client'

import { useEffect } from 'react'
import { BookPreviewPageView } from '../book-preview-page'
import { DEFAULT_CAPABILITIES } from '../capabilities'
import { usePageArrival } from '../hooks/use-page-arrival'
import { usePageGesture } from '../hooks/use-page-gesture'
import { useStableHandler } from '../hooks/use-stable-handler'
import { playPageTurnSound } from '../audio'
import type { BookPreviewEngineProps } from '../types'

export default function PageEngine({
  source,
  pageIndex,
  appearance,
  soundEnabled,
  reducedMotion,
  navigationBehavior,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const pages = source.pages
  const currentPage = pages[pageIndex]
  const facingPage = pages[pageIndex + 1]
  const canGoPrev = pageIndex > 0
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)

  // Forward turns arrive from the right edge, backward turns from the left.
  const arrival = usePageArrival(
    pageIndex,
    reducedMotion || navigationBehavior === 'instant',
  )

  useEffect(() => {
    if (pages.length === 0) {
      reportError({ kind: 'empty', message: 'This reader needs page data.' })
      return
    }
    reportReady({
      totalPages: pages.length,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        spreads: true,
        download: Boolean(source.downloadUrl),
      },
    })
  }, [pages.length, reportError, reportReady, source.downloadUrl])

  const { surfaceRef } = usePageGesture({
    enabled: true,
    reducedMotion,
    canGoPrev,
    canGoNext: pageIndex < pages.length - 1,
    onCommitPrev: () => {
      if (soundEnabled) playPageTurnSound()
      onPageChange(Math.max(0, pageIndex - 1), 'instant')
    },
    onCommitNext: () => {
      if (soundEnabled) playPageTurnSound()
      onPageChange(Math.min(pages.length - 1, pageIndex + 1), 'instant')
    },
  })

  if (pages.length === 0 || !currentPage) return null

  return (
    <div className="flex h-full w-full items-center justify-center p-4">
      <div
        ref={surfaceRef}
        data-book-preview-slide
        className="bg-background flex max-w-full overflow-hidden rounded-md border shadow-lg select-none"
        style={{ touchAction: 'pan-y' }}
      >
        <div key={pageIndex} {...arrival} className="flex">
          <div className="h-[min(22rem,68svh)] w-[min(14rem,86cqw)] sm:h-[min(32rem,72svh)] sm:w-[20rem] sm:border-r lg:h-[min(40rem,76svh)] lg:w-[25rem] xl:h-[min(46rem,80svh)] xl:w-[28rem]">
            <BookPreviewPageView
              page={currentPage}
              appearance={appearance}
              isLeftPage
            />
          </div>
          <div className="hidden h-[22rem] w-[14rem] sm:block sm:h-[min(32rem,72svh)] sm:w-[20rem] lg:h-[min(40rem,76svh)] lg:w-[25rem] xl:h-[min(46rem,80svh)] xl:w-[28rem]">
            {facingPage ? (
              <BookPreviewPageView page={facingPage} appearance={appearance} />
            ) : (
              <div className="bg-muted text-muted-foreground flex h-full items-center justify-center px-6 text-center text-xs">
                Endpaper
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
