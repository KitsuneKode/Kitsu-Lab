'use client'

import * as React from 'react'
import {
  IconArrowsMaximize,
  IconCheck,
  IconDeviceDesktop,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconLayoutNavbarCollapse,
  IconLayoutNavbarExpand,
  IconLink,
  IconMaximize,
  IconMenu2,
  IconMinimize,
  IconRefresh,
  IconX,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  PromoBadge,
  PromoBar,
  PromoDialog,
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
import {
  PromoCarousel,
  PromoInbox,
  PromoPill,
  PromoProgress,
  PromoSheet,
  PromoSideCard,
  PromoSpotlight,
  PromoStickyCta,
  PromoStory,
} from '@/components/promotions/pro'
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

/**
 * Full-window sizes: the real viewport for desktop, a 13-inch laptop and a
 * modern phone, each clamped to the space available.
 */
const THEATRE: Record<Device, { width: string; height: string }> = {
  wide: { width: '100%', height: '100%' },
  laptop: { width: 'min(1280px, 100%)', height: 'min(800px, 100%)' },
  phone: { width: 'min(390px, 100%)', height: 'min(844px, 100%)' },
}

const subscribeFullscreen = (onChange: () => void) => {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}
const noopSubscribe = () => () => {}

/**
 * The full-window preview lives in the URL (`#preview`): the link can be
 * sent to a phone, and the back gesture closes it like any other screen.
 */
const PREVIEW_HASH = '#preview'
const PREVIEW_EVENT = 'promo-preview-change'
const subscribePreview = (onChange: () => void) => {
  window.addEventListener('popstate', onChange)
  window.addEventListener('hashchange', onChange)
  window.addEventListener(PREVIEW_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener('hashchange', onChange)
    window.removeEventListener(PREVIEW_EVENT, onChange)
  }
}

/** Narrow real screens always get the phone layout, whatever the toggle says. */
function useNarrowViewport() {
  return React.useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia('(max-width: 639px)')
      query.addEventListener('change', onChange)
      return () => query.removeEventListener('change', onChange)
    },
    () => window.matchMedia('(max-width: 639px)').matches,
    () => false,
  )
}

/** The frame's real size in CSS pixels, for the preview readout. */
function useElementSize(element: HTMLElement | null) {
  const [size, setSize] = React.useState<{ w: number; h: number } | null>(null)
  React.useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const box = entry.borderBoxSize?.[0]
      setSize({
        w: Math.round(box?.inlineSize ?? entry.contentRect.width),
        h: Math.round(box?.blockSize ?? entry.contentRect.height),
      })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return size
}

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

const DOCK_SELECT =
  'border-input bg-background focus-visible:ring-ring/50 h-8 shrink-0 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3'

const EXIT_INTENT: readonly PromotionPlugin[] = [
  exitIntent({ placement: 'dialog', minDwellMs: 1500 }),
]
const NO_PLUGINS: readonly PromotionPlugin[] = []

