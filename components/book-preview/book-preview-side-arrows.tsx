'use client'

import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useBookPreview } from './book-preview-provider'

/**
 * Previous / next at the stage's edges — the same pair in every paged mode
 * (slide, PDF, premier, the flip book), so a reader never has to guess
 * whether this view turns by tapping, swiping or a button. They step by
 * whatever the view shows (a page or a spread), vanish at the ends, fade in
 * on hover for a mouse, stay softly visible on touch, and step aside with
 * the rest of the chrome while reading in fullscreen.
 *
 * Keyboard users have the arrow keys and the pager, so these stay out of
 * the tab order and the accessibility tree (the pager carries the labels).
 */
export function BookPreviewSideArrows() {
  const { state, canGoPrev, canGoNext, prevPage, nextPage } = useBookPreview()
  if (state.status !== 'ready' || state.totalPages < 2) return null
  if (state.capabilities.pagination === false) return null
  return (
    <>
      <SideArrow
        side="left"
        disabled={!canGoPrev}
        onPress={prevPage}
        label="Previous page"
      />
      <SideArrow
        side="right"
        disabled={!canGoNext}
        onPress={nextPage}
        label="Next page"
      />
    </>
  )
}

function SideArrow({
  side,
  disabled,
  onPress,
  label,
}: {
  side: 'left' | 'right'
  disabled: boolean
  onPress: () => void
  label: string
}) {
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      title={label}
      data-book-preview-side-arrow={side}
      data-disabled={disabled || undefined}
      data-book-preview-press
      onClick={(event) => {
        // A press on the arrow is not a tap on the page: no chrome toggle,
        // no second turn from the engine underneath.
        event.stopPropagation()
        if (!disabled) onPress()
      }}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      className={
        'bg-background/75 text-foreground ring-foreground/10 absolute top-1/2 z-30 flex size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md ring-1 backdrop-blur-md ' +
        (side === 'left'
          ? 'left-[max(0.5rem,env(safe-area-inset-left))]'
          : 'right-[max(0.5rem,env(safe-area-inset-right))]')
      }
    >
      {side === 'left' ? (
        <IconChevronLeft className="size-5" />
      ) : (
        <IconChevronRight className="size-5" />
      )}
    </button>
  )
}
