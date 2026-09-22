'use client'

import { isInteractiveTarget } from '../keyboard'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react'

/** How long the reader sits still before fullscreen chrome slips away. */
export const CHROME_IDLE_MS = 2600
/** A tap is short and nearly still — anything more is a swipe or a scroll. */
const TAP_MAX_MS = 320
const TAP_MAX_TRAVEL_PX = 10
/** Mouse within this distance of the top or bottom edge wakes the chrome. */
const EDGE_WAKE_PX = 72

/**
 * Fullscreen reading hands the whole screen to the page. Chrome floats over
 * the stage and fades out after a short idle; moving the mouse, nearing an
 * edge, or tapping the middle of the page brings it back — the Apple Books /
 * Kindle contract. Turning pages never wakes it: that is reading, not
 * reaching for controls.
 *
 * The chrome never hides while it is in use: while focus sits inside it or
 * has left the reader (a menu or dialog portalled elsewhere), or while the
 * pointer rests on it.
 */
export function useImmersiveChrome({
  enabled,
  rootRef,
}: {
  enabled: boolean
  rootRef: RefObject<HTMLElement | null>
}) {
  const [hidden, setHidden] = useState(false)
  const timerRef = useRef<number | null>(null)
  const overChromeRef = useRef(false)
  const tapRef = useRef<{ id: number; x: number; y: number; t: number } | null>(
    null,
  )

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const chromeInUse = useCallback(() => {
    const root = rootRef.current
    if (!root) return false
    if (overChromeRef.current) return true
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || active === document.body) {
      return false
    }
    if (!root.contains(active)) return true
    return Boolean(active.closest('[data-book-preview-chrome]'))
  }, [rootRef])

  const scheduleHide = useCallback(() => {
    clear()
    timerRef.current = window.setTimeout(function hideWhenIdle() {
      if (chromeInUse()) {
        timerRef.current = window.setTimeout(hideWhenIdle, CHROME_IDLE_MS)
        return
      }
      timerRef.current = null
      setHidden(true)
    }, CHROME_IDLE_MS)
  }, [chromeInUse, clear])

  const show = useCallback(() => {
    setHidden(false)
    scheduleHide()
  }, [scheduleHide])

  // Entering fullscreen starts the idle clock; leaving it restores chrome.
  useEffect(() => {
    if (!enabled) {
      clear()
      return
    }
    scheduleHide()
    return () => {
      clear()
      setHidden(false)
    }
  }, [clear, enabled, scheduleHide])

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled) return
      const target = event.target as HTMLElement | null
      overChromeRef.current = Boolean(
        target?.closest?.('[data-book-preview-chrome]'),
      )
      if (event.pointerType !== 'mouse') return
      // A resting cursor in the page never wakes chrome — only real movement,
      // or approaching the edges where the bars live.
      if (event.movementX === 0 && event.movementY === 0) return
      const root = rootRef.current
      if (hidden && root) {
        const rect = root.getBoundingClientRect()
        const nearEdge =
          event.clientY - rect.top < EDGE_WAKE_PX ||
          rect.bottom - event.clientY < EDGE_WAKE_PX
        const brisk = Math.abs(event.movementX) + Math.abs(event.movementY) > 6
        if (!nearEdge && !brisk) return
      }
      show()
    },
    [enabled, hidden, rootRef, show],
  )

  const onPointerLeave = useCallback(() => {
    overChromeRef.current = false
  }, [])

  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled || event.pointerType === 'mouse') return
      tapRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: event.timeStamp,
      }
    },
    [enabled],
  )

  // Touch and pen: a quick tap in the middle band of the page toggles chrome.
  // The outer bands belong to page turns, so they never toggle it.
  const onPointerUpCapture = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const tap = tapRef.current
      tapRef.current = null
      if (!enabled || !tap || tap.id !== event.pointerId) return
      if (event.timeStamp - tap.t > TAP_MAX_MS) return
      if (
        Math.hypot(event.clientX - tap.x, event.clientY - tap.y) >
        TAP_MAX_TRAVEL_PX
      ) {
        return
      }
      const target = event.target as HTMLElement | null
      if (isInteractiveTarget(target)) return
      if (target?.closest?.('[data-book-preview-chrome]')) return
      // A tap that made a text selection is selecting, not asking for chrome.
      const selection = window.getSelection?.()
      if (selection && !selection.isCollapsed) return
      const root = rootRef.current
      if (!root) return
      const rect = root.getBoundingClientRect()
      const ratio = (event.clientX - rect.left) / Math.max(rect.width, 1)
      if (ratio < 0.28 || ratio > 0.72) return
      if (hidden) {
        show()
      } else {
        clear()
        setHidden(true)
      }
    },
    [clear, enabled, hidden, rootRef, show],
  )

  return {
    chromeHidden: enabled && hidden,
    showChrome: show,
    chromeHandlers: {
      onPointerMove,
      onPointerLeave,
      onPointerDownCapture,
      onPointerUpCapture,
    },
  }
}
