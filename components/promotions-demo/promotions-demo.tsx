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
  PromoCarousel,
  PromoInbox,
  PromoDialog,
  PromoPill,
  PromoProgress,
  PromoSheet,
  PromoSideCard,
  PromoSpotlight,
  PromoStickyCta,
  PromoToast,
  PromotionProvider,
  deliveryState,
  exitIntent,
  isRightToLeft,
  memoryDismissalStore,
  promotionLabels,
  usePromotions,
  type Promotion,
  type PromotionEvent,
  type PromotionLabelLocale,
  type PromotionLinkProps,
  type PromotionPlugin,
} from '@/components/promotions'
import { PromotionEditor } from '@/components/promotions/promotion-editor'
import { PromotionsDocs } from './promotions-docs'
import { SCENARIOS, type Scenario, type ScenarioId } from './scenarios'

const HOUR = 3_600_000

const DEVICES = {
  wide: {
    label: 'Desktop',
    icon: IconDeviceDesktop,
    width: '100%',
    height: 640,
  },
  laptop: {
    label: 'Laptop',
    icon: IconDeviceLaptop,
    width: '52rem',
    height: 580,
  },
  phone: {
    label: 'Phone',
    icon: IconDeviceMobile,
    width: '24.375rem',
    height: 720,
  },
} as const
type Device = keyof typeof DEVICES

const LANGUAGES: {
  value: PromotionLabelLocale
  label: string
  name: string
}[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'fr', label: 'FR', name: 'Français' },
  { value: 'de', label: 'DE', name: 'Deutsch' },
  { value: 'ja', label: '日本', name: '日本語' },
  { value: 'hi', label: 'हि', name: 'हिन्दी' },
  { value: 'ar', label: 'ع', name: 'العربية' },
]

const EXIT_INTENT: readonly PromotionPlugin[] = [
  exitIntent({ placement: 'dialog', minDwellMs: 1500 }),
]
const NO_PLUGINS: readonly PromotionPlugin[] = []

/** Keeps the demo on one page: internal CTAs switch the mock route. */
function useDemoLink(navigate: (href: string) => void) {
  return React.useMemo(
    () =>
      function DemoLink({
        href,
        className,
        children,
        onClick,
      }: PromotionLinkProps) {
        return (
          <a
            href={href}
            className={className}
            onClick={(event) => {
              event.preventDefault()
              onClick?.()
              if (href.startsWith('/')) navigate(href.split('?')[0] ?? '/')
            }}
          >
            {children}
          </a>
        )
      },
    [navigate],
  )
}

function Label({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <span id={id} className="text-muted-foreground text-xs font-medium">
      {children}
    </span>
  )
}

