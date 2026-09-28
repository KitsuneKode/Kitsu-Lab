'use client'

import { BookPreviewEngineBoundary } from './book-preview-engine-boundary'
import type { BookPreviewEngineProps, BookPreviewMode } from './types'
import { useCallback, useEffect, useRef, type ComponentType } from 'react'

export type BookPreviewActiveEngineProps = BookPreviewEngineProps & {
  loadedEngine: {
    id: BookPreviewMode
    Component: ComponentType<BookPreviewEngineProps>
  } | null
  activeEngineId?: BookPreviewMode
  resetKey: string
}

export function BookPreviewActiveEngine({
  loadedEngine,
  activeEngineId,
  resetKey,
  onError,
  ...engineProps
}: BookPreviewActiveEngineProps) {
  if (!loadedEngine || loadedEngine.id !== activeEngineId) return null
  return (
    // The key carries the engine epoch: a retry must remount the engine so a
    // dead document load (parse failure, cancelled password prompt) actually
    // starts over instead of sitting inert under the loading surface.
    <BookPreviewEngineBoundary
      key={resetKey}
      engineId={activeEngineId ?? 'none'}
      resetKey={resetKey}
      onError={onError}
    >
      <LiveEngine
        Component={loadedEngine.Component}
        engineProps={engineProps}
        onError={onError}
      />
    </BookPreviewEngineBoundary>
  )
}

/** One engine instance per reset key. Reports from an instance that has
    already been replaced (a slow PDF parse finishing after the reader moved
    on) are dropped, so a stale "ready" can never mark the new engine done. */
export function LiveEngine({
  Component,
  engineProps,
  onError,
}: {
  Component: ComponentType<BookPreviewEngineProps>
  engineProps: Omit<BookPreviewEngineProps, 'onError'>
  onError: BookPreviewEngineProps['onError']
}) {
  const liveRef = useRef(true)
  useEffect(() => {
    liveRef.current = true
    return () => {
      liveRef.current = false
    }
  }, [])
  const { onReady, onPageChange } = engineProps
  const guardedReady = useCallback<BookPreviewEngineProps['onReady']>(
    (info) => {
      if (liveRef.current) onReady(info)
    },
    [onReady],
  )
  const guardedError = useCallback<BookPreviewEngineProps['onError']>(
    (error) => {
      if (liveRef.current) onError(error)
    },
    [onError],
  )
  const guardedPage = useCallback<BookPreviewEngineProps['onPageChange']>(
    (index, behavior) => {
      if (liveRef.current) onPageChange(index, behavior)
    },
    [onPageChange],
  )
  return (
    <Component
      {...engineProps}
      onReady={guardedReady}
      onError={guardedError}
      onPageChange={guardedPage}
    />
  )
}
