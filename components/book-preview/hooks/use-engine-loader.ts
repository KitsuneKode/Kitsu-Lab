'use client'

import { type BookPreviewAction } from '../reducer'
import { engineSupportNote } from '../support'
import { isEmptySource } from '../normalize'
import { describeEngineLoadFailure } from '../engines'
import type {
  BookPreviewEngine,
  BookPreviewEngineProps,
  BookPreviewMode,
  NormalizedBookSource,
} from '../types'
import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type Dispatch,
} from 'react'

export type LoadedEngine = {
  id: BookPreviewMode
  Component: ComponentType<BookPreviewEngineProps>
} | null

export function useEngineLoader({
  normalized,
  activeEngine,
  sourceKey,
  engineEpoch,
  dispatch,
}: {
  normalized: NormalizedBookSource
  activeEngine: BookPreviewEngine | null
  sourceKey: string
  engineEpoch: number
  dispatch: Dispatch<BookPreviewAction>
}) {
  const [loadedEngine, setLoadedEngine] = useState<LoadedEngine>(null)
  const loadedRef = useRef<BookPreviewMode | null>(null)
  const normalizedRef = useRef(normalized)
  useLayoutEffect(() => {
    normalizedRef.current = normalized
  })

  // A layout effect, not a passive one: an already-loaded engine remounts
  // for a new source in the same commit and reports "ready" from its own
  // passive effect. Children's passive effects run before the parent's, so
  // a passive "loading" here would land after that ready and strand the
  // reader on "Loading reader…" (StrictMode's double-invoke hid it in dev).
  // Layout effects all run before any passive effect.
  useLayoutEffect(() => {
    const currentSource = normalizedRef.current
    if (isEmptySource(currentSource)) {
      dispatch({ type: 'empty' })
      return
    }
    if (!activeEngine) {
      dispatch({
        type: 'engine-unsupported',
        message: 'No compatible reader is available for this source.',
      })
      return
    }
    if (activeEngine.isSupported && !activeEngine.isSupported()) {
      const note = engineSupportNote(activeEngine.id, false)
      dispatch({
        type: 'engine-unsupported',
        message:
          `${activeEngine.label}: ${note?.reason ?? 'not supported in this browser.'} ${note?.suggestion ?? ''}`.trim(),
      })
      return
    }

    let cancelled = false
    const engineId = activeEngine.id
    dispatch({ type: 'engine-loading' })
    loadedRef.current = engineId
    activeEngine
      .load()
      .then((mod) => {
        if (cancelled || loadedRef.current !== engineId) return
        const EngineComponent = mod.default
        if (!EngineComponent) {
          dispatch({
            type: 'engine-error',
            error: {
              kind: 'engine-load',
              message: describeEngineLoadFailure(activeEngine.label),
            },
          })
          return
        }
        setLoadedEngine({ id: engineId, Component: EngineComponent })
      })
      .catch((error: unknown) => {
        if (cancelled || loadedRef.current !== engineId) return
        console.error(error)
        dispatch({
          type: 'engine-error',
          error: {
            kind: 'engine-load',
            message: describeEngineLoadFailure(activeEngine.label),
          },
        })
        setLoadedEngine(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeEngine, sourceKey, engineEpoch, dispatch])

  return loadedEngine
}
