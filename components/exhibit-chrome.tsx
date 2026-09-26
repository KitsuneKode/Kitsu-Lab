'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'
import { useSyncExternalStore, type ReactNode } from 'react'

/**
 * The floating page chrome (Back to Lab, fullscreen) stays out of the way:
 * it tucks up while you scroll down into an exhibit, comes back the moment
 * you scroll up or reach the top, and disappears while an exhibit runs an
 * immersive preview (`html[data-exhibit-immersive]`, see globals.css).
 */
let tucked = false
let lastY = 0
const listeners = new Set<() => void>()

/** Tucks on a downward scroll past the header zone, returns on any upward scroll. */
function onScroll() {
  const y = window.scrollY
  const next = y > 96 && y > lastY
  // A few pixels of jitter should not flip it.
  if (Math.abs(y - lastY) < 6 && y > 96) return
  lastY = y
  if (next !== tucked) {
    tucked = next
    listeners.forEach((listener) => listener())
  }
}

/** One shared scroll listener for every chrome control. */
function subscribe(onChange: () => void) {
  if (listeners.size === 0) {
    // State may be left over from a page that unmounted mid-scroll.
    lastY = window.scrollY
    tucked = lastY > 96
    window.addEventListener('scroll', onScroll, { passive: true })
  }
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
    if (listeners.size === 0) window.removeEventListener('scroll', onScroll)
  }
}

/** Whether the floating chrome is currently tucked away. */
export function useChromeTucked() {
  return useSyncExternalStore(
    subscribe,
    () => tucked,
    () => false,
  )
}

/** Shared by every floating chrome control, so they hide and return together. */
export function chromeClass(isTucked: boolean) {
  return cn(
    'transition-[translate,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity',
    // Keyboard users always get it back.
    isTucked &&
      'pointer-events-none -translate-y-[calc(100%+1.5rem)] opacity-0 focus-within:pointer-events-auto focus-within:translate-y-0 focus-within:opacity-100',
  )
}

/** Wraps a floating control so it tucks and returns with the rest. */
export function ChromeButtonShell({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  const isTucked = useChromeTucked()
  return (
    <div data-exhibit-chrome className={cn(chromeClass(isTucked), className)}>
      {children}
    </div>
  )
}

/** The "Back to Lab" pill, shared by exhibit pages and their loading state. */
export function BackToLab() {
  return (
    <div
      className="fixed top-5 left-5 z-50"
      style={{ viewTransitionName: 'exhibit-back' }}
    >
      <ChromeButtonShell>
        <Link
          href="/"
          prefetch
          transitionTypes={['nav-back']}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs font-medium text-neutral-300 backdrop-blur-xl transition-[background-color,color,scale] hover:scale-105 hover:bg-neutral-800 hover:text-white"
        >
          <span aria-hidden>←</span>
          <span>Back to Lab</span>
        </Link>
      </ChromeButtonShell>
    </div>
  )
}
