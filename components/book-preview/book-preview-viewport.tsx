'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { BookPreviewStatus } from './book-preview-status'
import { useBookPreview } from './book-preview-provider'

export function BookPreviewViewport({ children }: { children?: ReactNode }) {
  const { state, retry, setMode, enabledEngines } = useBookPreview()
  const pageEngine = enabledEngines.find((engine) => engine.id === 'page')
  const blocking =
    state.status === 'loading' ||
    state.status === 'idle' ||
    state.status === 'empty' ||
    state.status === 'unsupported' ||
    state.status === 'error'

  return (
    <div
      className="bg-card relative isolate min-h-[min(30rem,80svh)] w-full min-w-0 overflow-hidden rounded-xl border sm:min-h-[min(32rem,74svh)] lg:min-h-[min(40rem,80svh)] xl:min-h-[min(48rem,84svh)]"
      data-book-preview-surface
      data-book-preview-viewport
    >
      {!blocking && state.totalPages > 1 ? (
        <div
          className="bg-foreground/10 absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden rounded-t-xl"
          aria-hidden
          data-book-preview-progress
        >
          {/* scaleX rather than width: width animates on the layout path
              every single page turn, transform stays on the compositor. */}
          <div
            className="bg-foreground/50 h-full w-full origin-left transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={{
              transform: `scaleX(${Math.min(1, Math.max(0, state.pageIndex / Math.max(state.totalPages - 1, 1)))})`,
            }}
          />
        </div>
      ) : null}
      {blocking ? (
        <div className="absolute inset-0 z-10">
          <BookPreviewStatus
            status={state.status}
            error={state.error}
            onRetry={retry}
            onReload={
              state.error?.kind === 'engine-load'
                ? () => window.location.reload()
                : undefined
            }
            onFallback={
              pageEngine && state.mode !== 'page'
                ? () => setMode('page')
                : undefined
            }
          />
        </div>
      ) : null}
      <div
        data-book-preview-fade
        className={cn(
          'absolute inset-0',
          blocking && 'pointer-events-none opacity-0',
        )}
        aria-hidden={blocking}
        inert={blocking}
      >
        {children}
      </div>
    </div>
  )
}
