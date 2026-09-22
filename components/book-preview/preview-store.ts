import {
  bookPreviewReducer,
  type BookPreviewAction,
  type BookPreviewState,
} from './reducer'
import type { BookPreviewError, BookPreviewStatus } from './types'

export type PreviewListeners = {
  onStatusChange?: (status: BookPreviewStatus) => void
  onError?: (error: BookPreviewError) => void
}

// External store around the reducer. State swaps are atomic so subscribers get
// a stable snapshot for useSyncExternalStore, and prop notifications fire
// inside dispatch — transactionally with the transition that produced them —
// instead of a post-commit effect.
export function createPreviewStore(initial: BookPreviewState) {
  let state = initial
  const subscribers = new Set<() => void>()
  let listeners: PreviewListeners = {}
  return {
    getState: () => state,
    subscribe(listener: () => void) {
      subscribers.add(listener)
      return () => {
        subscribers.delete(listener)
      }
    },
    dispatch(action: BookPreviewAction) {
      const next = bookPreviewReducer(state, action)
      if (next === state) return
      const prev = state
      state = next
      if (next.status !== prev.status) listeners.onStatusChange?.(next.status)
      if (next.error && next.error !== prev.error)
        listeners.onError?.(next.error)
      for (const listener of subscribers) listener()
    },
    setListeners(next: PreviewListeners) {
      listeners = next
    },
    // Replays the current snapshot to freshly registered handlers, matching the
    // mount + identity-change emissions a dep-driven effect would produce.
    emitCurrent() {
      listeners.onStatusChange?.(state.status)
      if (state.error) listeners.onError?.(state.error)
    },
  }
}

export type PreviewStore = ReturnType<typeof createPreviewStore>