/** Keeps the demo on one page: internal CTAs switch the mock route. */
function useDemoLink(navigate: (href: string) => void) {
  return React.useMemo(
    () =>
      /** Keeps the demo on one page: internal links switch the mock route. */
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

/** Small caption above a demo control. */
function Label({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <span id={id} className="text-muted-foreground text-xs font-medium">
      {children}
    </span>
  )
}

/** Manual triggers: the same `openPromotion` a host would wire to a button. */
function Triggers({ compact = false }: { compact?: boolean }) {
  const { selection, openPromotion } = usePromotions()
  const floating = [selection.toast, selection.sheet, selection.dialog].filter(
    (p): p is Promotion => Boolean(p),
  )
  if (floating.length === 0)
    return compact ? null : (
      <p className="text-muted-foreground text-xs">
        No toast, sheet or dialog is live on this page.
      </p>
    )
  return (
    <div
      className={cn(
        'flex items-center gap-1.5',
        compact ? 'shrink-0' : 'flex-wrap',
      )}
    >
      {compact ? (
        <span className="text-muted-foreground text-xs">Open</span>
      ) : null}
      {floating.map((promotion) => (
        <Button
          key={promotion.id}
          size="sm"
          variant="outline"
          onClick={() => openPromotion(promotion.id)}
        >
          {compact ? promotion.placement : `Open ${promotion.placement} now`}
        </Button>
      ))}
    </div>
  )
}

/** The fictional site inside the preview frame, with every surface placed where a real site would put it. */
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
  const { selection, openPromotion, trigger } = usePromotions()
  const story = selection.live.find((p) => p.presentation === 'story')
  const upgradeOffer = selection.live.some((p) =>
    p.triggers?.includes('upgrade-intent'),
  )
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
      {/* A centred column, like a real site: the side card docks only where the margin is wide enough. */}
      <main
        ref={content}
        className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-5 sm:p-8"
      >
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
          {story || hasSpotlight || upgradeOffer ? (
            <div className="flex flex-wrap gap-2">
              {upgradeOffer ? (
                <Button
                  size="sm"
                  // The offer gets one chance at the moment of intent; after
                  // that, Upgrade simply goes to checkout.
                  onClick={() => {
                    if (!trigger('upgrade-intent')) navigate('/checkout')
                  }}
                >
                  Upgrade to Team
                </Button>
              ) : null}
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

/** The exhibit: live site, editor and docs, with device frames and a full-window preview. */
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
  const previewInUrl = React.useSyncExternalStore(
    subscribePreview,
    () => window.location.hash === PREVIEW_HASH,
    () => false,
  )
  // Only the live site has a full-window form.
  const theatre = previewInUrl && view === 'site'
  const pushedPreview = React.useRef(false)
  const [linkCopied, setLinkCopied] = React.useState(false)
  const [bare, setBare] = React.useState(false)
  const [peekDock, setPeekDock] = React.useState(false)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const narrow = useNarrowViewport()
  const frameSize = useElementSize(frame)
  const canFullscreen = React.useSyncExternalStore(
    noopSubscribe,
    () => Boolean(document.fullscreenEnabled),
    () => false,
  )
  const browserFull = React.useSyncExternalStore(
    subscribeFullscreen,
    () =>
      Boolean(stageRef.current) &&
      document.fullscreenElement === stageRef.current,
    () => false,
  )

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
  const phone = device === 'phone' || narrow
  const rtl = isRightToLeft(lang)
  const size = theatre
    ? THEATRE[device]
    : { width: spec.width, height: spec.height }

  const pageToggle = (wrap: boolean) => (
    <ToggleGroup
      aria-label="Page"
      value={[pathname]}
      onValueChange={(value) => {
        if (value[0]) navigate(value[0])
      }}
      variant="outline"
      size="sm"
      className={wrap ? 'flex-wrap' : 'shrink-0'}
    >
      {scenario.pages.map((page) => (
        <ToggleGroupItem key={page.value} value={page.value}>
          {page.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
  const deviceToggle = (
    <ToggleGroup
      aria-label="Device"
      value={[narrow ? 'phone' : device]}
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
            disabled={narrow && key !== 'phone'}
          >
            <Icon aria-hidden />
          </ToggleGroupItem>
        )
      })}
    </ToggleGroup>
  )
  const languageToggle = (
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
  )

  const openTheatre = () => {
    opener.current = document.activeElement as HTMLElement | null
    // Next patches pushState to keep its router state, so Back stays in-app.
    window.history.pushState(null, '', PREVIEW_HASH)
    pushedPreview.current = true
    window.dispatchEvent(new Event(PREVIEW_EVENT))
  }
  const closeTheatre = React.useCallback(() => {
    if (pushedPreview.current) {
      window.history.back()
      return
    }
    // Opened from a shared link: drop the hash without leaving the page.
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )
    window.dispatchEvent(new Event(PREVIEW_EVENT))
  }, [])
  const copyPreviewLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setLinkCopied(true)
      window.setTimeout(() => setLinkCopied(false), 1600)
    } catch {
      // Clipboard refused; the address bar has the same link.
    }
  }
  const toggleBrowserFull = () => {
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {})
    else void stageRef.current?.requestFullscreen?.().catch(() => {})
  }

  // The page behind steps aside (see globals.css) and stops scrolling.
  React.useEffect(() => {
    if (!theatre) return
    const root = document.documentElement
    root.setAttribute('data-exhibit-immersive', '')
    stageRef.current?.focus({ preventScroll: true })
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      // Escape belongs to whatever surface is open inside the site first.
      const inSite = frame?.contains(document.activeElement)
      const open = frame?.querySelector(
        '[role="dialog"], [data-slot="promo-story"], [data-slot="promo-spotlight"]',
      )
      if (inSite || open) return
      closeTheatre()
    }
    window.addEventListener('keydown', onKey)
    const returnTo = opener.current
    return () => {
      // However it closed (button, Escape, Back), leave nothing behind.
      root.removeAttribute('data-exhibit-immersive')
      window.removeEventListener('keydown', onKey)
      if (document.fullscreenElement)
        void document.exitFullscreen().catch(() => {})
      pushedPreview.current = false
      setBare(false)
      setPeekDock(false)
      returnTo?.focus({ preventScroll: true })
    }
  }, [theatre, frame, closeTheatre])

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6 px-4 pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
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
          {view === 'site' ? (
            <Button size="sm" variant="outline" onClick={openTheatre}>
              <IconArrowsMaximize aria-hidden />
              Full-window preview
            </Button>
          ) : null}
        </div>
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
              {pageToggle(true)}
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
                {deviceToggle}
                {languageToggle}
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
          <div
            ref={stageRef}
            tabIndex={theatre ? -1 : undefined}
            role={theatre ? 'dialog' : undefined}
            aria-modal={theatre || undefined}
            aria-label={
              theatre ? `${scenario.brand} full-window preview` : undefined
            }
            data-promo-theatre={
              theatre ? (bare ? 'bare' : 'docked') : undefined
            }
            className={cn(
              'flex justify-center outline-none',
              theatre &&
                'bg-muted animate-in fade-in-0 fixed inset-0 z-[90] flex-col items-stretch duration-200 ease-out motion-reduce:animate-none',
            )}
          >
            {theatre ? (
              <div
                className={cn(
                  'bg-background/95 supports-backdrop-filter:bg-background/80 border-border z-10 flex h-12 shrink-0 items-center gap-2 overflow-x-auto border-b px-3 supports-backdrop-filter:backdrop-blur-md',
                  bare &&
                    'absolute inset-x-0 top-0 transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] focus-within:translate-y-0 motion-reduce:transition-none',
                  bare && !peekDock && '-translate-y-full',
                )}
                onPointerLeave={(event) => {
                  if (event.pointerType === 'mouse') setPeekDock(false)
                }}
              >
                <span className="shrink-0 text-sm font-medium">
                  {scenario.brand}
                </span>
                <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                  {frameSize ? `${frameSize.w} × ${frameSize.h}` : null}
                </span>
                <span
                  className="bg-border mx-1 h-5 w-px shrink-0"
                  aria-hidden
                />
                <select
                  aria-label="Page"
                  value={pathname}
                  onChange={(event) => navigate(event.target.value)}
                  className={DOCK_SELECT}
                >
                  {scenario.pages.map((page) => (
                    <option key={page.value} value={page.value}>
                      {page.label}
                    </option>
                  ))}
                </select>
                <div className="shrink-0">{deviceToggle}</div>
                <select
                  aria-label="Language"
                  value={lang}
                  onChange={(event) =>
                    setLang(event.target.value as PromotionLabelLocale)
                  }
                  className={DOCK_SELECT}
                >
                  {LANGUAGES.map((l) => (
                    <option key={l.value} value={l.value} lang={l.value}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <span
                  className="bg-border mx-1 h-5 w-px shrink-0"
                  aria-hidden
                />
                <Triggers compact />
                {/* Pinned to the end, so Close never scrolls out of reach. */}
                <div className="bg-background sticky end-0 ms-auto flex shrink-0 items-center gap-1 ps-2">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={
                      linkCopied ? 'Link copied' : 'Copy link to this preview'
                    }
                    title="Copy link to this preview, e.g. to open it on your phone"
                    onClick={copyPreviewLink}
                  >
                    {linkCopied ? (
                      <IconCheck aria-hidden />
                    ) : (
                      <IconLink aria-hidden />
                    )}
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Reset visitor"
                    title="Reset visitor"
                    onClick={resetVisitor}
                  >
                    <IconRefresh aria-hidden />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-pressed={bare}
                    aria-label={bare ? 'Show controls' : 'Hide controls'}
                    title={bare ? 'Show controls' : 'Hide controls'}
                    onClick={(event) => {
                      setBare((b) => !b)
                      setPeekDock(false)
                      // A pointer click should let the dock tuck away; keyboard keeps focus.
                      if (event.detail > 0) event.currentTarget.blur()
                    }}
                  >
                    {bare ? (
                      <IconLayoutNavbarExpand aria-hidden />
                    ) : (
                      <IconLayoutNavbarCollapse aria-hidden />
                    )}
                  </Button>
                  {canFullscreen ? (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-pressed={browserFull}
                      aria-label={
                        browserFull
                          ? 'Leave browser full screen'
                          : 'Browser full screen'
                      }
                      title={
                        browserFull
                          ? 'Leave browser full screen'
                          : 'Browser full screen'
                      }
                      onClick={toggleBrowserFull}
                    >
                      {browserFull ? (
                        <IconMinimize aria-hidden />
                      ) : (
                        <IconMaximize aria-hidden />
                      )}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="outline" onClick={closeTheatre}>
                    <IconX aria-hidden />
                    Close
                    <kbd className="text-muted-foreground ms-1 font-mono text-[0.6875rem] max-sm:hidden">
                      Esc
                    </kbd>
                  </Button>
                </div>
              </div>
            ) : null}
            {theatre && bare ? (
              // A handle to bring the controls back, sized for a thumb.
              <button
                type="button"
                aria-label="Show controls"
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') setPeekDock(true)
                }}
                onClick={() => setPeekDock((p) => !p)}
                className="absolute top-0 left-1/2 z-20 flex h-6 w-16 -translate-x-1/2 items-start justify-center pt-1.5 outline-none"
              >
                <span className="bg-foreground/35 h-1 w-10 rounded-full" />
              </button>
            ) : null}
            <div
              className={cn(
                'flex justify-center',
                theatre && 'min-h-0 flex-1 items-center',
                theatre && device !== 'wide' && !narrow && 'p-4 sm:p-6',
              )}
            >
              <div
                ref={setFrame}
                dir={rtl ? 'rtl' : 'ltr'}
                lang={lang}
                style={size}
                className={cn(
                  'border-border bg-background relative max-w-full transform-gpu overflow-hidden shadow-sm transition-[width,height] duration-300 ease-[cubic-bezier(0.77,0,0.175,1)] motion-reduce:transition-none',
                  theatre && device === 'wide'
                    ? 'max-h-full'
                    : phone && !(theatre && narrow)
                      ? 'max-h-full rounded-[2rem] border-4'
                      : 'max-h-full rounded-xl border',
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
                  story={PromoStory}
                />
              </div>
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
  <PromoDialog story={PromoStory} />
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
