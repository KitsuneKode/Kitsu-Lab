'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import {
  createReadingTracker,
  type BookPreviewReadingEvent,
  type ReadingTracker,
} from '../reading-analytics'

/**
 * Feeds the reading tracker from the reader: one tracker per document (the
 * old one says where the reader left before a new one starts), paused while
 * the tab is hidden, and told when the page is going away. Pages count only
 * once the document is ready, so a loading screen is never "reading".
 */
export function useReadingEvents(
  onReadingEvent: ((event: BookPreviewReadingEvent) => void) | undefined,
  pageIndex: number,
  totalPages: number,
  ready: boolean,
  sourceKey: string,
) {
  const emit = useRef(onReadingEvent)
  useLayoutEffect(() => {
    emit.current = onReadingEvent
  })
  const enabled = Boolean(onReadingEvent)
  const tracker = useRef<ReadingTracker | null>(null)

  useEffect(() => {
    if (!enabled) return
    const current = createReadingTracker((event) => emit.current?.(event))
    tracker.current = current
    const onVisibility = () =>
      document.visibilityState === 'hidden' ? current.hide() : current.show()
    const onPageHide = () => current.leave()
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      current.leave()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      tracker.current = null
    }
  }, [enabled, sourceKey])

  useEffect(() => {
    if (ready && totalPages > 0) tracker.current?.view(pageIndex, totalPages)
  }, [enabled, sourceKey, ready, pageIndex, totalPages])
}
