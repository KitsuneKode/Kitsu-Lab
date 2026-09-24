'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  PromoBar,
  PromoCard,
  PromoOverlays,
  PromotionProvider,
  deliveryState,
  type DismissalStore,
  type Promotion,
  type PromotionContent,
  type PromotionEvent,
} from '@/components/promotions'
import { CampaignTimeline } from '@/components/promotions/campaign-timeline'
import { PromotionEditor } from '@/components/promotions/promotion-editor'

const HOUR = 3_600_000
const DAY = 24 * HOUR

const PAGES = [
  { value: '/', label: 'Home' },
  { value: '/courses', label: 'Courses' },
  { value: '/courses/evening-batch', label: 'A course' },
  { value: '/books', label: 'Books' },
  { value: '/checkout', label: 'Checkout' },
] as const

const EDITOR_ROUTES: { value: string; label: string }[] = [
  ...PAGES,
  { value: '/courses/*', label: 'Every course' },
]

const TARGETS = [
  { value: '/courses', label: 'Courses page' },
  { value: '/courses/evening-batch', label: 'Evening batch' },
  { value: '/books', label: 'Books' },
  { value: 'https://wa.me/910000000000', label: 'WhatsApp (external)' },
]

const SLOTS = [{ value: 'hero', label: 'Home hero' }]

function seed(base: number): Promotion[] {
  const common = {
    state: 'published' as const,
    dismissalVersion: 1,
    revision: 1,
    exclude: ['/checkout'],
  }
  return [
    {
      ...common,
      id: 'evening-batch',
      placement: 'bar',
      eyebrow: 'New batch',
      title: 'The evening batch starts Monday',
      body: '6 to 8 PM, for people who work days.',
      cta: { label: 'See timings', href: '/courses/evening-batch' },
      tone: 'brand',
      include: [],
      startsAt: base - DAY,
      endsAt: base + 5 * DAY,
      priority: 60,
      dismiss: { mode: 'days', days: 3 },
      showCountdown: true,
      campaign: 'evening-batch',
    },
    {
      ...common,
      id: 'mock-series',
      placement: 'card',
      slot: 'hero',
      eyebrow: 'Test series',
      title: '20 prelims mocks, reviewed by the faculty who set them',
      body: 'Every paper is discussed in class the week after.',
      highlights: [
        'Full-length papers in the exam pattern',
        'Answer keys with explanations',
        'Rank among everyone who sat it',
      ],
      offer: {
        price: { amount: 1999, was: 2999, currency: 'INR' },
        code: 'MOCK1000',
        terms: 'On the full series, until the first paper.',
      },
      cta: { label: 'View the series', href: '/courses' },
      tone: 'neutral',
      include: ['/', '/courses'],
      startsAt: base - 2 * DAY,
      endsAt: base + 10 * DAY,
      priority: 50,
      dismiss: { mode: 'session' },
      showCountdown: true,
    },
    {
      ...common,
      id: 'printed-notes',
      placement: 'corner',
      eyebrow: 'Just printed',
      title: 'Our geography notes, as a book',
      body: 'The classroom notes, bound. Shipped anywhere, or collect at the centre.',
      media: {
        src: '/sample-pages/page-1.svg',
        alt: 'A page from the notes',
        width: 1240,
        height: 1754,
      },
      offer: { percentOff: 15, code: 'NOTES15', terms: 'First 200 copies.' },
      cta: { label: 'Look inside', href: '/books' },
      tone: 'neutral',
      include: ['/', '/books'],
      startsAt: base - DAY,
      endsAt: base + 12 * DAY,
      priority: 40,
      dismiss: { mode: 'days', days: 7 },
    },
    {
      ...common,
      id: 'scholarship',
      placement: 'sheet',
      eyebrow: 'Scholarship test',
      title: 'Up to 50% off, decided by one test',
      body: 'Sit the scholarship test this Sunday. Your score sets your fee for any batch this year.',
      highlights: [
        'One hour, online or at the centre',
        'Results the same evening',
        'Applies to every course',
      ],
      cta: { label: 'Book a seat', href: '/courses' },
      tone: 'brand',
      include: ['/courses', '/courses/*'],
      startsAt: base + 3 * DAY,
      endsAt: base + 9 * DAY,
      priority: 70,
      dismiss: { mode: 'never-again' },
      trigger: 'exit-intent',
    },
    {
      ...common,
      id: 'early-bird',
      state: 'draft',
      placement: 'dialog',
      eyebrow: 'Early bird',
      title: '20% off the 2027 foundation batch',
      body: 'For the first hundred enrolments, before the batch fills.',
      offer: {
        percentOff: 20,
        price: { amount: 20009, was: 25009, currency: 'INR' },
        code: 'EARLY20',
        terms: 'New enrolments only. Not combined with scholarships.',
      },
      cta: { label: 'Enrol now', href: '/courses' },
      tone: 'highlight',
      include: ['/courses/*'],
      startsAt: base + 14 * DAY,
      endsAt: base + 24 * DAY,
      priority: 80,
      dismiss: { mode: 'never-again' },
      showCountdown: true,
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

function DemoLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
}) {
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

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`bg-foreground/[0.07] rounded-md ${className ?? ''}`} />
  )
}

