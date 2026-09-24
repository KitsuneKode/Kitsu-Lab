'use client'

import * as React from 'react'
import {
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconMenu2,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  PromoBadge,
  PromoBar,
  PromoCard,
  PromoDialog,
  PromoToast,
  PromotionProvider,
  deliveryState,
  usePromotions,
  type DismissalStore,
  type Promotion,
  type PromotionEvent,
  type PromotionLinkProps,
} from '@/components/promotions'
import { PromotionEditor } from '@/components/promotions/promotion-editor'

const HOUR = 3_600_000
const DAY = 24 * HOUR

const PAGES = [
  { value: '/', label: 'Home' },
  { value: '/courses', label: 'Courses' },
  { value: '/courses/night-batch', label: 'A course' },
  { value: '/books', label: 'Books' },
  { value: '/checkout', label: 'Checkout' },
] as const

const EDITOR_ROUTES: { value: string; label: string }[] = [
  ...PAGES,
  { value: '/courses/*', label: 'Every course' },
  { value: '/courses/**', label: 'Courses and every course' },
]

const TARGETS = [
  { value: '/courses', label: 'Courses page' },
  { value: '/courses/night-batch', label: 'Night batch' },
  { value: '/books', label: 'Books' },
  { value: 'https://wa.me/910000000000', label: 'WhatsApp (external)' },
]

const DEVICES = {
  wide: {
    label: 'Desktop',
    icon: IconDeviceDesktop,
    width: '100%',
    height: 620,
  },
  laptop: {
    label: 'Laptop',
    icon: IconDeviceLaptop,
    width: '52rem',
    height: 560,
  },
  phone: {
    label: 'Phone',
    icon: IconDeviceMobile,
    width: '24.375rem',
    height: 700,
  },
} as const
type Device = keyof typeof DEVICES

function seed(base: number): Promotion[] {
  return [
    {
      id: 'night-batch',
      state: 'published',
      placement: 'bar',
      eyebrow: 'New batch',
      title: 'The night batch starts Monday',
      body: '8 to 10 PM, for people who work days.',
      cta: { label: 'See timings', href: '/courses/night-batch' },
      tone: 'brand',
      include: [],
      exclude: ['/checkout'],
      startsAt: base - DAY,
      endsAt: base + 5 * DAY,
      priority: 60,
      dismiss: { mode: 'days', days: 3 },
      dismissalVersion: 1,
      showCountdown: true,
      campaign: 'night-batch-sep',
      revision: 1,
    },
    {
      id: 'mock-series',
      state: 'published',
      placement: 'card',
      slot: 'hero',
      eyebrow: 'Test series',
      title: '20 prelims mocks, reviewed by the faculty who set them',
      body: 'Every paper is discussed in class the following week.',
      cta: { label: 'View the series', href: '/courses' },
      tone: 'highlight',
      include: ['/', '/courses'],
      exclude: [],
      startsAt: base - 2 * DAY,
      endsAt: base + 20 * DAY,
      priority: 50,
      dismiss: { mode: 'session' },
      dismissalVersion: 1,
      revision: 1,
    },
    {
      id: 'early-bird',
      state: 'published',
      placement: 'toast',
      eyebrow: 'Early bird',
      title: '20% off the night batch until Friday',
      body: 'Use the code at checkout. Seats are capped at 40.',
      code: 'EARLY20',
      cta: { label: 'Enrol', href: '/courses/night-batch' },
      tone: 'brand',
      include: ['/courses/**'],
      exclude: [],
      startsAt: base - DAY,
      endsAt: base + 4 * DAY,
      priority: 70,
      dismiss: { mode: 'days', days: 2 },
      dismissalVersion: 1,
      showCountdown: true,
      campaign: 'early-bird-sep',
      revision: 1,
    },
    {
      id: 'books-launch',
      state: 'published',
      placement: 'dialog',
      eyebrow: 'Just printed',
      title: 'Our Assam GK book is here',
      body: 'Printed notes from the classroom, shipped anywhere in Assam or collected at the centre.',
      media: {
        src: '/sample-pages/page-1.svg',
        alt: 'The first page of the Assam GK book',
        width: 1600,
        height: 900,
      },
      cta: { label: 'Look inside', href: '/books' },
      tone: 'neutral',
      include: ['/courses/**'],
      exclude: [],
      startsAt: base + 2 * DAY,
      endsAt: base + 9 * DAY,
      priority: 80,
      dismiss: { mode: 'never-again' },
      dismissalVersion: 1,
      revision: 1,
    },
  ]
}

function memoryStore(): DismissalStore & { clear: () => void } {
  const map = new Map<string, number>()
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, at) => void map.set(key, at),
    clear: () => map.clear(),
  }
}

