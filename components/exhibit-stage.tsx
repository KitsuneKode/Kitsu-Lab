'use client'

import { cn } from '@/lib/utils'
import { Maximize2Icon, Minimize2Icon } from 'lucide-react'
import { useRef, useSyncExternalStore, type ReactNode } from 'react'

const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}
const noopSubscribe = () => () => {}

export function ExhibitStage({
  children,
  hasIntro = false,
}: {
  children: ReactNode
  /** Reserve clearance under the absolutely-positioned Intro card. */
  hasIntro?: boolean
}) {
  const stageRef = useRef<HTMLDivElement | null>(null)

  const canFullscreen = useSyncExternalStore(
    noopSubscribe,
    () =>
      Boolean(document.fullscreenEnabled) &&
      Boolean(document.documentElement.requestFullscreen),
    () => false,
  )
  const isFullscreen = useSyncExternalStore(
    subscribeFullscreen,
    () => document.fullscreenElement === stageRef.current,
    () => false,
  )

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => {})
    } else {
      void stageRef.current?.requestFullscreen?.().catch(() => {})
    }
  }

  return (
    <div
      ref={stageRef}
      className={cn(
        'flex w-full flex-1 flex-col items-center [justify-content:safe_center] justify-center px-4',
        isFullscreen
          ? 'bg-background h-full overflow-auto overscroll-contain py-6'
          : hasIntro
            ? 'pt-[calc(3.75rem+15vh+1rem)] pb-10'
            : 'py-6',
      )}
    >
      {children}
      {canFullscreen && (
        <button
          type="button"
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? 'Exit fullscreen' : 'View fullscreen'}
          aria-pressed={isFullscreen}
          className="fixed top-5 right-5 z-50 flex size-9 items-center justify-center rounded-full border border-white/10 bg-neutral-900/80 text-neutral-400 backdrop-blur-xl transition-[background-color,color,scale] hover:scale-105 hover:bg-neutral-800 hover:text-white"
        >
          {isFullscreen ? (
            <Minimize2Icon className="size-4" aria-hidden />
          ) : (
            <Maximize2Icon className="size-4" aria-hidden />
          )}
        </button>
      )}
    </div>
  )
}
