'use client'

import * as React from 'react'
import { IconSparkles, IconX } from '@tabler/icons-react'
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from 'motion/react'
import { cn } from '@/lib/utils'

import type { Promotion } from './promotion'
import { usePromotions } from './promotion-provider'
import { PROMO_EASE_OUT, PromoToastView } from './promotion-views'

/** A flick is enough: distance or speed, whichever comes first. */
const SWIPE_DISTANCE = 96
const SWIPE_VELOCITY = 450

/**
 * The polite popup. A small card slides into the bottom corner (full width
 * above the home indicator on phones) after light engagement. It never takes
 * focus, never blocks the page and never dims anything.
 *
 * Visitors have three ways out, each with a different meaning:
 * - **Minimise** folds it into a chip that follows them for the visit.
 * - **Dismiss** (X, Escape while focused, or a sideways swipe) honours the
 *   promotion's dismissal rule.
 * - **The button** completes it; that is a conversion, not a dismissal.
 */
export function PromoToast({
  className,
  side = 'end',
}: {
  className?: string
  /** Which bottom corner on wide screens. Follows reading direction. */
  side?: 'start' | 'end'
}) {
  const {
    toast,
    toastMinimized,
    now,
    dismiss,
    complete,
    minimize,
    restore,
    markShown,
    report,
    labels,
    Link,
    bottomInset,
  } = usePromotions()
  const reduce = useReducedMotion()
  const [exitX, setExitX] = React.useState(0)

  const expanded = toast && !toastMinimized ? toast : null
  React.useEffect(() => {
    if (expanded) markShown(expanded)
  }, [expanded, markShown])

  const onDragEnd = (promotion: Promotion, info: PanInfo) => {
    const { x } = info.offset
    if (
      Math.abs(x) > SWIPE_DISTANCE ||
      Math.abs(info.velocity.x) > SWIPE_VELOCITY
    ) {
      setExitX(Math.sign(x || info.velocity.x) * 420)
      dismiss(promotion)
    }
  }

  // Independent x/y/scale here, not a transform string: the swipe drives x,
  // and a transform string would override it.
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }

  return (
    <div
      data-slot="promo-toast-viewport"
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 print:hidden',
        side === 'end' ? 'justify-end' : 'justify-start',
        'transition-transform duration-250 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
        className,
      )}
      // Sit above a docked sticky CTA instead of on top of it.
      style={
        bottomInset ? { transform: `translateY(-${bottomInset}px)` } : undefined
      }
    >
      <AnimatePresence mode="popLayout" custom={exitX}>
        {expanded ? (
          <motion.section
            key={`${expanded.id}-open`}
            aria-label={expanded.eyebrow ?? labels.announcement}
            data-slot="promo-toast"
            drag={reduce ? false : 'x'}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            dragSnapToOrigin
            onDragEnd={(_, info) => onDragEnd(expanded, info)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') dismiss(expanded)
            }}
            initial={hidden}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={
              exitX !== 0
                ? { opacity: 0, x: exitX, transition: { duration: 0.2 } }
                : hidden
            }
            transition={{ duration: 0.3, ease: PROMO_EASE_OUT }}
            style={{
              transformOrigin: side === 'end' ? 'bottom right' : 'bottom left',
            }}
            className="pointer-events-auto w-full touch-pan-y sm:w-[22rem]"
          >
            <PromoToastView
              promotion={expanded}
              now={now}
              Link={Link}
              onClick={() => {
                report('click', expanded)
                complete(expanded)
              }}
              onCopy={() => report('copy', expanded)}
              onDismiss={() => dismiss(expanded)}
              onMinimize={() => minimize(expanded)}
            />
          </motion.section>
        ) : toast ? (
          <motion.div
            key={`${toast.id}-chip`}
            data-slot="promo-toast-chip"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2, ease: PROMO_EASE_OUT }}
            style={{
              transformOrigin: side === 'end' ? 'bottom right' : 'bottom left',
            }}
            className="bg-popover text-popover-foreground pointer-events-auto flex items-center rounded-full shadow-lg ring-1 shadow-black/10 ring-black/5 dark:ring-white/10"
          >
            <button
              type="button"
              onClick={() => restore(toast)}
              aria-label={labels.restore(toast.title)}
              className="focus-visible:ring-ring/50 flex h-9 max-w-[14rem] items-center gap-2 rounded-full ps-3 pe-2 text-sm font-medium transition-transform duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.97]"
            >
              <IconSparkles aria-hidden className="size-4 shrink-0" />
              <span className="truncate">{toast.eyebrow ?? toast.title}</span>
            </button>
            <button
              type="button"
              onClick={() => dismiss(toast)}
              aria-label={labels.dismissNamed(toast.title)}
              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 me-1 grid size-7 place-items-center rounded-full transition-colors outline-none focus-visible:ring-3"
            >
              <IconX aria-hidden className="size-3.5" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
