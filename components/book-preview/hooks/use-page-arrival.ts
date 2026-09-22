'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { BOOK_PREVIEW_UI_MS } from '../motion'

type ArrivalPhase = 'entering' | 'settled' | 'instant'

type PageArrival = {
  'data-book-preview-page': true
  'data-enter-dir': 'next' | 'prev'
  'data-mounted'?: true
  'data-instant'?: true
}

/**
 * Entry-animation state for a page element that remounts on every turn.
 *
 * Spread the result onto the element. When turns arrive faster than the
 * animation lasts, the entrance is skipped rather than restarted: holding an
 * arrow key would otherwise replay the same 220ms slide several times a
 * second, which reads as flicker rather than movement. The first paint is
 * "settled" too, so opening the reader does not animate.
 *
 * Timing lives in the layout effect, not in render -- reading a clock during
 * render is impure and makes the result depend on when React happens to
 * re-render.
 */
export function usePageArrival(
  pageIndex: number,
  instant = false,
): PageArrival {
  const [prevIndex, setPrevIndex] = useState(pageIndex)
  const [enterDir, setEnterDir] = useState<'next' | 'prev'>('next')
  const [phase, setPhase] = useState<ArrivalPhase>('settled')
  const lastTurnRef = useRef(0)

  if (prevIndex !== pageIndex) {
    setPrevIndex(pageIndex)
    setEnterDir(pageIndex > prevIndex ? 'next' : 'prev')
    setPhase('entering')
  }

  useLayoutEffect(() => {
    if (phase !== 'entering') return
    const now = performance.now()
    const rapid = now - lastTurnRef.current < BOOK_PREVIEW_UI_MS
    lastTurnRef.current = now
    if (rapid) {
      setPhase('instant')
      return
    }
    // Hold the entry state for one frame so the transition has a start value.
    const frame = requestAnimationFrame(() => setPhase('settled'))
    return () => cancelAnimationFrame(frame)
  }, [phase, pageIndex])

  return {
    'data-book-preview-page': true,
    'data-enter-dir': enterDir,
    ...(phase === 'entering' && !instant
      ? {}
      : { 'data-mounted': true as const }),
    ...(phase === 'instant' || instant
      ? { 'data-instant': true as const }
      : {}),
  }
}