/** Keeps the demo on one page: CTAs log a click instead of navigating. */
function DemoLink({ href, className, children, onClick }: PromotionLinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        event.preventDefault()
        onClick?.()
      }}
    >
      {children}
    </a>
  )
}

function Label({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <span id={id} className="text-muted-foreground text-xs font-medium">
      {children}
    </span>
  )
}

/** Manual triggers, the same `openPromotion` a host would wire to a button. */
function Triggers() {
  const { selection, openPromotion } = usePromotions()
  const floating = [selection.toast, selection.dialog].filter(
    (p): p is Promotion => Boolean(p),
  )
  if (floating.length === 0)
    return (
      <p className="text-muted-foreground text-xs">
        No toast or dialog is live on this page.
      </p>
    )
  return (
    <div className="flex flex-wrap gap-1.5">
      {floating.map((promotion) => (
        <Button
          key={promotion.id}
          size="sm"
          variant="outline"
          onClick={() => openPromotion(promotion.id)}
        >
          Open {promotion.placement} now
        </Button>
      ))}
    </div>
  )
}

/** A believable page for the promotions to live on. */
function MockSite({ pathname, phone }: { pathname: string; phone: boolean }) {
  const quiet = pathname === '/checkout'
  return (
    <>
      <PromoBar />
      <header className="border-border/60 flex items-center gap-6 border-b px-5 py-3">
        <span className="font-medium tracking-tight">Impact Tutorials</span>
        {phone ? (
          <IconMenu2
            aria-hidden
            className="text-muted-foreground ms-auto size-5"
          />
        ) : (
          <nav
            aria-label="Mock site"
            className="text-muted-foreground ms-auto flex items-center gap-5 text-sm"
          >
            <span>Courses</span>
            <span className="inline-flex items-center gap-1.5">
              Books <PromoBadge href="/books" />
            </span>
            <span className="inline-flex items-center gap-1.5">
              Night batch{' '}
              <PromoBadge href="/courses/night-batch" variant="dot" />
            </span>
          </nav>
        )}
      </header>
      <main className="flex flex-col gap-6 p-5 sm:p-8">
        <p className="text-muted-foreground font-mono text-xs">{pathname}</p>
        <h2
          className={cn(
            'max-w-lg font-medium tracking-tight text-balance',
            phone ? 'text-2xl' : 'text-3xl',
          )}
        >
          {quiet
            ? 'Checkout stays quiet.'
            : 'A calm page that can still announce things.'}
        </h2>
        <p className="text-muted-foreground max-w-lg text-sm">
          Drag the clock to watch promotions open and close on schedule. Switch
          pages to see targeting, and devices to see each surface adapt.
        </p>
        <PromoCard slot="hero" dismissible className="max-w-2xl" />
        <div className={cn('grid gap-3', !phone && 'grid-cols-3')}>
          {['Prelims', 'Mains', 'Interview'].map((name) => (
            <div key={name} className="border-border/60 rounded-xl border p-4">
              <p className="font-medium">{name}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Weekly classes, notes and a doubt hour.
              </p>
            </div>
          ))}
        </div>
        <div className="bg-muted/40 h-64 rounded-xl" aria-hidden />
      </main>
    </>
  )
}

