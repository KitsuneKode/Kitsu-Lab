'use client'

import * as React from 'react'
import { Popover } from '@base-ui/react/popover'
import { IconArrowRight, IconGift } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { usePromotions } from './promotion-provider'
import { PromoCode, countdownLabel } from './promotion-views'

/**
 * Every live offer on this page, one per campaign, behind a small gift
 * button you place in your header. It is where a busy week goes: five
 * campaigns become one quiet button with a count, instead of five things
 * competing for attention.
 *
 * Offers the visitor dismissed stay listed (marked as hidden): dismissing
 * stops the interruption, it should not make a discount impossible to find.
 * The popover scales from its trigger, as popovers should.
 */
export function PromoInbox({
  className,
  container,
}: {
  className?: string
  /** Portal target, e.g. a device frame in a demo. */
  container?: HTMLElement | null
}) {
  const { inbox, inboxOpen, setInboxOpen, now, report, labels, Link } =
    usePromotions()
  const fresh = inbox.filter((entry) => !entry.hidden).length

  const reported = React.useRef(new Set<string>())
  React.useEffect(() => {
    if (!inboxOpen) return
    for (const { promotion } of inbox) {
      if (reported.current.has(promotion.id)) continue
      reported.current.add(promotion.id)
      report('impression', promotion)
    }
  }, [inboxOpen, inbox, report])

  if (inbox.length === 0) return null

  return (
    <Popover.Root open={inboxOpen} onOpenChange={setInboxOpen}>
      <Popover.Trigger
        data-slot="promo-inbox-trigger"
        aria-label={labels.inboxCount(inbox.length)}
        className={cn(
          'hover:bg-muted text-foreground relative grid size-8 place-items-center rounded-lg transition-[background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] data-popup-open:bg-muted print:hidden',
          className,
        )}
      >
        <IconGift aria-hidden className="size-[1.125rem]" />
        {fresh > 0 ? (
          <span
            aria-hidden
            className="bg-primary text-primary-foreground ring-background absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums ring-2"
          >
            {fresh}
          </span>
        ) : null}
      </Popover.Trigger>
      <Popover.Portal container={container}>
        <Popover.Positioner sideOffset={8} align="end" className="z-50">
          <Popover.Popup
            data-slot="promo-inbox"
            className="bg-popover text-popover-foreground w-[min(22rem,calc(100vw-1.5rem))] origin-[var(--transform-origin)] rounded-[calc(var(--promo-radius,0.75rem)+0.25rem)] p-1.5 text-sm shadow-xl ring-1 ring-black/5 transition-[scale,opacity] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-100 data-starting-style:scale-[0.96] data-starting-style:opacity-0 motion-reduce:transition-opacity dark:ring-white/10"
          >
            <Popover.Title className="text-muted-foreground px-2.5 pt-1.5 pb-1 text-xs font-medium">
              {labels.inboxCount(inbox.length)}
            </Popover.Title>
            <ul className="flex max-h-[min(24rem,60dvh)] flex-col overflow-y-auto overscroll-contain">
              {inbox.map(({ promotion, hidden }) => {
                const ends = countdownLabel(promotion, now, labels)
                return (
                  <li
                    key={promotion.id}
                    className={cn(
                      'flex flex-col gap-1.5 rounded-lg px-2.5 py-2',
                      hidden && 'opacity-70',
                    )}
                  >
                    <div className="text-muted-foreground flex items-center gap-2 text-xs">
                      {promotion.eyebrow ? (
                        <span className="truncate font-medium">
                          {promotion.eyebrow}
                        </span>
                      ) : null}
                      {ends ? (
                        <span className="tabular-nums">· {ends}</span>
                      ) : null}
                      {hidden ? (
                        <span className="ms-auto shrink-0">
                          {labels.inboxHidden}
                        </span>
                      ) : null}
                    </div>
                    <p className="[font-family:var(--promo-display,inherit)] leading-snug font-medium text-balance">
                      {promotion.title}
                    </p>
                    {promotion.code || promotion.cta ? (
                      <div className="flex flex-wrap items-center gap-2">
                        {promotion.code ? (
                          <PromoCode
                            code={promotion.code}
                            reveal={promotion.revealCode}
                            onReveal={() => report('reveal', promotion)}
                            onCopy={() => report('copy', promotion)}
                          />
                        ) : null}
                        {promotion.cta ? (
                          <Link
                            href={promotion.cta.href}
                            onClick={() => {
                              report('click', promotion)
                              setInboxOpen(false)
                            }}
                            className="group/cta text-primary inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
                            {...(promotion.cta.external
                              ? { target: '_blank', rel: 'noopener noreferrer' }
                              : {})}
                          >
                            {promotion.cta.label}
                            <IconArrowRight
                              aria-hidden
                              className="size-3.5 transition-transform duration-200 ease-out group-hover/cta:translate-x-0.5 rtl:-scale-x-100"
                            />
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
