'use client'

import * as React from 'react'
import { IconArrowRight, IconX } from '@tabler/icons-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import type { Promotion } from './promotion'
import {
  useImpression,
  usePromotionLabels,
  usePromotions,
} from './promotion-provider'
import { PromoMedia } from './promo-media'
import { PROMO_EASE_OUT } from './promotion-views'

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
 *
 * With `expandable`, a pill whose record has a body or media opens in place
 * into its card: one shape grows from pill to card (a FLIP layout
 * animation, corners included) while the content crossfades behind a short
 * blur, so it reads as one object changing, not a popup. The visitor asked
 * for it, which is what makes the motion welcome; Escape or the close
 * button folds it back and returns focus to the pill.
 */
export function PromoPill({
  slot = 'announcement',
  fallback = null,
  expandable = false,
  className,
}: {
  slot?: string
  fallback?: React.ReactNode
  /** Open into the full card in place, when there is more to show. */
  expandable?: boolean
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
  if (expandable && (promotion.body || promotion.media))
    return (
      <ExpandablePill
        promotion={promotion}
        impressionRef={ref}
        className={className}
      />
    )

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

/** The pill that grows into its card; see `expandable` on PromoPill. */
function ExpandablePill({
  promotion,
  impressionRef,
  className,
}: {
  promotion: Promotion
  impressionRef: React.RefObject<HTMLElement | null>
  className?: string
}) {
  const { report, Link } = usePromotions()
  const labels = usePromotionLabels()
  const reduce = useReducedMotion()
  const [open, setOpen] = React.useState(false)
  // The focused element leaves the DOM as the shape changes, so focus
  // follows the content both ways: into the card as it opens (Escape then
  // works at once), back to the pill as it returns. Each target focuses
  // itself the moment it mounts, so the handoff never depends on timing.
  const pendingFocus = React.useRef(false)
  const takeFocus = (node: HTMLButtonElement | null) => {
    if (!node || !pendingFocus.current) return
    pendingFocus.current = false
    node.focus({ preventScroll: true })
  }
  const close = () => {
    pendingFocus.current = true
    setOpen(false)
  }
  const spring = reduce
    ? { duration: 0 }
    : { type: 'spring' as const, duration: 0.45, bounce: 0.12 }
  const swap = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, filter: 'blur(4px)' },
        animate: { opacity: 1, filter: 'blur(0px)' },
        exit: { opacity: 0, filter: 'blur(4px)' },
      }

  return (
    <span
      ref={(node) => {
        impressionRef.current = node
      }}
      data-slot="promo-pill"
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'flex max-w-full',
        open ? 'w-full max-w-md' : 'inline-flex',
        className,
      )}
    >
      <motion.div
        layout={!reduce}
        transition={spring}
        // Radius in style, so the layout animation corrects its distortion.
        style={{ borderRadius: open ? 16 : 999 }}
        className={cn(
          'bg-background text-foreground max-w-full overflow-hidden border shadow-xs forced-colors:border print:hidden',
          open && 'w-full shadow-lg',
        )}
        onKeyDown={(event) => {
          if (open && event.key === 'Escape') {
            event.stopPropagation()
            close()
          }
        }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {open ? (
            <motion.div
              key="card"
              {...swap}
              transition={{ duration: 0.22, ease: PROMO_EASE_OUT }}
              className="flex flex-col"
            >
              {promotion.media ? (
                <PromoMedia media={promotion.media} aspect="16 / 10" eager />
              ) : null}
              <div className="flex flex-col gap-1.5 p-4">
                <div className="flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold">
                    {promotion.eyebrow ?? 'New'}
                  </span>
                  <button
                    ref={takeFocus}
                    type="button"
                    aria-label={labels.dismissNamed(promotion.title)}
                    onClick={close}
                    className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 ms-auto grid size-7 place-items-center rounded-md transition-[color,background-color] duration-150 outline-none focus-visible:ring-3"
                  >
                    <IconX aria-hidden className="size-4" />
                  </button>
                </div>
                <p className="[font-family:var(--promo-display,inherit)] font-medium text-balance">
                  {promotion.title}
                </p>
                {promotion.body ? (
                  <p className="text-muted-foreground text-sm text-pretty">
                    {promotion.body}
                  </p>
                ) : null}
                {promotion.cta ? (
                  <Link
                    href={promotion.cta.href}
                    onClick={() => report('click', promotion)}
                    className="text-foreground decoration-foreground/30 hover:decoration-foreground mt-1 inline-flex items-center gap-1 self-start text-sm font-medium underline underline-offset-4 transition-[text-decoration-color] duration-150"
                    {...(promotion.cta.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {promotion.cta.label}
                  </Link>
                ) : null}
              </div>
            </motion.div>
          ) : (
            // popLayout attaches its own ref to its direct child, so the
            // focus target is the button inside, not the animated wrapper.
            <motion.div
              key="pill"
              {...swap}
              transition={{ duration: 0.22, ease: PROMO_EASE_OUT }}
              className="flex max-w-full"
            >
              <button
                ref={takeFocus}
                type="button"
                aria-expanded={false}
                onClick={() => {
                  pendingFocus.current = true
                  setOpen(true)
                }}
                className="group/pill focus-visible:ring-ring/50 inline-flex max-w-full items-center gap-2 py-1 ps-1 pe-3 text-sm outline-none focus-visible:ring-3"
              >
                <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold">
                  {promotion.eyebrow ?? 'New'}
                </span>
                <span className="min-w-0 truncate">{promotion.title}</span>
                <IconArrowRight
                  aria-hidden
                  className="text-muted-foreground size-3.5 shrink-0 rotate-90 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/pill:translate-y-0.5 motion-reduce:transition-none"
                />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </span>
  )
}
