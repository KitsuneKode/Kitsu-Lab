'use client'

import { useEffect, useRef, useState } from 'react'
import { IconX } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { useBookPreview } from './book-preview-provider'

/** Long enough to read and reach for, short enough to never linger. */
const RESUME_NOTICE_MS = 8000

/**
 * The "welcome back" pill. Offered once as a document opens:
 * - after a silent resume — "Picked up on page 12 · Start over"
 * - when a shared link opened away from the reader's own place —
 *   "You were on page 40 · Go there"
 * It leaves on its own, on the reader's first page turn, or on a choice.
 */
export function BookPreviewResume() {
  const { resume, dismissResume, goToPage, state } = useBookPreview()
  const [settledPage, setSettledPage] = useState<number | null>(null)
  const settleTimer = useRef(0)
  const pageRef = useRef(state.pageIndex)
  useEffect(() => {
    pageRef.current = state.pageIndex
  })

  // The resume itself turns the page; only turns after it has landed count
  // as the reader moving on.
  useEffect(() => {
    if (!resume) return
    settleTimer.current = window.setTimeout(
      () => setSettledPage(pageRef.current),
      600,
    )
    const leave = window.setTimeout(dismissResume, RESUME_NOTICE_MS)
    return () => {
      window.clearTimeout(settleTimer.current)
      window.clearTimeout(leave)
      setSettledPage(null)
    }
  }, [resume, dismissResume])

  useEffect(() => {
    if (settledPage !== null && state.pageIndex !== settledPage) {
      dismissResume()
    }
  }, [dismissResume, settledPage, state.pageIndex])

  if (!resume || state.status !== 'ready') return null
  const page = resume.pageIndex + 1
  return (
    <div
      role="status"
      aria-live="polite"
      data-book-preview-resume
      className="bg-popover text-popover-foreground ring-foreground/10 absolute bottom-3 left-1/2 z-[35] flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-full py-1 pr-1 pl-4 text-sm shadow-lg ring-1"
    >
      <span className="truncate">
        {resume.kind === 'resumed'
          ? `Picked up on page ${page}`
          : `You were on page ${page}`}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="shrink-0 rounded-full"
        data-book-preview-press
        onClick={() => {
          goToPage(resume.kind === 'resumed' ? 0 : resume.pageIndex)
          dismissResume()
        }}
      >
        {resume.kind === 'resumed' ? 'Start over' : 'Go there'}
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Dismiss"
        className="shrink-0 rounded-full"
        onClick={dismissResume}
      >
        <IconX />
      </Button>
    </div>
  )
}
