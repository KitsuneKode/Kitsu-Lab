'use client'

import { parsePageParam, readUrlParam, writeUrlParams } from '../url-state'
import { type BookPreviewAction } from '../reducer'
import { type BookPreviewResumeNotice } from '../book-preview-provider'
import type { BookPreviewNavigationBehavior, BookPreviewStatus } from '../types'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
} from 'react'

export function usePersistedPageIndex({
  sourceKey,
  storageKey,
  persistPage,
  pageParam,
  pageControlled,
  pageIndex,
  defaultPageIndex,
  status,
  totalPages,
  activePage,
  goToPage,
  dispatch,
}: {
  sourceKey: string
  /** Stable identity for localStorage (differs from sourceKey for uploads). */
  storageKey: string
  persistPage: boolean
  pageParam: string | undefined
  pageControlled: boolean
  pageIndex: number | undefined
  defaultPageIndex: number
  status: BookPreviewStatus
  totalPages: number
  activePage: number
  goToPage: (next: number, behavior?: BookPreviewNavigationBehavior) => void
  dispatch: Dispatch<BookPreviewAction>
}) {
  const sourceReady = useRef(false)
  const resetPageRef = useRef({ pageControlled, pageIndex, defaultPageIndex })
  useLayoutEffect(() => {
    resetPageRef.current = { pageControlled, pageIndex, defaultPageIndex }
  })

  // Reset only when the source itself changes. Page props live in a ref so a
  // controlled consumer's pageIndex updates do not trigger a source reset.
  // Layout effect for the same reason as the engine loader: it must land
  // before the remounted engine's passive "ready", never after it.
  useLayoutEffect(() => {
    if (!sourceReady.current) {
      sourceReady.current = true
      return
    }
    const reset = resetPageRef.current
    dispatch({
      type: 'reset-source',
      pageIndex: reset.pageControlled
        ? reset.pageIndex
        : reset.defaultPageIndex,
    })
  }, [sourceKey, dispatch])

  const restoredKeyRef = useRef<string | null>(null)
  const persistKey = `book-preview:page:${storageKey}`
  const [resume, setResume] = useState<BookPreviewResumeNotice | null>(null)

  // Restore the position once the source reports ready. A deep-linked
  // ?page=N wins over the remembered position — a shared link should land on
  // the page it was shared from. Runs once per source; skipped entirely
  // while the consumer controls pageIndex.
  useEffect(() => {
    if (pageControlled || (!persistPage && !pageParam)) return
    // totalPages===0 gates this too: a password prompt reports a zero-page
    // ready state that must not consume the deep link before the document
    // is actually open.
    if (
      status !== 'ready' ||
      totalPages === 0 ||
      restoredKeyRef.current === sourceKey
    )
      return
    restoredKeyRef.current = sourceKey
    try {
      const linked = pageParam ? parsePageParam(readUrlParam(pageParam)) : null
      let stored: number | null = null
      if (persistPage) {
        const raw = window.localStorage.getItem(persistKey)
        const value = raw === null ? Number.NaN : Number.parseInt(raw, 10)
        if (value > 0 && value < totalPages) stored = value
      }
      const target = linked ?? stored
      // Say what just happened, and offer the other place: back to the
      // start after a silent resume, or back to *your* page when a shared
      // link opened somewhere else.
      const notice: BookPreviewResumeNotice | null =
        linked === null && stored !== null
          ? { kind: 'resumed', pageIndex: stored, source: sourceKey }
          : linked !== null && stored !== null && stored !== linked
            ? { kind: 'yours', pageIndex: stored, source: sourceKey }
            : null
      queueMicrotask(() => {
        if (target !== null && target < Math.max(totalPages, 1)) {
          goToPage(target, 'instant')
        }
        if (notice) setResume(notice)
      })
    } catch {
      // localStorage or location may be unavailable (private mode, sandbox).
    }
  }, [
    persistPage,
    pageParam,
    pageControlled,
    sourceKey,
    persistKey,
    status,
    totalPages,
    goToPage,
  ])

  useEffect(() => {
    if (
      !persistPage ||
      pageControlled ||
      status !== 'ready' ||
      totalPages === 0
    )
      return
    try {
      window.localStorage.setItem(persistKey, String(activePage))
    } catch {
      // localStorage may be unavailable.
    }
  }, [persistPage, pageControlled, status, totalPages, persistKey, activePage])

  // Keep the deep link current as the reader moves. replaceState only —
  // turning pages must never spam the back stack.
  useEffect(() => {
    if (!pageParam || status !== 'ready' || totalPages === 0) return
    writeUrlParams({ [pageParam]: String(activePage + 1) })
  }, [pageParam, status, totalPages, activePage])

  const dismissResume = useCallback(() => setResume(null), [])
  return {
    resume: resume?.source === sourceKey ? resume : null,
    dismissResume,
  }
}

/**
 * How long this reader spends on a page, learned from their own turns — the
 * median of recent forward dwells, ignoring skims (under 4s) and walk-aways
 * (over 10 min). Feeds the pager's "min left", the e-reader number that
 * makes finishing feel close.
 */
export function useReadingPace(
  activePage: number,
  totalPages: number,
  sourceKey: string,
  /** Per-document storage key; null keeps the pace to this visit. */
  storageKey: string | null,
): number | null {
  const [secondsPerPage, setSecondsPerPage] = useState<number | null>(null)
  const paceKey = storageKey ? `book-preview:pace:${storageKey}` : null
  const paceRef = useRef({
    // Empty until the first effect, so it also takes the "new document"
    // branch and loads a remembered pace.
    source: '',
    page: activePage,
    at: 0,
    samples: [] as number[],
  })
  useEffect(() => {
    const pace = paceRef.current
    const now = performance.now()
    if (pace.source !== sourceKey) {
      paceRef.current = {
        source: sourceKey,
        page: activePage,
        at: now,
        samples: [],
      }
      // A new document starts from this reader's remembered pace for it,
      // so time left shows at once; otherwise it is learned afresh. Read
      // after mount, so hydration stays clean.
      let remembered: number | null = null
      if (paceKey) {
        try {
          const value = Number.parseFloat(
            window.localStorage.getItem(paceKey) ?? '',
          )
          if (value > 0 && value <= 600) remembered = value
        } catch {
          // localStorage may be unavailable.
        }
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSecondsPerPage(remembered)
      return
    }
    const turned = activePage - pace.page
    if (pace.at > 0 && turned >= 1 && turned <= 2) {
      const dwell = (now - pace.at) / 1000 / turned
      if (dwell >= 4 && dwell <= 600) {
        pace.samples.push(dwell)
        if (pace.samples.length > 15) pace.samples.shift()
        if (pace.samples.length >= 3) {
          const sorted = [...pace.samples].sort((a, b) => a - b)
          const median = sorted[Math.floor(sorted.length / 2)]
          setSecondsPerPage(median)
          if (paceKey) {
            try {
              window.localStorage.setItem(paceKey, median.toFixed(1))
            } catch {
              // localStorage may be unavailable.
            }
          }
        }
      }
    }
    pace.page = activePage
    pace.at = now
  }, [activePage, paceKey, sourceKey])
  if (secondsPerPage === null || totalPages === 0) return null
  const remaining = Math.max(0, totalPages - 1 - activePage)
  return Math.max(
    remaining > 0 ? 1 : 0,
    Math.round((remaining * secondsPerPage) / 60),
  )
}
