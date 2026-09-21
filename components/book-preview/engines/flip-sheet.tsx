"use client"

import { forwardRef, type ReactNode } from "react"

type FlipSheetProps = {
  children: ReactNode
  hard?: boolean
}

export const FlipSheet = forwardRef<HTMLDivElement, FlipSheetProps>(function FlipSheet(
  { children, hard },
  ref
) {
  return (
    <div
      ref={ref}
      data-density={hard ? "hard" : undefined}
      className="h-full w-full overflow-visible bg-background"
    >
      <div className="h-full w-full [pointer-events:none] [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
        {children}
      </div>
    </div>
  )
})
