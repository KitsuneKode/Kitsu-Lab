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

// The shell and the engines both listen to taps on the page. When the shell
// spends a tap on the chrome (show/hide), engines must not also turn the page
// with it — they check this before acting on a tap.
let chromeTapAt = -Infinity
const CHROME_TAP_WINDOW_MS = 400

/** True when the tap that just ended was consumed by the reader chrome. */
export function tapConsumedByChrome(): boolean {
  return performance.now() - chromeTapAt < CHROME_TAP_WINDOW_MS
}

/** How long the reader sits still before fullscreen chrome slips away. */
export const CHROME_IDLE_MS = 2600
/** A tap is short and nearly still — anything more is a swipe or a scroll. */
const TAP_MAX_MS = 320
const TAP_MAX_TRAVEL_PX = 10
/** Share of the width, per side, that belongs to page turns. The band
    between is the chrome's: a tap there shows or hides the menu and never
    turns the page (engines agree via tapConsumedByChrome). */
export const TAP_TURN_EDGE_FRACTION = 0.3
/** A thin strip along the top also summons the menu, where the eye (and the
    thumb, on a phone held one-handed) looks for it. */
const TAP_TOP_BAND_FRACTION = 0.12
/** Mouse within this distance of the top or bottom edge wakes the chrome.
    Only the edges: a reader moving the mouse across the page is reading,
    and chrome springing up at every twitch is the sloppiest thing a reader
    can do. The handle, C, and a tap in the middle summon it deliberately. */
const EDGE_WAKE_PX = 88
const PIN_STORAGE_KEY = 'book-preview:chrome-pinned'