/** Manual triggers: the same `openPromotion` a host would wire to a button. */
function Triggers() {
  const { selection, openPromotion } = usePromotions()
  const floating = [selection.toast, selection.sheet, selection.dialog].filter(
    (p): p is Promotion => Boolean(p),
  )
  if (floating.length === 0)
    return (
      <p className="text-muted-foreground text-xs">
        No toast, sheet or dialog is live on this page.
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

function MockSite({
  scenario,
  pathname,
  phone,
  scroller,
  frame,
  navigate,
}: {
  scenario: Scenario
  pathname: string
  phone: boolean
  scroller: HTMLElement | null
  frame: HTMLElement | null
  navigate: (href: string) => void
}) {
  const page =
    scenario.pages.find((p) => p.value === pathname) ?? scenario.pages[0]!
  const pricing = React.useRef<HTMLDivElement>(null)
  const content = React.useRef<HTMLElement>(null)
  const share = React.useRef<HTMLButtonElement>(null)
  const { selection, openPromotion } = usePromotions()
  const story = selection.live.find((p) => p.presentation === 'story')
  const hasSpotlight = selection.live.some((p) => p.placement === 'spotlight')
  const [cart, setCart] = React.useState(scenario.cartStart ?? 0)
  const money = new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  })

  return (
    <>
      <PromoBar />
      <PromoSideCard
        container={frame}
        content={content}
        className={phone ? 'hidden' : undefined}
      />
      <header className="border-border/60 flex items-center gap-6 border-b px-5 py-3">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="font-medium tracking-tight"
        >
          {scenario.brand}
        </button>
        {phone ? (
          <div className="ms-auto flex items-center gap-2">
            <PromoInbox container={frame} />
            <IconMenu2 aria-hidden className="text-muted-foreground size-5" />
          </div>
        ) : (
          <nav
            aria-label="Mock site"
            className="text-muted-foreground ms-auto flex items-center gap-5 text-sm"
          >
            {scenario.nav.map((item) => (
              <button
                key={item.href}
                type="button"
                onClick={() => navigate(item.href)}
                className={cn(
                  'inline-flex items-center gap-1.5 hover:text-foreground',
                  pathname === item.href && 'text-foreground',
                )}
              >
                {item.label}
                <PromoBadge
                  href={item.href}
                  variant={item.dot ? 'dot' : 'pill'}
                />
              </button>
            ))}
            <PromoInbox container={frame} />
          </nav>
        )}
      </header>
      <main ref={content} className="flex max-w-2xl flex-col gap-6 p-5 sm:p-8">
        <div className="flex flex-col items-start gap-4">
          <PromoPill slot="announcement" />
          <h2
            className={cn(
              'max-w-xl font-medium tracking-tight text-balance',
              phone ? 'text-2xl' : 'text-3xl',
            )}
          >
            {page.heading}
          </h2>
          <p className="text-muted-foreground max-w-lg text-sm">{page.lede}</p>
          {story || hasSpotlight ? (
            <div className="flex flex-wrap gap-2">
              {hasSpotlight ? (
                <Button ref={share} size="sm" variant="outline">
                  Share workspace
                </Button>
              ) : null}
              {story ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => openPromotion(story.id)}
                >
                  See what’s new
                </Button>
              ) : null}
            </div>
          ) : null}
          <PromoSpotlight name="share" anchor={share} container={frame} />
        </div>
        <PromoCarousel
          slot="hero"
          dismissible
          label="Offers"
          className="max-w-2xl"
        />

        {page.kind === 'cart' ? (
          <div className="border-border/60 flex max-w-md flex-col gap-4 rounded-xl border p-4">
            <PromoProgress
              value={cart}
              goal={50}
              reward="free shipping"
              format={(n) => money.format(n)}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCart((c) => c + 9)}
              >
                Add socks · {money.format(9)}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setCart(scenario.cartStart ?? 0)}
              >
                Empty cart
              </Button>
            </div>
          </div>
        ) : null}

        {page.kind === 'product' ? (
          <div
            ref={pricing}
            className="border-border/60 flex max-w-md flex-col gap-2 rounded-xl border p-4"
          >
            <p className="font-medium">{page.priceTitle}</p>
            <p className="text-muted-foreground text-sm">{page.priceNote}</p>
            <p className="text-2xl font-medium tabular-nums">{page.price}</p>
            <Button className="self-start">Enrol</Button>
          </div>
        ) : null}

        <div className={cn('grid gap-3', !phone && 'grid-cols-3')}>
          {scenario.tiles.map((tile) => (
            <div
              key={tile.title}
              className="border-border/60 rounded-xl border p-4"
            >
              <p className="font-medium">{tile.title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{tile.body}</p>
            </div>
          ))}
        </div>
        <div className="bg-muted/40 h-72 rounded-xl" aria-hidden />
        <div className="bg-muted/40 h-72 rounded-xl" aria-hidden />
      </main>
      {page.kind === 'product' ? (
        <PromoStickyCta
          slot="sticky"
          watch={pricing}
          root={scroller}
          mobileOnly={false}
        />
      ) : null}
    </>
  )
}