export function PromotionsDemo() {
  const [base] = React.useState(() => Math.floor(Date.now() / HOUR) * HOUR)
  const [records, setRecords] = React.useState<Promotion[]>(() => seed(base))
  const [pathname, setPathname] = React.useState<string>('/courses')
  const [offsetHours, setOffsetHours] = React.useState(0)
  const [device, setDevice] = React.useState<Device>('wide')
  const [events, setEvents] = React.useState<
    (PromotionEvent & { seq: number })[]
  >([])
  const seq = React.useRef(0)
  const [view, setView] = React.useState<'site' | 'editor'>('site')
  const [store] = React.useState(memoryStore)
  const [resetKey, setResetKey] = React.useState(0)
  const [frame, setFrame] = React.useState<HTMLDivElement | null>(null)

  const now = React.useCallback(
    () => base + offsetHours * HOUR,
    [base, offsetHours],
  )
  const onEvent = React.useCallback(
    (event: PromotionEvent) =>
      setEvents((previous) =>
        [{ ...event, seq: ++seq.current }, ...previous].slice(0, 10),
      ),
    [],
  )
  const clock = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
  }).format(now())
  const spec = DEVICES[device]
  const phone = device === 'phone'

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6 px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          aria-label="Demo view"
          value={[view]}
          onValueChange={(value) => {
            if (value[0]) setView(value[0] as 'site' | 'editor')
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="site">Live site</ToggleGroupItem>
          <ToggleGroupItem value="editor">Editor</ToggleGroupItem>
        </ToggleGroup>
        {view === 'site' ? (
          <div className="flex items-center gap-2">
            <ToggleGroup
              aria-label="Device"
              value={[device]}
              onValueChange={(value) => {
                if (value[0]) setDevice(value[0] as Device)
              }}
              variant="outline"
              size="sm"
            >
              {(Object.keys(DEVICES) as Device[]).map((key) => {
                const Icon = DEVICES[key].icon
                return (
                  <ToggleGroupItem
                    key={key}
                    value={key}
                    aria-label={DEVICES[key].label}
                  >
                    <Icon aria-hidden />
                  </ToggleGroupItem>
                )
              })}
            </ToggleGroup>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                store.clear()
                setEvents([])
                setResetKey((k) => k + 1)
              }}
            >
              Reset visitor
            </Button>
          </div>
        ) : null}
      </div>

      {view === 'site' ? (
        <PromotionProvider
          key={resetKey}
          source={records}
          pathname={pathname}
          now={now}
          tickMs={1000}
          storage={store}
          suppressOn={['/checkout']}
          dialogEngagement={{ delayMs: 2500, scrollDepth: 0 }}
          toastEngagement={{ delayMs: 1200, scrollDepth: 0 }}
          onEvent={onEvent}
          linkComponent={DemoLink}
        >
          <div className="border-border/60 grid gap-4 rounded-xl border p-4 sm:grid-cols-[1.4fr_1fr]">
            <div className="flex flex-col gap-2">
              <Label>Page</Label>
              <ToggleGroup
                aria-label="Page"
                value={[pathname]}
                onValueChange={(value) => {
                  if (value[0]) setPathname(value[0])
                }}
                variant="outline"
                size="sm"
                className="flex-wrap"
              >
                {PAGES.map((page) => (
                  <ToggleGroupItem key={page.value} value={page.value}>
                    {page.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Triggers />
            </div>
            <div className="flex flex-col gap-2">
              <Label id="promo-demo-clock">Clock · {clock}</Label>
              <Slider
                aria-labelledby="promo-demo-clock"
                min={-48}
                max={24 * 12}
                step={6}
                value={[offsetHours]}
                onValueChange={(value) =>
                  setOffsetHours(Array.isArray(value) ? (value[0] ?? 0) : value)
                }
                className="mt-2 w-full"
              />
            </div>
          </div>

          {/*
            The frame is a stand-in viewport: `transform` makes it the
            containing block for the fixed toast and floating bar, and the
            dialog portals into it, so every surface lands where it would on
            a real screen of this size.
          */}
          <div className="flex justify-center">
            <div
              ref={setFrame}
              data-device={device}
              style={{ width: spec.width, height: spec.height }}
              className={cn(
                'border-border bg-background relative max-w-full transform-gpu overflow-hidden border shadow-sm transition-[width] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none',
                phone ? 'rounded-[2rem] border-4' : 'rounded-xl',
              )}
            >
              <div className="h-full overflow-y-auto overscroll-contain">
                <MockSite pathname={pathname} phone={phone} />
              </div>
              <PromoToast />
              <PromoDialog
                layout={phone ? 'sheet' : 'dialog'}
                container={frame}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="border-border/60 rounded-xl border p-4 text-sm">
              <h3 className="mb-2 font-medium">Records</h3>
              <ul className="grid min-w-0 gap-1.5">
                {records.map((record) => (
                  <li
                    key={record.id}
                    className="flex min-w-0 justify-between gap-2"
                  >
                    <span className="min-w-0 truncate">{record.title}</span>
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {record.placement} · {deliveryState(record, now())}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="border-border/60 rounded-xl border p-4 text-sm">
              <h3 className="mb-2 font-medium">Events</h3>
              {events.length === 0 ? (
                <p className="text-muted-foreground">
                  Impressions, clicks, copies and dismissals appear here.
                </p>
              ) : (
                <ul className="grid gap-1 font-mono text-xs">
                  {events.map((event) => (
                    <li key={event.seq} className="truncate">
                      {event.type} · {event.id} · {event.placement} ·{' '}
                      {event.pathname}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </PromotionProvider>
      ) : (
        <PromotionEditor
          routes={EDITOR_ROUTES}
          targets={TARGETS}
          slots={[{ value: 'hero', label: 'Home hero' }]}
          others={records}
          timeZone="Asia/Kolkata"
          submitLabel="Publish to the demo"
          onSubmit={(content) => {
            setRecords((previous) => [
              ...previous,
              {
                ...content,
                id: `draft-${previous.length + 1}`,
                state: 'published',
                dismissalVersion: 1,
                revision: 1,
              },
            ])
            setView('site')
          }}
        />
      )}
    </div>
  )
}
