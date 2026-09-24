'use client'

import * as React from 'react'
import { IconDeviceDesktop, IconDeviceMobile } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import {
  deliveryState,
  describeSchedule,
  targetsRoute,
  type PromotionDeliveryState,
} from './promotion'
import {
  PromoBarView,
  PromoCardView,
  PromoCornerView,
  PromoOverlayContent,
  type PreviewablePromotion,
} from './promotion-views'

export type PreviewDevice = 'desktop' | 'phone'

const STATE_COPY: Record<PromotionDeliveryState, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  live: 'Live',
  paused: 'Paused',
  ended: 'Ended',
  archived: 'Archived',
}

const DEVICE_SIZE: Record<PreviewDevice, { width: number; height: number }> = {
  desktop: { width: 1280, height: 800 },
  phone: { width: 390, height: 780 },
}

function useElementWidth<T extends HTMLElement>() {
  const ref = React.useRef<T | null>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * Renders its children at a real device size (1280×800 or 390×780) and
 * scales the result to fit. Proportions, breakpoints and container queries
 * then behave exactly as on the site, instead of as on a squeezed panel.
 */
function ScaledFrame({
  device,
  children,
}: {
  device: PreviewDevice
  children: React.ReactNode
}) {
  const [ref, available] = useElementWidth<HTMLDivElement>()
  const size = DEVICE_SIZE[device]
  const phone = device === 'phone'
  const scale = available > 0 ? available / size.width : phone ? 0.8 : 0.45
  return (
    <div ref={ref} className={cn('mx-auto w-full', phone && 'max-w-[19rem]')}>
      <div
        className={cn(
          'relative overflow-hidden bg-background ring-1 ring-foreground/10',
          phone ? 'rounded-[1.75rem] ring-4' : 'rounded-xl',
        )}
        style={{ height: size.height * scale }}
      >
        <div
          className="bg-background text-foreground absolute top-0 left-0 origin-top-left"
          style={{
            width: size.width,
            height: size.height,
            transform: `scale(${scale})`,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/** Grey blocks standing in for a real page, so position reads at a glance. */
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('rounded-md bg-foreground/[0.07]', className)} />
}

function MockPage({
  device,
  card,
}: {
  device: PreviewDevice
  card: React.ReactNode
}) {
  const phone = device === 'phone'
  return (
    <div className={cn('flex flex-col gap-6', phone ? 'p-4' : 'p-8')}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-5 w-20" />
        {phone ? (
          <Skeleton className="size-5" />
        ) : (
          <div className="flex gap-3">
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        )}
      </div>
      <div className={cn('grid gap-3', phone ? 'pt-2' : 'max-w-xl pt-4')}>
        <Skeleton className={cn(phone ? 'h-6 w-11/12' : 'h-8 w-full')} />
        <Skeleton className={cn(phone ? 'h-6 w-3/5' : 'h-8 w-2/3')} />
        <Skeleton className="mt-1 h-3 w-4/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="mt-2 h-9 w-32 rounded-lg" />
      </div>
      {card ? <div className="@container">{card}</div> : null}
      <div className={cn('grid gap-3', phone ? 'grid-cols-1' : 'grid-cols-3')}>
        {Array.from({ length: phone ? 2 : 3 }, (_, index) => (
          <div
            key={index}
            className="ring-foreground/5 grid gap-2 rounded-xl p-3 ring-1"
          >
            <Skeleton className="aspect-[16/10] w-full" />
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The promotion on a mock page, in the place it will actually appear: the bar
 * above the header, a card in its slot, a corner card floating bottom right,
 * a sheet from the side (from the bottom on a phone), a dialog over a dimmed
 * page. Reviewers see position and weight, not just the component.
 *
 * It also says plainly whether the promotion would show at the preview time
 * on the preview page, and why not.
 */
export function PromotionPreview({
  promotion,
  now,
  pathname = '/',
  device,
  onDeviceChange,
  locale,
  timeZone,
  className,
}: {
  promotion: PreviewablePromotion
  now: number
  pathname?: string
  device?: PreviewDevice
  onDeviceChange?: (device: PreviewDevice) => void
  locale?: string
  timeZone?: string
  className?: string
}) {
  const [ownDevice, setOwnDevice] = React.useState<PreviewDevice>('desktop')
  const current = device ?? ownDevice
  const setDevice = (next: PreviewDevice) => {
    if (device === undefined) setOwnDevice(next)
    onDeviceChange?.(next)
  }
  const phone = current === 'phone'

  const state = deliveryState(
    {
      state: 'published',
      startsAt: promotion.startsAt,
      endsAt: promotion.endsAt,
    },
    now,
  )
  const onPage = targetsRoute(promotion, pathname)
  const showing = state === 'live' && onPage
  const reason = !onPage
    ? `Not shown on ${pathname}`
    : state === 'scheduled'
      ? 'Not started yet'
      : state === 'ended'
        ? 'Already ended'
        : null

  const views = { promotion, now, locale, onDismiss: () => {} }
  const placement = promotion.placement

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Preview device"
          className="bg-muted inline-flex rounded-lg p-0.5"
        >
          {(
            [
              ['desktop', 'Desktop', IconDeviceDesktop],
              ['phone', 'Phone', IconDeviceMobile],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={current === value}
              onClick={() => setDevice(value)}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                current === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon aria-hidden className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
        <span
          className={cn(
            'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium',
            showing
              ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400'
              : 'bg-muted text-muted-foreground',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'size-1.5 rounded-full',
              showing ? 'bg-emerald-500' : 'bg-muted-foreground/60',
            )}
          />
          {showing ? 'Showing' : STATE_COPY[state]}
          {reason && state === 'live' ? ` · ${reason}` : ''}
        </span>
      </div>

      <ScaledFrame device={current}>
        {!phone ? (
          <div className="border-foreground/5 bg-muted/50 flex h-10 items-center gap-2 border-b px-4">
            <span className="bg-foreground/15 size-3 rounded-full" />
            <span className="bg-foreground/15 size-3 rounded-full" />
            <span className="bg-foreground/15 size-3 rounded-full" />
            <span className="bg-background/70 text-muted-foreground ml-4 truncate rounded-md px-3 py-1 font-mono text-xs">
              {pathname}
            </span>
          </div>
        ) : null}

        <div
          className={cn(
            'absolute inset-x-0 bottom-0 overflow-hidden',
            phone ? 'top-0' : 'top-10',
            !showing && 'opacity-45 saturate-50',
          )}
        >
          <div className="h-full overflow-hidden">
            {placement === 'bar' ? <PromoBarView {...views} /> : null}
            <MockPage
              device={current}
              card={placement === 'card' ? <PromoCardView {...views} /> : null}
            />
          </div>

          {placement === 'corner' ? (
            <div
              className={cn(
                'absolute',
                phone ? 'right-4 bottom-4' : 'right-6 bottom-6',
              )}
            >
              <PromoCornerView {...views} />
            </div>
          ) : null}

          {placement === 'sheet' || placement === 'dialog' ? (
            <div aria-hidden className="absolute inset-0 bg-black/30" />
          ) : null}

          {placement === 'sheet' ? (
            <div
              className={cn(
                'absolute bg-popover text-popover-foreground shadow-2xl',
                phone
                  ? 'inset-x-0 bottom-0 max-h-[88%] overflow-hidden rounded-t-2xl'
                  : 'inset-y-0 right-0 w-[28rem] border-l border-foreground/10',
              )}
            >
              <PromoOverlayContent {...views} layout="panel" />
            </div>
          ) : null}

          {placement === 'dialog' ? (
            phone ? (
              <div className="bg-popover text-popover-foreground absolute inset-x-0 bottom-0 max-h-[88%] overflow-hidden rounded-t-2xl shadow-2xl">
                <PromoOverlayContent {...views} />
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center p-8">
                <div className="bg-popover text-popover-foreground ring-foreground/10 max-h-full w-[28rem] overflow-hidden rounded-xl shadow-2xl ring-1">
                  <PromoOverlayContent {...views} />
                </div>
              </div>
            )
          ) : null}
        </div>

        {reason ? (
          <div
            data-slot="preview-reason"
            className="bg-foreground text-background absolute inset-x-4 bottom-4 rounded-lg px-4 py-3 text-sm shadow-lg"
          >
            <span className="font-medium">{reason}.</span>{' '}
            <span className="opacity-75">
              {describeSchedule(promotion.startsAt, promotion.endsAt, {
                timeZone,
                locale,
              })}
            </span>
          </div>
        ) : null}
      </ScaledFrame>
    </div>
  )
}
