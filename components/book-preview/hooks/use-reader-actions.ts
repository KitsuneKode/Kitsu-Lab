'use client'

import { type BookPreviewAction } from '../reducer'
import { clampPageIndex } from '../normalize'
import { type BookPreviewPageStep } from '../book-preview-provider'
import type {
  BookPreviewAppearance,
  BookPreviewEngineReadyInfo,
  BookPreviewError,
  BookPreviewMode,
  BookPreviewNavigationBehavior,
  BookPreviewProps,
} from '../types'
import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type SetStateAction,
} from 'react'

// The public action surface: each callback notifies the controlled listener
// and only dispatches to internal state when that prop is uncontrolled.
export function useBookPreviewActions({
  modeControlled,
  pageControlled,
  appearanceControlled,
  soundControlled,
  activePage,
  totalPages,
  dispatch,
  setNavigationBehavior,
  onModeChange,
  onPageChange,
  onAppearanceChange,
  onSoundChange,
  onCapabilitiesChange,
  pageStep,
}: {
  pageStep: BookPreviewPageStep | null
  modeControlled: boolean
  pageControlled: boolean
  appearanceControlled: boolean
  soundControlled: boolean
  activePage: number
  totalPages: number
  dispatch: Dispatch<BookPreviewAction>
  setNavigationBehavior: Dispatch<SetStateAction<BookPreviewNavigationBehavior>>
  onModeChange: BookPreviewProps['onModeChange']
  onPageChange: BookPreviewProps['onPageChange']
  onAppearanceChange: BookPreviewProps['onAppearanceChange']
  onSoundChange: BookPreviewProps['onSoundChange']
  onCapabilitiesChange: BookPreviewProps['onCapabilitiesChange']
}) {
  const setMode = useCallback(
    (next: BookPreviewMode) => {
      if (!modeControlled) dispatch({ type: 'set-mode', mode: next })
      onModeChange?.(next)
    },
    [modeControlled, onModeChange, dispatch],
  )

  const goToPage = useCallback(
    (next: number, behavior: BookPreviewNavigationBehavior = 'animated') => {
      const clamped = clampPageIndex(next, Math.max(totalPages, 1))
      setNavigationBehavior(behavior)
      if (!pageControlled) dispatch({ type: 'set-page', pageIndex: clamped })
      onPageChange?.(clamped)
    },
    [onPageChange, pageControlled, totalPages, setNavigationBehavior, dispatch],
  )

  // A view that shows two pages turns a whole spread; at an end, nothing.
  const stepPage = useCallback(
    (direction: 1 | -1, behavior?: BookPreviewNavigationBehavior) => {
      if (!pageStep) {
        goToPage(activePage + direction, behavior)
        return
      }
      const target = pageStep(activePage, direction)
      if (target !== null) goToPage(target, behavior)
    },
    [activePage, goToPage, pageStep],
  )
  const nextPage = useCallback(() => stepPage(1), [stepPage])
  const prevPage = useCallback(() => stepPage(-1), [stepPage])

  const setAppearance = useCallback(
    (next: BookPreviewAppearance) => {
      if (!appearanceControlled)
        dispatch({ type: 'set-appearance', appearance: next })
      onAppearanceChange?.(next)
    },
    [appearanceControlled, onAppearanceChange, dispatch],
  )

  const setSound = useCallback(
    (next: boolean) => {
      if (!soundControlled) dispatch({ type: 'set-sound', sound: next })
      onSoundChange?.(next)
    },
    [onSoundChange, soundControlled, dispatch],
  )

  const retry = useCallback(() => dispatch({ type: 'retry' }), [dispatch])

  const handleEngineReady = useCallback(
    (info: BookPreviewEngineReadyInfo) => {
      dispatch({
        type: 'engine-ready',
        totalPages: info.totalPages,
        capabilities: info.capabilities,
        contents: info.contents,
      })
      onCapabilitiesChange?.(info.capabilities)
    },
    [onCapabilitiesChange, dispatch],
  )

  const handleEngineError = useCallback(
    (error: BookPreviewError) => {
      dispatch({ type: 'engine-error', error })
    },
    [dispatch],
  )

  return {
    setMode,
    goToPage,
    stepPage,
    nextPage,
    prevPage,
    setAppearance,
    setSound,
    retry,
    handleEngineReady,
    handleEngineError,
  }
}

// Warm requested engine chunks while the browser is idle so a mode switch
// feels instant, but never spend metered/slow connections on speculation.
export function usePrefetchEngines({
  prefetchModes,
  prefetchMode,
}: {
  prefetchModes: BookPreviewMode[] | undefined
  prefetchMode: (next: BookPreviewMode) => void
}) {
  const prefetchedRef = useRef(new Set<BookPreviewMode>())
  useEffect(() => {
    const wants = prefetchModes ?? []
    if (wants.length === 0) return
    const conn = (
      navigator as {
        connection?: { saveData?: boolean; effectiveType?: string }
      }
    ).connection
    if (
      conn?.saveData ||
      conn?.effectiveType === 'slow-2g' ||
      conn?.effectiveType === '2g'
    ) {
      return
    }
    const run = () => {
      for (const modeId of wants) {
        if (prefetchedRef.current.has(modeId)) continue
        prefetchedRef.current.add(modeId)
        prefetchMode(modeId)
      }
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const timer = setTimeout(run, 1500)
    return () => clearTimeout(timer)
  }, [prefetchMode, prefetchModes])
}
