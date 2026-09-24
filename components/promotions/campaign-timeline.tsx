'use client'

import * as React from 'react'
import { IconAlertTriangle } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import {
  deliveryState,
  describeSchedule,
  overlaysCollide,
  type Promotion,
  type PromotionDeliveryState,
  type PromotionPlacement,
} from './promotion'

const DAY = 86_400_000

const PLACEMENT_LABEL: Record<PromotionPlacement, string> = {
  bar: 'Bar',
  card: 'Card',
  corner: 'Corner',
  sheet: 'Side panel',
  dialog: 'Dialog',
}

const STATE_LABEL: Record<PromotionDeliveryState, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  paused: 'Paused',
  ended: 'Ended',
  archived: 'Archived',
}

/* Written out whole so Tailwind sees each class. */
const BAR_CLASS: Record<PromotionDeliveryState, string> = {
  live: 'bg-primary text-primary-foreground',
  scheduled: 'bg-primary/20 text-foreground ring-1 ring-inset ring-primary/40',
  ended: 'bg-muted text-muted-foreground',
  draft: 'border border-dashed border-foreground/30 text-muted-foreground',
  paused:
    'bg-muted/60 text-muted-foreground border border-dashed border-foreground/20',
  archived: 'bg-muted/40 text-muted-foreground',
}

function startOfDay(at: number) {
  const date = new Date(at)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/** Overlays that compete with another for the same days and pages. */
function overlayClashes(promotions: readonly Promotion[]) {
  const clashes = new Set<string>()
  for (const a of promotions)
    for (const b of promotions) if (overlaysCollide(a, b)) clashes.add(a.id)
  return clashes
}

/**
 * Every promotion on one time axis. A reviewer sees what is live now, what is
 * queued, where overlays compete for the same days, and what is left in
 * draft, without opening each record.
 *
 * Rows are buttons when `onSelect` is given, so the timeline doubles as the
 * campaign list. The window defaults to a week back and five weeks ahead.
 */
export function CampaignTimeline({
  promotions,
  now,
  from,
  days = 42,
  selectedId,
  onSelect,
  locale,
  timeZone,
  className,
}: {
  promotions: readonly Promotion[]
  now: number
  from?: number
  days?: number
  selectedId?: string
  onSelect?: (id: string) => void
  locale?: string
  timeZone?: string
  className?: string
}) {
  const start = startOfDay(from ?? now - 7 * DAY)
  const end = start + days * DAY
  const span = end - start
  const pct = (at: number) =>
    Math.min(100, Math.max(0, ((at - start) / span) * 100))
  const clashes = React.useMemo(() => overlayClashes(promotions), [promotions])

  const ticks = React.useMemo(() => {
    const format = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone,
    })
    const list: { at: number; label: string }[] = []
    for (let at = start; at <= end; at += 7 * DAY)
      list.push({ at, label: format.format(at) })
    return list
  }, [start, end, locale, timeZone])

  const sorted = React.useMemo(
    () =>
      promotions.toSorted(
        (a, b) => a.startsAt - b.startsAt || a.title.localeCompare(b.title),
      ),
    [promotions],
  )

  const nowPct = pct(now)
  const nowVisible = now >= start && now <= end

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="min-w-[40rem]">
        <div className="border-border text-muted-foreground grid grid-cols-[14rem_minmax(0,1fr)] border-b pb-2 text-xs">
          <span className="px-3">Promotion</span>
          <div className="relative h-4">
            {ticks.map((tick) => (
              <span
                key={tick.at}
                className={cn(
                  'absolute whitespace-nowrap tabular-nums',
                  pct(tick.at) > 94
                    ? '-translate-x-full'
                    : pct(tick.at) < 6
                      ? 'translate-x-0'
                      : '-translate-x-1/2',
                )}
                style={{ left: `${pct(tick.at)}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="text-muted-foreground px-3 py-8 text-sm">
            No promotions yet.
          </p>
        ) : (
          <ul className="divide-border divide-y">
            {sorted.map((promotion) => {
              const state = deliveryState(promotion, now)
              const left = pct(promotion.startsAt)
              const width = Math.max(1.2, pct(promotion.endsAt) - left)
              const outside =
                promotion.endsAt < start || promotion.startsAt > end
              const clash = clashes.has(promotion.id)
              const selected = promotion.id === selectedId
              const summary = `${promotion.title}. ${PLACEMENT_LABEL[promotion.placement]}, ${STATE_LABEL[state]}. ${describeSchedule(promotion.startsAt, promotion.endsAt, { locale, timeZone })}.${clash ? ' Overlaps another overlay.' : ''}`
              const Row = onSelect ? 'button' : 'div'

              return (
                <li key={promotion.id}>
                  <Row
                    {...(onSelect
                      ? {
                          type: 'button' as const,
                          onClick: () => onSelect(promotion.id),
                          'aria-pressed': selected,
                          'aria-label': summary,
                        }
                      : { 'aria-label': summary })}
                    className={cn(
                      'grid w-full grid-cols-[14rem_minmax(0,1fr)] items-center text-left outline-none',
                      onSelect &&
                        'transition-colors hover:bg-muted/50 focus-visible:bg-muted/60',
                      selected && 'bg-muted/70',
                    )}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
                      <span className="truncate text-sm font-medium">
                        {promotion.title}
                      </span>
                      <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        {PLACEMENT_LABEL[promotion.placement]}
                        <span aria-hidden>·</span>
                        {STATE_LABEL[state]}
                        {clash ? (
                          <IconAlertTriangle
                            aria-hidden
                            className="size-3.5 text-amber-600 dark:text-amber-400"
                          />
                        ) : null}
                      </span>
                    </span>
                    <span className="relative block h-10">
                      {nowVisible ? (
                        <span
                          aria-hidden
                          className="bg-foreground/40 absolute inset-y-0 w-px"
                          style={{ left: `${nowPct}%` }}
                        />
                      ) : null}
                      {outside ? (
                        <span className="text-muted-foreground absolute inset-y-0 left-2 flex items-center text-xs">
                          {promotion.endsAt < start ? '← earlier' : 'later →'}
                        </span>
                      ) : (
                        <span
                          aria-hidden
                          className={cn(
                            'absolute top-1/2 flex h-6 -translate-y-1/2 items-center overflow-hidden rounded-md px-2 text-[11px] font-medium whitespace-nowrap',
                            BAR_CLASS[state],
                            clash &&
                              'outline-2 outline-offset-1 outline-amber-500/70',
                          )}
                          style={{ left: `${left}%`, width: `${width}%` }}
                        >
                          <span className="truncate">{promotion.priority}</span>
                        </span>
                      )}
                    </span>
                  </Row>
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-border text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 pt-2 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-primary h-2 w-4 rounded-sm" /> Live
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-primary/20 ring-primary/40 h-2 w-4 rounded-sm ring-1" />{' '}
            Scheduled
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="border-foreground/30 h-2 w-4 rounded-sm border border-dashed" />{' '}
            Draft or paused
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-foreground/40 h-3 w-px" /> Now
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconAlertTriangle className="size-3.5 text-amber-600 dark:text-amber-400" />
            Overlaps another overlay (priority wins)
          </span>
          <span className="ml-auto">Numbers in bars are priority.</span>
        </div>
      </div>
    </div>
  )
}
