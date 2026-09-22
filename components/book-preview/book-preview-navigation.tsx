"use client"

import { useId, useState } from "react"
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useBookPreview } from "./book-preview-provider"

export function BookPreviewNavigation() {
  const { state, canGoPrev, canGoNext, prevPage, nextPage, goToPage } = useBookPreview()
  const total = Math.max(state.totalPages, 1)
  const [scrub, setScrub] = useState<number | null>(null)
  const [jumpDraft, setJumpDraft] = useState<string | null>(null)
  const jumpId = useId()
  const shown = scrub ?? state.pageIndex

  const commitJump = (raw: string) => {
    const next = Number.parseInt(raw, 10)
    if (Number.isFinite(next)) goToPage(next - 1)
    setJumpDraft(null)
  }

  // A non-paginated engine (the 3D book counts spreads, not pages) would show
  // a counter and slider whose numbers mean nothing — keyboard navigation
  // still drives it through the shell.
  if (state.capabilities.pagination === false) return null

  return (
    <div className="flex w-full flex-col gap-3" data-book-preview-chrome>
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={prevPage}
          disabled={!canGoPrev}
          aria-label="Previous page"
          data-book-preview-press
          className="min-h-11 min-w-11"
        >
          <IconChevronLeft data-icon="inline-start" />
          Previous
        </Button>
        {state.totalPages === 0 ? (
          <p className="font-mono text-xs text-muted-foreground">No pages</p>
        ) : (
          <form
            className="flex items-baseline gap-1.5 font-mono text-xs text-muted-foreground"
            aria-live={scrub === null ? "polite" : "off"}
            onSubmit={(event) => {
              event.preventDefault()
              commitJump(jumpDraft ?? "")
            }}
          >
            <label htmlFor={jumpId}>Page</label>
            <input
              id={jumpId}
              name="page"
              value={jumpDraft ?? String(shown + 1)}
              inputMode="numeric"
              className="min-w-[3ch] max-w-[6ch] rounded bg-transparent text-center outline-none focus-visible:bg-muted focus-visible:ring-1 focus-visible:ring-ring/50"
              size={Math.max(String(shown + 1).length + 1, 3)}
              onFocus={(event) => {
                setJumpDraft(String(shown + 1))
                event.target.select()
              }}
              onChange={(event) => {
                setJumpDraft(event.target.value.replace(/[^0-9]/g, ""))
              }}
              onBlur={() => commitJump(jumpDraft ?? "")}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setJumpDraft(null)
                  event.currentTarget.blur()
                }
              }}
            />
            <span aria-hidden>of {state.totalPages}</span>
            <span className="sr-only">
              Page {shown + 1} of {state.totalPages}
            </span>
          </form>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={nextPage}
          disabled={!canGoNext}
          aria-label="Next page"
          data-book-preview-press
          className="min-h-11 min-w-11"
        >
          Next
          <IconChevronRight data-icon="inline-end" />
        </Button>
      </div>
      {state.totalPages > 1 ? (
        <Slider
          value={shown}
          min={0}
          max={total - 1}
          step={1}
          aria-label="Page position"
          onValueChange={(value) => setScrub(Array.isArray(value) ? value[0] : value)}
          onValueCommitted={(value) => {
            const next = Array.isArray(value) ? value[0] : value
            setScrub(null)
            if (typeof next === "number") goToPage(next, "instant")
          }}
        />
      ) : null}
    </div>
  )
}
