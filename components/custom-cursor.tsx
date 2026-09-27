'use client'

import { useEffect, useRef } from 'react'

/** Surfaces where the native cursor carries meaning — the text I-beam, a
    grab hand, a drawing crosshair — keep it, and the custom cursor steps
    aside rather than drawing a second pointer on top. */
const NATIVE_CURSOR =
  "input, textarea, select, [contenteditable='true'], [data-native-cursor]"

const INTERACTIVE =
  "a, button, [role='button'], input, select, textarea, label, summary, [data-cursor]"

/**
 * Dot + trailing-ring cursor for mice. The ring lerps toward the pointer and
 * expands over interactive elements. Deliberately defensive:
 * - driven by mouse pointer events only — touch and pen never move it
 * - disabled under prefers-reduced-motion and on coarse pointers
 * - the native cursor is only hidden via body[data-custom-cursor], set after
 *   the first mouse move — if this component never runs, nothing changes
 * - reappears the moment the mouse returns (leaving the window used to hide
 *   it for good, with the native cursor also hidden — no cursor at all)
 * - the animation loop sleeps once the ring has caught up
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || reduced.matches) return

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    let x = window.innerWidth / 2
    let y = window.innerHeight / 2
    let rx = x
    let ry = y
    let raf = 0
    let shown = false
    let started = false

    const setShown = (next: boolean) => {
      if (shown === next) return
      shown = next
      dot.style.opacity = next ? '1' : '0'
      ring.style.opacity = next ? '1' : '0'
    }

    const frame = () => {
      rx += (x - rx) * 0.18
      ry += (y - ry) * 0.18
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      // Sleep once settled — no 60fps loop for a cursor that is not moving.
      if (Math.abs(x - rx) + Math.abs(y - ry) > 0.1) {
        raf = requestAnimationFrame(frame)
      } else {
        raf = 0
      }
    }
    const wake = () => {
      if (!raf) raf = requestAnimationFrame(frame)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') {
        setShown(false)
        return
      }
      x = event.clientX
      y = event.clientY
      if (!started) {
        started = true
        rx = x
        ry = y
        document.body.dataset.customCursor = ''
      }
      const target = event.target as Element | null
      const native = Boolean(target?.closest?.(NATIVE_CURSOR))
      setShown(!native)
      ring.toggleAttribute(
        'data-hover',
        !native && Boolean(target?.closest?.(INTERACTIVE)),
      )
      wake()
    }

    const hide = () => setShown(false)
    const onVisibility = () => {
      if (document.hidden) hide()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', hide)
    window.addEventListener('blur', hide)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      document.documentElement.removeEventListener('pointerleave', hide)
      window.removeEventListener('blur', hide)
      document.removeEventListener('visibilitychange', onVisibility)
      if (raf) cancelAnimationFrame(raf)
      delete document.body.dataset.customCursor
    }
  }, [])

  return (
    <>
      <div ref={dotRef} aria-hidden className="cursor-dot" />
      <div ref={ringRef} aria-hidden className="cursor-ring" />
    </>
  )
}
