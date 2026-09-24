'use client'

import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'

import type { Promotion } from './promotion'
import {
  moveFocusPast,
  useImpression,
  usePromotions,
} from './promotion-provider'
import { PROMO_EASE_OUT, PromoCardView } from './promotion-views'

/**
 * An inline promotion for a named slot, e.g. `<PromoCard slot="hero" />`.
 * Renders `fallback` (nothing by default) when no promotion fills the slot, so
 * the surrounding layout decides what an empty slot looks like. A dismissed
 * card folds away instead of vanishing, so the content below never jumps.
 *
 * The card lays itself out from its own width (container queries), so the
 * same slot works in a sidebar, a hero or a full-width band.
 */
export function PromoCard({
  slot = 'default',
  fallback = null,
  dismissible = false,
  className,
}: {
  slot?: string
  fallback?: React.ReactNode
  dismissible?: boolean
  className?: string
}) {
  const { card, now, pathname, dismiss, report, Link } = usePromotions()
  const reduce = useReducedMotion()
  const promotion = card(slot)

  const onImpression = React.useCallback(
    (p: Promotion) => report('impression', p),
    [report],
  )
  const ref = useImpression(promotion, onImpression, pathname)

  return (
    <>
      <AnimatePresence initial={false}>
        {promotion ? (
          <motion.div
            key={promotion.id}
            ref={ref as React.RefObject<HTMLDivElement>}
            data-slot="promo-card"
            data-promo-slot={slot}
            className="overflow-hidden print:hidden"
            exit={
              reduce
                ? { opacity: 0, transition: { duration: 0.15 } }
                : {
                    opacity: 0,
                    height: 0,
                    transition: { duration: 0.25, ease: PROMO_EASE_OUT },
                  }
            }
          >
            <PromoCardView
              promotion={promotion}
              now={now}
              Link={Link}
              className={className}
              onClick={() => report('click', promotion)}
              onCopy={() => report('copy', promotion)}
              onDismiss={
                dismissible
                  ? () => {
                      moveFocusPast(ref.current)
                      dismiss(promotion)
                    }
                  : undefined
              }
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
      {promotion ? null : fallback}
    </>
  )
}
