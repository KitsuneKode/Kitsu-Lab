'use client'

import * as React from 'react'
import { IconArrowRight } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import type { Promotion } from './promotion'
import { useImpression, usePromotions } from './promotion-provider'

/**
 * The "New: … →" pill above a hero headline. It reads a card slot, so any
 * `card` promotion with `slot: 'announcement'` (or your own slot name) fills
 * it. It sits in the page flow and never interrupts, which makes it the
 * right default for launches on landing pages.
 *
 * ```tsx
 * <PromoPill slot="announcement" className="mb-6" />
 * <h1>…</h1>
 * ```
 */
export function PromoPill({
  slot = 'announcement',
  fallback = null,
  className,
}: {
  slot?: string
  fallback?: React.ReactNode
  className?: string
}) {
  const { card, pathname, report, Link } = usePromotions()
  const promotion = card(slot)
  const onImpression = React.useCallback(
    (p: Promotion) => report('impression', p),
    [report],
  )
  const ref = useImpression(promotion, onImpression, pathname)
  if (!promotion) return <>{fallback}</>

  const inner = (
    <>
      <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold">
        {promotion.eyebrow ?? 'New'}
      </span>
      <span className="min-w-0 truncate">{promotion.title}</span>
      {promotion.cta ? (
        <IconArrowRight
          aria-hidden
          className="text-muted-foreground size-3.5 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/pill:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100"
        />
      ) : null}
    </>
  )
  const classes = cn(
    'group/pill bg-background text-foreground inline-flex max-w-full items-center gap-2 rounded-full border py-1 ps-1 pe-3 text-sm shadow-xs transition-[border-color,transform] duration-150 ease-out forced-colors:border print:hidden',
    promotion.cta &&
      'hover:border-primary/40 active:scale-[0.98] focus-visible:ring-3 focus-visible:ring-ring/50 outline-none',
    className,
  )

  return (
    <span
      ref={ref as React.RefObject<HTMLSpanElement>}
      data-slot="promo-pill"
      className="inline-flex max-w-full"
    >
      {promotion.cta ? (
        <Link
          href={promotion.cta.href}
          className={classes}
          onClick={() => report('click', promotion)}
          {...(promotion.cta.external
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
        >
          {inner}
        </Link>
      ) : (
        <span className={classes}>{inner}</span>
      )}
    </span>
  )
}