export function PromotionsDemo() {
  const [base] = React.useState(() => Math.floor(Date.now() / HOUR) * HOUR)
  const [records, setRecords] = React.useState<Promotion[]>(() => seed(base))
  const [view, setView] = React.useState<'site' | 'admin'>('site')
  const [pathname, setPathname] = React.useState<string>('/')
  const [offsetHours, setOffsetHours] = React.useState(0)
  const [events, setEvents] = React.useState<
    (PromotionEvent & { seq: number })[]
  >([])
  const seq = React.useRef(0)
  const [store] = React.useState(memoryStore)
  const [resetKey, setResetKey] = React.useState(0)
  const [selectedId, setSelectedId] = React.useState<string | 'new'>(
    'mock-series',
  )

  const now = React.useCallback(
    () => base + offsetHours * HOUR,
    [base, offsetHours],
  )
  const onEvent = React.useCallback(
    (event: PromotionEvent) =>
      setEvents((previous) =>
        [{ ...event, seq: ++seq.current }, ...previous].slice(0, 8),
      ),
    [],
  )
  const clock = new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
  }).format(now())

  const selected =
    selectedId === 'new' ? undefined : records.find((r) => r.id === selectedId)

  function save(content: PromotionContent) {
    if (selected) {
      setRecords((previous) =>
        previous.map((record) =>
          record.id === selected.id
            ? {
                ...record,
                ...content,
                state: record.state === 'draft' ? 'published' : record.state,
                revision: record.revision + 1,
              }
            : record,
        ),
      )
    } else {
      const id = `promo-${records.length + 1}`
      setRecords((previous) => [
        ...previous,
        {
          ...content,
          id,
          state: 'published',
          dismissalVersion: 1,
          revision: 1,
        },
      ])
      setSelectedId(id)
    }
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6 px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          value={[view]}
          onValueChange={(value) => {
            if (value[0]) setView(value[0] as 'site' | 'admin')
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="site">Live site</ToggleGroupItem>
          <ToggleGroupItem value="admin">Admin</ToggleGroupItem>
        </ToggleGroup>
        {view === 'site' ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              store.clear()
              setEvents([])
              setResetKey((k) => k + 1)
            }}
          >
            Reset dismissals
          </Button>
        ) : (
          <Button size="sm" onClick={() => setSelectedId('new')}>
            New promotion
          </Button>
        )}
      </div>

      {view === 'site' ? (
        <>
          <div className="border-border/60 grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-muted-foreground text-xs font-medium">
                Page
              </span>
              <ToggleGroup
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
            </div>
            <div className="flex flex-col gap-2">
              <span
                className="text-muted-foreground text-xs font-medium"
                id="promo-demo-clock"
              >
                Clock · {clock}
              </span>
              <Slider
                aria-labelledby="promo-demo-clock"
                min={-48}
                max={24 * 26}
                step={6}
                value={[offsetHours]}
                onValueChange={(value) =>
                  setOffsetHours(Array.isArray(value) ? (value[0] ?? 0) : value)
                }
                className="mt-2 w-full"
              />
            </div>
          </div>

          <PromotionProvider
            key={resetKey}
            source={records}
            pathname={pathname}
            now={now}
            tickMs={1000}
            storage={store}
            suppressOn={['/checkout']}
            engagement={{ delayMs: 1200, scrollDepth: 0 }}
            onEvent={onEvent}
            linkComponent={DemoLink}
            timeZone="Asia/Kolkata"
          >
            <div className="border-border/60 bg-background overflow-hidden rounded-xl border">
              <PromoBar />
              <div className="flex flex-col gap-8 p-6 sm:p-10">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-24" />
                  <span className="text-muted-foreground font-mono text-xs">
                    {pathname}
                  </span>
                </div>
                <div className="grid max-w-xl gap-3">
                  <h2 className="text-3xl font-medium tracking-tight text-balance">
                    {pathname === '/checkout'
                      ? 'Checkout stays quiet.'
                      : 'A calm page that can still sell.'}
                  </h2>
                  <p className="text-muted-foreground">
                    Drag the clock to watch campaigns open and close on
                    schedule, and switch pages to see targeting. The corner card
                    appears on Home and Books; the side panel waits on course
                    pages for you to head for the tabs.
                  </p>
                </div>
                <PromoCard slot="hero" dismissible className="max-w-3xl" />
                <div className="grid gap-3 sm:grid-cols-3">
                  {[0, 1, 2].map((index) => (
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
            </div>
            <PromoOverlays />
          </PromotionProvider>

          <section className="border-border/60 rounded-xl border p-4 text-sm">
            <h3 className="mb-2 font-medium">Events</h3>
            {events.length === 0 ? (
              <p className="text-muted-foreground">
                Impressions, clicks, code copies and dismissals appear here.
              </p>
            ) : (
              <ul className="grid gap-1 font-mono text-xs">
                {events.map((event) => (
                  <li key={event.seq}>
                    {event.type} · {event.id} · {event.placement}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : (
        <div className="grid gap-8">
          <section className="border-border/60 rounded-xl border p-2 sm:p-4">
            <h3 className="px-3 pb-3 text-sm font-medium">
              Campaigns ·{' '}
              {records.filter((r) => deliveryState(r, base) === 'live').length}{' '}
              live now
            </h3>
            <CampaignTimeline
              promotions={records}
              now={base}
              selectedId={selectedId === 'new' ? undefined : selectedId}
              onSelect={setSelectedId}
              locale="en-IN"
              timeZone="Asia/Kolkata"
            />
          </section>

          <section className="grid gap-4">
            <h3 className="text-lg font-medium tracking-tight">
              {selected ? `Editing “${selected.title}”` : 'New promotion'}
            </h3>
            <PromotionEditor
              key={selectedId}
              initial={selected}
              routes={EDITOR_ROUTES}
              targets={TARGETS}
              slots={SLOTS}
              others={records.filter((r) => r.id !== selected?.id)}
              currency="INR"
              locale="en-IN"
              timeZone="Asia/Kolkata"
              submitLabel={selected ? 'Save changes' : 'Publish'}
              onSubmit={save}
            />
          </section>
        </div>
      )}
    </div>
  )
}