function readPinned(): boolean {
  try {
    return window.localStorage.getItem(PIN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Fullscreen reading hands the whole screen to the page. Chrome floats over
 * the stage and fades out after a short idle; moving the mouse, nearing an
 * edge, or tapping the middle of the page brings it back — the Apple Books /
 * Kindle contract. Turning pages never wakes it: that is reading, not
 * reaching for controls.
 *
 * The chrome never hides while it is in use: while focus sits inside it or
 * has left the reader (a menu or dialog portalled elsewhere), or while the
 * pointer rests on it. A reader who wants it for good pins it (remembered).
 */
export function useImmersiveChrome({
  enabled,
  rootRef,
}: {
  enabled: boolean
  rootRef: RefObject<HTMLElement | null>
}) {
  const [hidden, setHidden] = useState(false)
  const [pinned, setPinned] = useState(false)
  const pinnedRef = useRef(false)
  const timerRef = useRef<number | null>(null)
  const cursorTimerRef = useRef<number | null>(null)
  const overChromeRef = useRef(false)
  // Touch never focuses a tapped button on iOS and never hovers, so a press
  // inside the chrome is remembered directly: a page turn from the pager is
  // the reader using the chrome, not leaving it.
  const chromePressAtRef = useRef(-Infinity)
  const tapRef = useRef<{ id: number; x: number; y: number; t: number } | null>(
    null,
  )

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // The cursor hides on its own clock, imperatively (no re-render per
  // mouse move) and independently of the chrome: any movement at all brings
  // it back, even a slow drift that is not enough to summon the menu. Tying
  // it to the chrome left a reader moving the mouse with no cursor visible.
  const setCursorIdle = useCallback(
    (idle: boolean) => {
      rootRef.current?.toggleAttribute('data-cursor-idle', idle)
    },
    [rootRef],
  )

  const wakeCursor = useCallback(() => {
    setCursorIdle(false)
    if (cursorTimerRef.current !== null) {
      window.clearTimeout(cursorTimerRef.current)
    }
    cursorTimerRef.current = window.setTimeout(() => {
      cursorTimerRef.current = null
      if (!overChromeRef.current) setCursorIdle(true)
    }, CHROME_IDLE_MS)
  }, [setCursorIdle])

  const chromeInUse = useCallback(() => {
    const root = rootRef.current
    if (!root) return false
    if (overChromeRef.current) return true
    if (performance.now() - chromePressAtRef.current < 1500) return true
    const active = document.activeElement
    if (!(active instanceof HTMLElement) || active === document.body) {
      return false
    }
    if (!root.contains(active)) return true
    return Boolean(active.closest('[data-book-preview-chrome]'))
  }, [rootRef])

  const scheduleHide = useCallback(() => {
    clear()
    if (pinnedRef.current) return
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

  // The pin is a per-reader preference, read once fullscreen opens (never
  // during render, so hydration stays clean).
  useEffect(() => {
    if (!enabled) return
    const stored = readPinned()
    pinnedRef.current = stored
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPinned(stored)
  }, [enabled])

  const togglePinned = useCallback(() => {
    const next = !pinnedRef.current
    pinnedRef.current = next
    setPinned(next)
    try {
      window.localStorage.setItem(PIN_STORAGE_KEY, next ? '1' : '0')
    } catch {
      // Private mode: the pin just lasts this session.
    }
    setHidden(false)
    if (next) clear()
    else scheduleHide()
  }, [clear, scheduleHide])

  /** The handle and C: show when hidden, put away when shown. */
  const toggleChrome = useCallback(() => {
    if (!enabled) return
    if (hidden) {
      setHidden(false)
      scheduleHide()
      return
    }
    if (pinnedRef.current) return
    clear()
    setHidden(true)
  }, [clear, enabled, hidden, scheduleHide])

  // Entering fullscreen starts the idle clock; leaving it restores chrome.
  useEffect(() => {
    if (!enabled) {
      clear()
      return
    }
    scheduleHide()
    return () => {
      clear()
      if (cursorTimerRef.current !== null) {
        window.clearTimeout(cursorTimerRef.current)
        cursorTimerRef.current = null
      }
      setCursorIdle(false)
      setHidden(false)
    }
  }, [clear, enabled, scheduleHide, setCursorIdle])

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
      wakeCursor()
      const root = rootRef.current
      if (hidden && root) {
        const rect = root.getBoundingClientRect()
        const nearEdge =
          event.clientY - rect.top < EDGE_WAKE_PX ||
          rect.bottom - event.clientY < EDGE_WAKE_PX
        if (!nearEdge) return
      }
      show()
    },
    [enabled, hidden, rootRef, show, wakeCursor],
  )

  const onPointerLeave = useCallback(() => {
    overChromeRef.current = false
  }, [])

  const onPointerDownCapture = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!enabled) return
      if (
        (event.target as HTMLElement | null)?.closest?.(
          '[data-book-preview-chrome]',
        )
      ) {
        chromePressAtRef.current = performance.now()
      }
      if (event.pointerType === 'mouse') return
      tapRef.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        t: event.timeStamp,
      }
    },
    [enabled],
  )

  // Touch and pen: a quick tap in the middle band (or the top strip) toggles
  // the chrome and is consumed — the page does not also turn. A tap in a
  // turn zone turns the page and, if the chrome was up, puts it away:
  // reading has resumed.
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
      // With the pen out, a tap is ink.
      if (target?.closest?.('[data-bp-ink-surface][data-active]')) return
      // A tap that made a text selection is selecting, not asking for chrome.
      const selection = window.getSelection?.()
      if (selection && !selection.isCollapsed) return
      const root = rootRef.current
      if (!root) return
      // Zones are measured on the page that was tapped (the engine marks it
      // data-bp-tap-surface), not the whole screen — a portrait page centred
      // on a wide display would otherwise sit almost entirely in the middle
      // band and stop turning. The top strip is always the screen's.
      const rootRect = root.getBoundingClientRect()
      const surface = target?.closest?.('[data-bp-tap-surface]')
      const rect =
        surface instanceof HTMLElement && root.contains(surface)
          ? surface.getBoundingClientRect()
          : rootRect
      const ratioX = (event.clientX - rect.left) / Math.max(rect.width, 1)
      const ratioY =
        (event.clientY - rootRect.top) / Math.max(rootRect.height, 1)
      const inTurnZone =
        ratioX <= TAP_TURN_EDGE_FRACTION || ratioX >= 1 - TAP_TURN_EDGE_FRACTION
      if (inTurnZone && ratioY >= TAP_TOP_BAND_FRACTION) {
        if (!hidden && !pinnedRef.current) {
          clear()
          setHidden(true)
        }
        return
      }
      chromeTapAt = performance.now()
      if (hidden) {
        show()
      } else if (!pinnedRef.current) {
        clear()
        setHidden(true)
      }
    },
    [clear, enabled, hidden, rootRef, show],
  )

  // A page turn means reading has resumed — put the chrome away, unless the
  // reader is using it (the turn came from the pager they are touching).
  const hideForReading = useCallback(() => {
    if (!enabled || pinnedRef.current || chromeInUse()) return
    clear()
    setHidden(true)
    // Turning from the keyboard: the cursor is not in use either.
    setCursorIdle(true)
  }, [chromeInUse, clear, enabled, setCursorIdle])

  return {
    chromeHidden: enabled && hidden,
    chromePinned: enabled && pinned,
    showChrome: show,
    toggleChrome,
    togglePinned,
    hideForReading,
    chromeHandlers: {
      onPointerMove,
      onPointerLeave,
      onPointerDownCapture,
      onPointerUpCapture,
    },
  }
}
