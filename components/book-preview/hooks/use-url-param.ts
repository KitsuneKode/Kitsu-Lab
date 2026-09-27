'use client'

import { useSyncExternalStore } from 'react'
import { readUrlParam } from '../url-state'

const noopSubscribe = () => () => {}

/**
 * A query param as it stood when the page loaded, read during render. The
 * server snapshot is null, so hydration matches the server markup and the
 * client re-renders with the real value — no setState-in-effect round trip.
 * Later replaceState writes do not notify; callers keep their own state once
 * the reader makes a choice.
 */
export function useUrlParam(key: string | undefined): string | null {
  return useSyncExternalStore(
    noopSubscribe,
    () => readUrlParam(key),
    () => null,
  )
}
