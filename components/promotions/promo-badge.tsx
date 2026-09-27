'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

import { usePromotions } from './promotion-provider'

/**
 * The quietest placement: a small "New" pill (or dot) beside a nav item,
 * shown only while a live promotion on this route points its button at
 * `href`. It needs no record of its own and disappears with the campaign.
 *
 * ```tsx
 * <Link href="/books">Books <PromoBadge href="/books" /></Link>
 * ```
 *
 * The label reads the promotion's eyebrow, so "Just printed" can replace
 * "New". Nothing pulses: a nav is seen constantly, and motion there nags.
 */
export function PromoBadge({
  href,
  label,
  variant = 'pill',
  className,
}: {
  href: string
  /** Overrides the promotion's eyebrow. */
  label?: string
  variant?: 'pill' | 'dot'
  className?: string
}) {
  const { pointingAt } = usePromotions()
  const promotion = pointingAt(href)
  if (!promotion) return null
  const text = label ?? promotion.eyebrow ?? 'New'

  if (variant === 'dot') {
    return (
      <span
        data-slot="promo-badge"
        className={cn(
          'bg-primary inline-block size-1.5 shrink-0 rounded-full align-middle forced-colors:bg-[Highlight]',
          className,
        )}
      >
        <span className="sr-only">{text}</span>
      </span>
    )
  }
  return (
    <span
      data-slot="promo-badge"
      className={cn(
        'bg-primary/10 text-primary ring-primary/20 inline-flex h-5 shrink-0 items-center rounded-full px-1.5 align-middle text-[0.6875rem] font-medium ring-1 ring-inset forced-colors:border',
        className,
      )}
    >
      {text}
    </span>
  )
}
