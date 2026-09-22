'use client'

import { useEffect, useRef } from 'react'

/**
 * Dot + trailing-ring cursor for fine pointers. The ring lerps toward the
 * pointer and expands over interactive elements. Deliberately defensive:
 * - only activates on (pointer: fine) — never on touch
 * - disabled under prefers-reduced-motion
 * - the native cursor is only hidden via body[data-custom-cursor], set after
 *   the first pointermove — if this component never runs, nothing changes
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
    let visible = false

    const INTERACTIVE =
      "a, button, [role='button'], input, select, textarea, label, summary, [data-cursor]"

    const onMove = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY
      if (!visible) {
        visible = true
        rx = x
        ry = y
        dot.style.opacity = '1'
        ring.style.opacity = '1'
        document.body.dataset.customCursor = ''
      }
      const target = event.target as Element | null
      ring.toggleAttribute('data-hover', !!target?.closest?.(INTERACTIVE))
    }

    const onLeave = () => {
      dot.style.opacity = '0'
      ring.style.opacity = '0'
    }

    const loop = () => {
      rx += (x - rx) * 0.18
      ry += (y - ry) * 0.18
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`
      ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    raf = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
      cancelAnimationFrame(raf)
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
