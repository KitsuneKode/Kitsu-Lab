'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  annotationsStorageKey,
  sanitizeAnnotations,
  type BookPreviewAnnotation,
} from '../annotations'

const noopSubscribe = () => () => {}
const EMPTY: BookPreviewAnnotation[] = []

function readStored(sourceKey: string): BookPreviewAnnotation[] | undefined {
  try {
    const raw = window.localStorage.getItem(annotationsStorageKey(sourceKey))
    return raw === null ? undefined : sanitizeAnnotations(JSON.parse(raw))
  } catch {
    return undefined
  }
}

function writeStored(sourceKey: string, list: BookPreviewAnnotation[]) {
  try {
    window.localStorage.setItem(
      annotationsStorageKey(sourceKey),
      JSON.stringify(list),
    )
  } catch {
    // Storage may be full or unavailable (private mode) — the session copy
    // still works.
  }
}

/**
 * The notebook for the current document: controlled (`annotations` +
 * `onAnnotationsChange`, for hosts that sync to their own backend) or
 * uncontrolled, optionally remembered per document in localStorage and kept
 * in step across tabs through the storage event.
 */
export function useAnnotations({
  sourceKey,
  annotations,
  defaultAnnotations,
  onAnnotationsChange,
  persist,
}: {
  sourceKey: string
  annotations: BookPreviewAnnotation[] | undefined
  defaultAnnotations: BookPreviewAnnotation[] | undefined
  onAnnotationsChange: ((next: BookPreviewAnnotation[]) => void) | undefined
  persist: boolean
}) {
  const controlled = annotations !== undefined
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  // Bumped when another tab writes this document's notebook.
  const [storageVersion, setStorageVersion] = useState(0)
  const stored = useMemo(
    () =>
      persist && hydrated && storageVersion >= 0
        ? readStored(sourceKey)
        : undefined,
    [hydrated, persist, sourceKey, storageVersion],
  )
  // Session edits, tagged with the document they belong to so switching
  // documents never shows another book's highlights.
  const [local, setLocal] = useState<{
    key: string
    version: number
    list: BookPreviewAnnotation[]
  } | null>(null)

  useEffect(() => {
    if (!persist) return
    const storageKey = annotationsStorageKey(sourceKey)
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey) setStorageVersion((v) => v + 1)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [persist, sourceKey])

  const value: BookPreviewAnnotation[] = controlled
    ? annotations
    : local && local.key === sourceKey && local.version === storageVersion
      ? local.list
      : (stored ?? defaultAnnotations ?? EMPTY)

  const update = useCallback(
    (fn: (list: BookPreviewAnnotation[]) => BookPreviewAnnotation[]) => {
      const next = fn(value)
      if (!controlled) {
        setLocal({ key: sourceKey, version: storageVersion, list: next })
      }
      if (persist && !controlled) writeStored(sourceKey, next)
      onAnnotationsChange?.(next)
    },
    [
      controlled,
      onAnnotationsChange,
      persist,
      sourceKey,
      storageVersion,
      value,
    ],
  )

  return { annotations: value, updateAnnotations: update }
}
