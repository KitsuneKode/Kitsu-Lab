'use client'

import { PromoCorner } from './promo-corner'
import { PromoDialog } from './promo-dialog'
import { PromoSheet } from './promo-sheet'

/**
 * Every overlay placement in one element. The provider allows at most one to
 * open at a time, so mounting all three costs nothing and lets an editor pick
 * any placement without touching the layout.
 */
export function PromoOverlays({
  side = 'right',
  locale,
  cornerClassName,
}: {
  side?: 'left' | 'right'
  locale?: string
  /** Lift the corner card above a bottom bar, e.g. `bottom-20 md:bottom-6`. */
  cornerClassName?: string
}) {
  return (
    <>
      <PromoCorner side={side} locale={locale} className={cornerClassName} />
      <PromoSheet side={side} locale={locale} />
      <PromoDialog locale={locale} />
    </>
  )
}
