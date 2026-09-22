'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  PromoBar,
  PromoCard,
  PromoDialog,
  PromotionProvider,
  deliveryState,
  type DismissalStore,
  type Promotion,
  type PromotionEvent,
} from '@/components/promotions'
import { PromotionEditor } from '@/components/promotions/promotion-editor'

const HOUR = 3_600_000
const DAY = 24 * HOUR

const PAGES = [
  { value: '/', label: 'Home' },
  { value: '/courses', label: 'Courses' },
  { value: '/courses/night-batch', label: 'A course' },
  { value: '/checkout', label: 'Checkout' },
] as const

const EDITOR_ROUTES: { value: string; label: string }[] = [
  ...PAGES,
  { value: '/courses/*', label: 'Every course' },
]

const TARGETS = [
  { value: '/courses', label: 'Courses page' },
  { value: '/courses/night-batch', label: 'Night batch' },
  { value: '/books', label: 'Books' },
  { value: 'https://wa.me/910000000000', label: 'WhatsApp (external)' },
]

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
      id: 'books-launch',
      state: 'published',
      placement: 'dialog',
      eyebrow: 'Just printed',
      title: 'Our Assam GK book is here',
      body: 'Printed notes from the classroom, shipped anywhere in Assam or collected at the centre.',
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

export function PromotionsDemo() {
  const [base] = React.useState(() => Math.floor(Date.now() / HOUR) * HOUR)
  const [records, setRecords] = React.useState<Promotion[]>(() => seed(base))
  const [pathname, setPathname] = React.useState<string>('/')
  const [offsetHours, setOffsetHours] = React.useState(0)
  const [events, setEvents] = React.useState<
    (PromotionEvent & { seq: number })[]
  >([])
  const seq = React.useRef(0)
  const [view, setView] = React.useState<'site' | 'editor'>('site')
  const [store] = React.useState(memoryStore)
  const [resetKey, setResetKey] = React.useState(0)

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
  const clock = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
  }).format(now())

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6 px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
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
        ) : null}
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

          <PromotionProvider
            key={resetKey}
            source={records}
            pathname={pathname}
            now={now}
            tickMs={1000}
            storage={store}
            suppressOn={['/checkout']}
            dialogEngagement={{ delayMs: 1200, scrollDepth: 0 }}
            onEvent={onEvent}
            linkComponent={DemoLink}
          >
            <div className="border-border/60 bg-background overflow-hidden rounded-xl border">
              <PromoBar />
              <div className="flex flex-col gap-6 p-6 sm:p-10">
                <p className="text-muted-foreground font-mono text-xs">
                  {pathname}
                </p>
                <h2 className="max-w-lg text-3xl font-medium tracking-tight text-balance">
                  {pathname === '/checkout'
                    ? 'Checkout stays quiet.'
                    : 'A calm page that can still announce things.'}
                </h2>
                <p className="text-muted-foreground max-w-lg">
                  Drag the clock to watch promotions open and close on schedule.
                  Switch pages to see targeting. Dismissals stick until you
                  reset them.
                </p>
                <PromoCard slot="hero" dismissible className="max-w-xl" />
              </div>
            </div>
            <PromoDialog />
          </PromotionProvider>

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
                  Impressions, clicks and dismissals appear here.
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
          </div>
        </>
      ) : (
        <PromotionEditor
          routes={EDITOR_ROUTES}
          targets={TARGETS}
          slots={[{ value: 'hero', label: 'Home hero' }]}
          others={records}
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
