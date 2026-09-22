'use client'

import { forwardRef, type ReactNode } from 'react'

type FlipSheetProps = {
  children: ReactNode
  hard?: boolean
}

export const FlipSheet = forwardRef<HTMLDivElement, FlipSheetProps>(
  function FlipSheet({ children, hard }, ref) {
    return (
      <div
        ref={ref}
        data-density={hard ? 'hard' : undefined}
        className="bg-background h-full w-full overflow-visible"
      >
        <div className="[pointer-events:none] h-full w-full [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
          {children}
        </div>
      </div>
    )
  },
)
