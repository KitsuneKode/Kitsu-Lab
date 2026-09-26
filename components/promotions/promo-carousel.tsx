'use client'

import * as React from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import type { Promotion } from './promotion'
import {
  moveFocusPast,
  useImpression,
  usePromotions,
} from './promotion-provider'
import { PromoCardView } from './promotion-views'

/** One card in the carousel; registers its node for paging and reports its own impression, clicks and copies. */
function Slide({
  promotion,
  dismissible,
  register,
  cardClassName,
  index,
  count,
}: {
  promotion: Promotion
  dismissible: boolean
  register: (node: HTMLDivElement | null) => void
  cardClassName?: string
  index: number
  count: number
}) {
  const { now, pathname, dismiss, report, Link } = usePromotions()
  const onImpression = React.useCallback(
    (p: Promotion) => report('impression', p),
    [report],
  )
  // Each campaign is counted only when its own slide is actually seen.
  const ref = useImpression(promotion, onImpression, pathname)
  return (
    <div
      ref={(node) => {
        ref.current = node
        register(node)
      }}
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} / ${count}`}
      data-slot="promo-carousel-slide"
      className="w-[min(100%,34rem)] shrink-0 snap-start"
    >
      <PromoCardView
        promotion={promotion}
        now={now}
        Link={Link}
        className={cn('h-full', cardClassName)}
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
    </div>
  )
}

/**
 * Several campaigns sharing one slot, as a row of cards the visitor can
 * swipe through. The next card peeks in from the edge, which says "there is
 * more" without dots, arrows or motion. It never auto-advances.
 *
 * With one live card it renders just that card, so the same slot works for
 * quiet weeks and busy ones.
 */
export function PromoCarousel({
  slot = 'default',
  dismissible = false,
  fallback = null,
  label = 'Offers',
  className,
  cardClassName,
}: {
  slot?: string
  dismissible?: boolean
  fallback?: React.ReactNode
  label?: string
  className?: string
  cardClassName?: string
}) {
  const { cards } = usePromotions()
  const reduce = useReducedMotion()
  const promotions = cards(slot)
  const scroller = React.useRef<HTMLDivElement>(null)
  const slides = React.useRef<(HTMLDivElement | null)[]>([])
  const [edge, setEdge] = React.useState({ start: true, end: false })

  const update = React.useCallback(() => {
    const el = scroller.current
    if (!el) return
    // scrollLeft is negative in RTL; the magnitude is what matters.
    const left = Math.abs(el.scrollLeft)
    setEdge({
      start: left < 4,
      end: left + el.clientWidth >= el.scrollWidth - 4,
    })
  }, [])
  React.useEffect(update, [update, promotions.length])

  if (promotions.length === 0) return <>{fallback}</>

  const step = (direction: 1 | -1) => {
    const el = scroller.current
    const first = slides.current[0]
    if (!el || !first) return
    const rtl = getComputedStyle(el).direction === 'rtl'
    const width = first.getBoundingClientRect().width + 12
    el.scrollBy({
      left: width * direction * (rtl ? -1 : 1),
      behavior: reduce ? 'auto' : 'smooth',
    })
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      data-slot="promo-carousel"
      data-promo-slot={slot}
      className={cn('flex flex-col gap-2 print:hidden', className)}
    >
      {promotions.length > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs font-medium tabular-nums">
            {promotions.length} {label.toLowerCase()}
          </span>
          <div className="flex gap-1">
            {([-1, 1] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                aria-label={direction === -1 ? 'Previous' : 'Next'}
                disabled={direction === -1 ? edge.start : edge.end}
                onClick={() => step(direction)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring/50 grid size-7 place-items-center rounded-md transition-[color,background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-35"
              >
                {direction === -1 ? (
                  <IconChevronLeft
                    aria-hidden
                    className="size-4 rtl:-scale-x-100"
                  />
                ) : (
                  <IconChevronRight
                    aria-hidden
                    className="size-4 rtl:-scale-x-100"
                  />
                )}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <div
        ref={scroller}
        onScroll={update}
        className={cn(
          'flex gap-3 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          promotions.length > 1 && 'snap-x snap-mandatory pe-10',
          // Fade the far edge while more cards wait there, so the peek reads
          // as "more" rather than as a card cut off by mistake.
          promotions.length > 1 &&
            !edge.end &&
            '[mask-image:linear-gradient(to_right,black_78%,transparent)] rtl:[mask-image:linear-gradient(to_left,black_78%,transparent)]',
        )}
      >
        {promotions.map((promotion, index) => (
          <Slide
            key={promotion.id}
            promotion={promotion}
            dismissible={dismissible}
            cardClassName={cardClassName}
            index={index}
            count={promotions.length}
            register={(node) => {
              slides.current[index] = node
            }}
          />
        ))}
      </div>
    </section>
  )
}
