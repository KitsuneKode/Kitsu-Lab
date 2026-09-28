'use client'

import { useEffect, useState, type RefObject } from 'react'

/** A page-sized face an engine opted in with `data-bp-inkable`. */
export type PageSurface = { el: HTMLElement; pageIndex: number }

const SURFACE_SELECTOR = '[data-bp-inkable]'

function sameSurfaces(a: PageSurface[], b: PageSurface[]) {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.el === b[index].el && item.pageIndex === b[index].pageIndex,
    )
  )
}

/**
 * The page faces on screen, found as engines mount, swap and window them.
 * Engines mark a face with `data-bp-inkable` + `data-page-index`; layers
 * that draw over pages (ink, hotspots) portal into each one, so what they
 * draw moves with the page through zoom, turns and view switches.
 */
export function usePageSurfaces(
  rootRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): PageSurface[] {
  const [surfaces, setSurfaces] = useState<PageSurface[]>([])

  useEffect(() => {
    const root = rootRef.current
    if (!enabled || !root) return
    let frame = 0
    const scan = () => {
      frame = 0
      const next: PageSurface[] = []
      for (const el of root.querySelectorAll<HTMLElement>(SURFACE_SELECTOR)) {
        const pageIndex = Number.parseInt(el.dataset.pageIndex ?? '', 10)
        if (Number.isFinite(pageIndex) && pageIndex >= 0) {
          next.push({ el, pageIndex })
        }
      }
      setSurfaces((current) => (sameSurfaces(current, next) ? current : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-page-index', 'data-bp-inkable'],
    })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [enabled, rootRef])

  return enabled ? surfaces : []
}
