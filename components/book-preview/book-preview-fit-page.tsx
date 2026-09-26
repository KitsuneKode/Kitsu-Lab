'use client'

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/** Below this width a typeset page stops reflowing and scales instead. */
export const FIT_PAGE_MIN_WIDTH = 340

/**
 * A fixed-layout page that never overflows its leaf. At a readable size it
 * renders natively; on a tiny leaf (a phone held sideways, a thumbnail) it
 * lays out at a minimum width and scales down as a whole — the way an
 * e-reader shows a fixed-layout book — instead of clipping its text.
 * Scaling is a transform, so text stays vector-sharp.
 */
export function BookPreviewFitPage({
  children,
  minWidth = FIT_PAGE_MIN_WIDTH,
}: {
  children: ReactNode
  minWidth?: number
}) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [box, setBox] = useState<{ width: number; height: number } | null>(null)

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      setBox((current) =>
        current && current.width === width && current.height === height
          ? current
          : { width, height },
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const scale =
    box && box.width > 0 && box.width < minWidth ? box.width / minWidth : 1
  return (
    <div ref={hostRef} className="relative h-full w-full overflow-hidden">
      {scale < 1 && box ? (
        <div
          data-book-preview-fit-scaled
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: minWidth,
            height: box.height / scale,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      ) : (
        <div className="h-full w-full">{children}</div>
      )}
    </div>
  )
}
