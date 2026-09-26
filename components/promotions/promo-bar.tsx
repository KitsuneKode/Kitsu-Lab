'use client'

import * as React from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import type { Promotion } from './promotion'
import {
  moveFocusPast,
  useImpression,
  usePromotions,
} from './promotion-provider'
import {
  PROMO_EASE_OUT,
  PromoBarView,
  type PromoBarVariant,
} from './promotion-views'

/**
 * The announcement bar.
 *
 * `inline` (default) renders nothing until a live, undismissed promotion
 * exists, then opens with a height transition (opacity only under reduced
 * motion). Place it above your header. Because it only knows what to show
 * after hydration, it adds one small layout shift on arrival; if that matters
 * for your Core Web Vitals, use `floating`, which docks to the bottom of the
 * viewport and never moves content.
 */
export function PromoBar({
  className,
  dismissible = true,
  variant = 'inline',
}: {
  className?: string
  dismissible?: boolean
  variant?: PromoBarVariant
}) {
  const { bar, now, pathname, dismiss, report, Link } = usePromotions()
  const reduce = useReducedMotion()
  const [shown, setShown] = React.useState<Promotion | null>(null)

  // Keep the last promotion mounted while the bar closes, so it animates out
  // with its content rather than collapsing empty.
  if (bar && bar !== shown) setShown(bar)

  const onImpression = React.useCallback(
    (p: Promotion) => report('impression', p),
    [report],
  )
  const ref = useImpression(bar, onImpression, pathname)
  const open = Boolean(bar)

  const handlers = (promotion: Promotion) => ({
    onClick: () => report('click', promotion),
    onCopy: () => report('copy', promotion),
    onDismiss: dismissible
      ? () => {
          moveFocusPast(ref.current)
          dismiss(promotion)
        }
      : undefined,
  })

  if (variant === 'floating') {
    return (
      <div
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] print:hidden',
          className,
        )}
      >
        <AnimatePresence>
          {bar ? (
            <motion.div
              key={bar.id}
              ref={ref as React.RefObject<HTMLDivElement>}
              data-slot="promo-bar"
              data-variant="floating"
              initial={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, transform: 'translateY(16px) scale(0.98)' }
              }
              animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
              exit={
                reduce
                  ? { opacity: 0 }
                  : { opacity: 0, transform: 'translateY(8px) scale(0.98)' }
              }
              transition={{ duration: 0.28, ease: PROMO_EASE_OUT }}
              className="pointer-events-auto w-full max-w-2xl sm:w-auto"
            >
              <PromoBarView
                promotion={bar}
                now={now}
                Link={Link}
                variant="floating"
                {...handlers(bar)}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-slot="promo-bar"
      data-state={open ? 'open' : 'closed'}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity print:hidden',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
    >
      <div className="overflow-hidden">
        {shown ? (
          <PromoBarView
            promotion={shown}
            now={now}
            Link={Link}
            {...handlers(shown)}
          />
        ) : null}
      </div>
    </div>
  )
}
