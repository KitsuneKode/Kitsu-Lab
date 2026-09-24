'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import type { Promotion } from './promotion'
import { useImpression, usePromotions } from './promotion-provider'

/**
 * A one-line bar in the thumb zone that appears only after the element you
 * `watch` (usually the pricing card) has scrolled up out of view, and hides
 * again when it comes back. It is for someone who has already seen the offer
 * and kept reading, so it never shows on arrival.
 *
 * Content comes from a card slot, so the same editor schedules it.
 *
 * ```tsx
 * const pricing = useRef<HTMLDivElement>(null)
 * <div ref={pricing}>…</div>
 * <PromoStickyCta slot="sticky" watch={pricing} />
 * ```
 */
export function PromoStickyCta({
  slot = 'sticky',
  watch,
  root = null,
  mobileOnly = true,
  className,
}: {
  slot?: string
  watch: React.RefObject<HTMLElement | null>
  /** Scroll container, when it is not the window (e.g. a demo frame). */
  root?: Element | null
  /** Hide from 768px up, where the page has room for its own CTA. */
  mobileOnly?: boolean
  className?: string
}) {
  const { card, pathname, report, Link, setBottomInset } = usePromotions()
  const promotion = card(slot)
  const [past, setPast] = React.useState(false)
  const bar = React.useRef<HTMLDivElement>(null)

  // Tell floating surfaces how much room this bar takes while it shows, so
  // a toast rises above it rather than stacking on it.
  const open = past && Boolean(promotion?.cta)
  React.useEffect(() => {
    const element = bar.current
    if (!open || !element) return
    const narrow = window.matchMedia('(max-width: 767px)').matches
    if (mobileOnly && !narrow) return
    setBottomInset(element.getBoundingClientRect().height + 8)
    return () => setBottomInset(0)
  }, [open, mobileOnly, setBottomInset])

  React.useEffect(() => {
    const element = watch.current
    if (!element || !promotion || typeof IntersectionObserver === 'undefined')
      return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return
        const top = entry.rootBounds?.top ?? 0
        setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= top)
      },
      { root, threshold: 0 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [watch, root, promotion])

  const onImpression = React.useCallback(
    (p: Promotion) => report('impression', p),
    [report],
  )
  const ref = useImpression(past ? promotion : null, onImpression, pathname)
  if (!promotion?.cta) return null
  const cta = promotion.cta

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-slot="promo-sticky-cta"
      data-state={past ? 'open' : 'closed'}
      aria-hidden={!past}
      inert={!past}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-30 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] print:hidden',
        mobileOnly && 'md:hidden',
        className,
      )}
    >
      <div
        ref={bar}
        className={cn(
          'bg-foreground text-background pointer-events-auto flex items-center gap-3 rounded-2xl py-2 ps-4 pe-2 text-sm shadow-xl transition-[transform,opacity] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity',
          past
            ? 'translate-y-0 opacity-100'
            : 'translate-y-[calc(100%+1rem)] opacity-0 motion-reduce:translate-y-0',
        )}
      >
        <span className="min-w-0 flex-1 truncate font-medium">
          {promotion.title}
        </span>
        <Button
          nativeButton={false}
          size="sm"
          className="bg-background text-foreground hover:bg-background/90"
          render={
            <Link
              href={cta.href}
              onClick={() => report('click', promotion)}
              {...(cta.external
                ? { target: '_blank', rel: 'noopener noreferrer' }
                : {})}
            >
              {cta.label}
            </Link>
          }
        />
      </div>
    </div>
  )
}