export function PromotionsDemo() {
  const [base] = React.useState(() => Math.floor(Date.now() / HOUR) * HOUR)
  const [scenarioId, setScenarioId] = React.useState<ScenarioId>('launch')
  const scenario = SCENARIOS[scenarioId]
  const [records, setRecords] = React.useState<Promotion[]>(() =>
    scenario.seed(base),
  )
  const [pathname, setPathname] = React.useState<string>(scenario.startPath)
  const [offsetHours, setOffsetHours] = React.useState(0)
  const [device, setDevice] = React.useState<Device>('wide')
  const [lang, setLang] = React.useState<PromotionLabelLocale>('en')
  const [budget, setBudget] = React.useState(true)
  const [exit, setExit] = React.useState(false)
  const [events, setEvents] = React.useState<
    (PromotionEvent & { seq: number })[]
  >([])
  const seq = React.useRef(0)
  const [view, setView] = React.useState<'site' | 'editor' | 'docs'>('site')
  const [store, setStore] = React.useState(memoryDismissalStore)
  const [resetKey, setResetKey] = React.useState(0)
  const [frame, setFrame] = React.useState<HTMLDivElement | null>(null)
  const [scroller, setScroller] = React.useState<HTMLDivElement | null>(null)

  const now = React.useCallback(
    () => base + offsetHours * HOUR,
    [base, offsetHours],
  )
  const onEvent = React.useCallback(
    (event: PromotionEvent) =>
      setEvents((previous) =>
        [{ ...event, seq: ++seq.current }, ...previous].slice(0, 12),
      ),
    [],
  )
  const navigate = React.useCallback(
    (href: string) => {
      setPathname(href)
      scroller?.scrollTo({ top: 0 })
    },
    [scroller],
  )
  const DemoLink = useDemoLink(navigate)

  const resetVisitor = () => {
    setStore(memoryDismissalStore())
    setEvents([])
    setResetKey((k) => k + 1)
  }
  const pickScenario = (id: ScenarioId) => {
    setScenarioId(id)
    setRecords(SCENARIOS[id].seed(base))
    setPathname(SCENARIOS[id].startPath)
    setOffsetHours(0)
    resetVisitor()
  }

  const clock = new Intl.DateTimeFormat(lang, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
  }).format(now())
  const spec = DEVICES[device]
  const phone = device === 'phone'
  const rtl = isRightToLeft(lang)

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6 px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          aria-label="Demo view"
          value={[view]}
          onValueChange={(value) => {
            if (value[0]) setView(value[0] as 'site' | 'editor' | 'docs')
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="site">Live site</ToggleGroupItem>
          <ToggleGroupItem value="editor">Editor</ToggleGroupItem>
          <ToggleGroupItem value="docs">Docs</ToggleGroupItem>
        </ToggleGroup>
        <ToggleGroup
          aria-label="Scenario"
          value={[scenarioId]}
          onValueChange={(value) => {
            if (value[0]) pickScenario(value[0] as ScenarioId)
          }}
          variant="outline"
          size="sm"
          className="flex-wrap"
        >
          {(Object.keys(SCENARIOS) as ScenarioId[]).map((id) => (
            <ToggleGroupItem key={id} value={id}>
              {SCENARIOS[id].label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {view === 'site' ? (
        <PromotionProvider
          key={`${scenarioId}-${resetKey}`}
          source={records}
          pathname={pathname}
          now={now}
          tickMs={1000}
          storage={store}
          suppressOn={['/checkout']}
          dialogEngagement={{ delayMs: 2500, scrollDepth: 0 }}
          toastEngagement={{ delayMs: 1200, scrollDepth: 0 }}
          floatingBudgetHours={budget ? 24 : 0}
          plugins={exit ? EXIT_INTENT : NO_PLUGINS}
          labels={promotionLabels[lang]}
          locale={lang}
          onEvent={onEvent}
          linkComponent={DemoLink}
        >
          <div className="border-border/60 grid gap-4 rounded-xl border p-4 md:grid-cols-[1.3fr_1fr]">
            <div className="flex flex-col gap-2">
              <Label>Page</Label>
              <ToggleGroup
                aria-label="Page"
                value={[pathname]}
                onValueChange={(value) => {
                  if (value[0]) navigate(value[0])
                }}
                variant="outline"
                size="sm"
                className="flex-wrap"
              >
                {scenario.pages.map((page) => (
                  <ToggleGroupItem key={page.value} value={page.value}>
                    {page.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <Triggers />
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label id="promo-demo-clock">Clock · {clock}</Label>
                <Slider
                  aria-labelledby="promo-demo-clock"
                  min={-48}
                  max={24 * 12}
                  step={6}
                  value={[offsetHours]}
                  onValueChange={(value) =>
                    setOffsetHours(
                      Array.isArray(value) ? (value[0] ?? 0) : value,
                    )
                  }
                  className="mt-1 w-full"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                <ToggleGroup
                  aria-label="Language"
                  value={[lang]}
                  onValueChange={(value) => {
                    if (value[0]) setLang(value[0] as PromotionLabelLocale)
                  }}
                  variant="outline"
                  size="sm"
                >
                  {LANGUAGES.map((l) => (
                    <ToggleGroupItem
                      key={l.value}
                      value={l.value}
                      lang={l.value}
                      aria-label={l.name}
                    >
                      {l.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  size="sm"
                  variant={budget ? 'secondary' : 'ghost'}
                  aria-pressed={budget}
                  onClick={() => setBudget((b) => !b)}
                >
                  Daily budget {budget ? 'on' : 'off'}
                </Button>
                <Button
                  size="sm"
                  variant={exit ? 'secondary' : 'ghost'}
                  aria-pressed={exit}
                  onClick={() => setExit((e) => !e)}
                >
                  Exit intent {exit ? 'on' : 'off'}
                </Button>
                <Button size="sm" variant="ghost" onClick={resetVisitor}>
                  Reset visitor
                </Button>
              </div>
            </div>
          </div>

          {/*
            A stand-in viewport: `transform` makes it the containing block for
            the fixed surfaces, and the dialogs portal into it.
          */}
          <div className="flex justify-center">
            <div
              ref={setFrame}
              dir={rtl ? 'rtl' : 'ltr'}
              lang={lang}
              style={{ width: spec.width, height: spec.height }}
              className={cn(
                'border-border bg-background relative max-w-full transform-gpu overflow-hidden border shadow-sm transition-[width] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none',
                phone ? 'rounded-[2rem] border-4' : 'rounded-xl',
              )}
            >
              <div
                ref={setScroller}
                className="h-full overflow-y-auto overscroll-contain"
              >
                <MockSite
                  key={scenarioId}
                  scenario={scenario}
                  pathname={pathname}
                  phone={phone}
                  scroller={scroller}
                  frame={frame}
                  navigate={navigate}
                />
              </div>
              <PromoToast />
              <PromoSheet
                layout={phone ? 'bottom' : 'side'}
                container={frame}
                dir={rtl ? 'rtl' : 'ltr'}
              />
              <PromoDialog
                layout={phone ? 'sheet' : 'dialog'}
                container={frame}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
                      {record.placement}
                      {record.slot ? `:${record.slot}` : ''} ·{' '}
                      {deliveryState(record, now())}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
            <section className="border-border/60 rounded-xl border p-4 text-sm">
              <h3 className="mb-2 font-medium">Events</h3>
              {events.length === 0 ? (
                <p className="text-muted-foreground">
                  Impressions, clicks, copies, reveals and dismissals appear
                  here.
                </p>
              ) : (
                <ul className="grid gap-1 font-mono text-xs">
                  {events.map((event) => (
                    <li key={event.seq} className="truncate">
                      {event.type} · {event.id} · {event.pathname}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <section className="border-border/60 flex flex-col gap-2 rounded-xl border p-4 text-sm">
            <h3 className="font-medium">Use it</h3>
            <pre className="bg-muted/50 overflow-x-auto rounded-lg p-3 font-mono text-xs leading-relaxed">
              {`npx shadcn@latest add @kitsu/promotions

<PromotionProvider
  source={promotions}
  pathname={usePathname()}
  locale="${lang}"
  labels={promotionLabels.${lang}}
  plugins={[${exit ? 'exitIntent()' : ''}]}
  suppressOn={['/checkout']}
  onEvent={track}
>
  <PromoBar />
  {children}
  <PromoToast />
  <PromoSheet />
  <PromoDialog />
</PromotionProvider>`}
            </pre>
          </section>
        </PromotionProvider>
      ) : view === 'docs' ? (
        <PromotionsDocs />
      ) : (
        <PromotionEditor
          routes={scenario.pages.map(({ value, label }) => ({ value, label }))}
          targets={scenario.targets}
          slots={[
            { value: 'hero', label: 'Hero card' },
            { value: 'announcement', label: 'Announcement pill' },
            { value: 'sticky', label: 'Sticky CTA' },
          ]}
          others={records}
          timeZone="Europe/Paris"
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
