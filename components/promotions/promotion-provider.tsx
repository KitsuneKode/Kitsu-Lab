'use client'

import * as React from 'react'

import {
  dismissalExpiry,
  dismissalKey,
  dismissScope,
  frequencyAllows,
  inboxPromotions,
  localizePromotion,
  sharesCampaign,
  slotPromotions,
  matchRoute,
  sanitizePromotions,
  selectPromotions,
  targetsRoute,
  type DismissScope,
  type Promotion,
  type PromotionPlacement,
  type PromotionSelection,
} from './promotion'
import type { PromotionPlugin } from './promotion-plugins'
import { browserDismissalStore, type DismissalStore } from './promotion-stores'

export { browserDismissalStore, type DismissalStore }

/* -------------------------------------------------------------------------- */
/*  Contracts the host provides                                               */
/* -------------------------------------------------------------------------- */

/** Records the provider chooses from. An array, or anything that can load one. */
export type PromotionSource =
  | readonly Promotion[]
  | { load: (signal: AbortSignal) => Promise<readonly unknown[]> }

export type PromotionEvent = {
  type: 'impression' | 'click' | 'dismiss' | 'copy' | 'reveal'
  id: string
  placement: PromotionPlacement
  campaign?: string
  /** The route the visitor was on, so conversions can be attributed per page. */
  pathname: string
}

export type PromotionLinkProps = {
  href: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
  target?: string
  rel?: string
}

/** Every visible string, so a site can translate without forking. */
export type PromotionLabels = {
  announcement: string
  dismiss: string
  dismissNamed: (title: string) => string
  notNow: string
  opensInNewTab: string
  endsIn: (left: { unit: 'day' | 'hour' | 'minute'; value: number }) => string
  copyCode: (code: string) => string
  copied: string
  minimize: string
  restore: (title: string) => string
  reveal: string
  openOffer: string
  hideOffer: string
  inboxCount: (count: number) => string
  inboxHidden: string
  gotIt: string
  whatsOn: string
  previous: string
  next: string
}

export const defaultPromotionLabels: PromotionLabels = {
  announcement: 'Announcement',
  dismiss: 'Dismiss announcement',
  dismissNamed: (title) => `Dismiss ${title}`,
  notNow: 'Not now',
  opensInNewTab: '(opens in a new tab)',
  endsIn: ({ unit, value }) =>
    `Ends in ${value} ${unit}${value === 1 ? '' : 's'}`,
  copyCode: (code) => `Copy code ${code}`,
  copied: 'Copied',
  minimize: 'Minimise',
  restore: (title) => `Show offer: ${title}`,
  reveal: 'Reveal code',
  openOffer: 'Open offer',
  hideOffer: 'Hide this offer',
  inboxCount: (count) => `${count} offer${count === 1 ? '' : 's'}`,
  inboxHidden: 'Hidden',
  gotIt: 'Got it',
  whatsOn: 'What’s on',
  previous: 'Previous',
  next: 'Next',
}

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                  */
/* -------------------------------------------------------------------------- */

/** Plain anchor used when the host passes no `linkComponent`. */
function DefaultLink({
  href,
  className,
  children,
  onClick,
  target,
  rel,
}: PromotionLinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={onClick}
      target={target}
      rel={rel}
    >
      {children}
    </a>
  )
}

/* -------------------------------------------------------------------------- */
/*  Context                                                                   */
/* -------------------------------------------------------------------------- */

type PromotionContextValue = {
  /** Null until mounted: time-dependent UI never renders on the server. */
  now: number | null
  pathname: string
  selection: PromotionSelection
  bar: Promotion | null
  toast: Promotion | null
  /** The toast is folded into a small chip the visitor can reopen. */
  toastMinimized: boolean
  dialog: Promotion | null
  /**
   * Height of a bottom-docked bar (the sticky CTA) that floating surfaces
   * should sit above, so a phone never stacks two things in the thumb zone.
   */
  bottomInset: number
  setBottomInset: (px: number) => void
  /** The offer behind the edge tab, and whether its sheet is open. */
  sheet: Promotion | null
  sheetOpen: boolean
  /** The spotlight to show now, if its anchor is on the page. */
  spotlight: Promotion | null
  /** Called by PromoSpotlight so the provider knows which anchors exist. */
  registerAnchor: (name: string) => () => void
  /** Live side cards, best first. */
  sides: Promotion[]
  closeSheet: () => void
  card: (slot: string) => Promotion | null
  /** Every live card in a slot, best first, for carousels. */
  cards: (slot: string) => Promotion[]
  /**
   * Live offers on this route, one per campaign, including ones the visitor
   * hid: dismissing stops the interruption, not access to the offer.
   */
  inbox: { promotion: Promotion; hidden: boolean }[]
  inboxOpen: boolean
  setInboxOpen: (open: boolean) => void
  /** Live promotions on this route whose button points at `href`. */
  pointingAt: (href: string) => Promotion | null
  dismiss: (promotion: Promotion) => void
  /**
   * Closes a surface the visitor opened themselves (a story) without
   * recording a dismissal, so it can be watched again.
   */
  release: (promotion: Promotion) => void
  /** Closes a surface after its button was used. Not reported as a dismissal. */
  complete: (promotion: Promotion) => void
  minimize: (promotion: Promotion) => void
  restore: (promotion: Promotion) => void
  /** Opens a live toast, sheet or dialog now, skipping the engagement wait. */
  openPromotion: (id: string) => void
  /** Called by floating surfaces once they are on screen. */
  markShown: (promotion: Promotion) => void
  report: (
    type: PromotionEvent['type'],
    promotion: Pick<Promotion, 'id' | 'placement' | 'campaign'>,
  ) => void
  Link: React.ComponentType<PromotionLinkProps>
  labels: PromotionLabels
  timeZone?: string
}

const PromotionContext = React.createContext<PromotionContextValue | null>(null)

/** Everything a surface needs: the current selection, the clock, labels and the actions. Throws outside a provider. */
export function usePromotions(): PromotionContextValue {
  const value = React.useContext(PromotionContext)
  if (!value)
    throw new Error(
      'Promotion components must be rendered inside <PromotionProvider>.',
    )
  return value
}

/** Labels for views rendered outside a provider, such as the editor preview. */
export function usePromotionLabels(): PromotionLabels {
  return React.useContext(PromotionContext)?.labels ?? defaultPromotionLabels
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

export type PromotionEngagement = {
  /** Time on the page before it may open. `Infinity` waits for another trigger. */
  delayMs?: number
  /** Fraction of the page scrolled, 0–1. A page too short to scroll counts. */
  scrollDepth?: number
}

export type PromotionProviderProps = {
  source: PromotionSource
  /**
   * A loader runs once per mount, so an inline `{ load }` object is safe.
   * Change this key to load again (a new CMS revision, a signed-in user).
   */
  sourceKey?: string | number
  /** The current route. Pass your router's pathname, e.g. `usePathname()`. */
  pathname: string
  /** Injectable clock for previews and tests. */
  now?: () => number
  /**
   * The longest the clock sleeps. It also wakes exactly when a record starts
   * or ends, and whenever the tab becomes visible again.
   */
  tickMs?: number
  storage?: DismissalStore
  /** Route patterns where the bar, toast and dialog never appear (checkout, sign-in). */
  suppressOn?: readonly string[]
  /** A dialog waits for this much time and scroll depth before it may open. */
  dialogEngagement?: PromotionEngagement
  /** A toast waits for this, usually less than a dialog. */
  toastEngagement?: PromotionEngagement
  onEvent?: (event: PromotionEvent) => void
  /** Add-ons such as `exitIntent()`. Keep the array stable across renders. */
  plugins?: readonly PromotionPlugin[]
  /**
   * At most one toast or dialog per visitor in this many hours, across every
   * campaign. Each promotion's own `frequency` applies on top. 0 turns it off.
   */
  floatingBudgetHours?: number
  /** Let a higher-priority toast or dialog join a visible bar. Default true. */
  allowBarWithFloating?: boolean
  /** BCP 47 tag used to pick each record's `translations`, e.g. `fr-CA`. */
  locale?: string
  /** Your framework's link, so internal CTAs navigate client-side. */
  linkComponent?: React.ComponentType<PromotionLinkProps>
  labels?: Partial<PromotionLabels>
  /** Shown next to schedule text in countdowns and editors. */
  timeZone?: string
  children: React.ReactNode
}

/** Resolves `source` (an array or an async loader) to records, reloading only when `sourceKey` changes. */
function useLoadedRecords(
  source: PromotionSource,
  sourceKey: string | number | undefined,
): readonly Promotion[] {
  const isArray = Array.isArray(source)
  const [loaded, setLoaded] = React.useState<readonly Promotion[]>([])
  // Latest loader in a ref, so a new object identity each render never reloads.
  const latest = React.useRef(source)
  React.useLayoutEffect(() => {
    latest.current = source
  })

  React.useEffect(() => {
    const current = latest.current
    if (Array.isArray(current)) return
    const controller = new AbortController()
    ;(current as Exclude<PromotionSource, readonly Promotion[]>)
      .load(controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setLoaded(sanitizePromotions(records))
      })
      .catch(() => {
        // A promotion is never worth an error screen. Show nothing.
      })
    return () => controller.abort()
  }, [isArray, sourceKey])

  const fromArray = React.useMemo(
    () => (isArray ? sanitizePromotions(source) : null),
    [isArray, source],
  )
  return fromArray ?? loaded
}

/** True while the tab is in the background, when nothing should open. */
function isHidden() {
  return (
    typeof document !== 'undefined' && document.visibilityState === 'hidden'
  )
}

/**
 * A clock that sleeps until the next start or end (at most `tickMs`), and
 * re-reads on tab focus, so a window opens on time even after a laptop sleeps.
 */
function createClockStore(
  now: () => number,
  tickMs: number,
  edges: readonly number[],
) {
  // The snapshot is taken once here and only refreshed by `tick`, so what
  // React rendered is what it reads back after subscribing.
  let value = now()
  return {
    subscribe(onChange: () => void) {
      let timer: number | undefined
      const tick = () => {
        value = now()
        onChange()
        schedule()
      }
      const schedule = () => {
        window.clearTimeout(timer)
        const current = now()
        const edge = edges.find((at) => at > current) ?? null
        const untilEdge = edge === null ? tickMs : edge - current + 20
        timer = window.setTimeout(
          tick,
          Math.max(250, Math.min(tickMs, untilEdge)),
        )
      }
      const onVisible = () => {
        if (!isHidden()) tick()
      }
      schedule()
      document.addEventListener('visibilitychange', onVisible)
      return () => {
        window.clearTimeout(timer)
        document.removeEventListener('visibilitychange', onVisible)
      }
    },
    get: () => value,
  }
}

const serverClock = () => null

/**
 * The clock as an external store: SSR and hydration read null, so nothing
 * time-dependent renders until the browser's own clock is known.
 */
function useClock(
  now: () => number,
  tickMs: number,
  records: readonly Promotion[],
): number | null {
  // Keyed on the schedule's content, not the array's identity: a host that
  // builds `source` during render (a kit call) must not get a new store, and
  // a new subscription, on every render.
  const signature = React.useMemo(() => {
    const at = new Set<number>()
    for (const record of records) {
      if (record.state !== 'published') continue
      at.add(record.startsAt)
      at.add(record.endsAt)
    }
    return [...at].sort((a, b) => a - b).join(',')
  }, [records])
  const store = React.useMemo(
    () =>
      createClockStore(
        now,
        tickMs,
        signature ? signature.split(',').map(Number) : [],
      ),
    [now, tickMs, signature],
  )
  return React.useSyncExternalStore(store.subscribe, store.get, serverClock)
}

const NON_TEXT_INPUTS = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
])

/** Typing targets only: a focused slider, checkbox or button is not typing. */
function isTextEntry(element: HTMLElement): boolean {
  if (element.isContentEditable) return true
  if (element instanceof HTMLTextAreaElement) return !element.readOnly
  if (element instanceof HTMLInputElement)
    return !element.readOnly && !NON_TEXT_INPUTS.has(element.type)
  return false
}

/**
 * True while the visitor is mid-task: typing in a field, inside another
 * modal, or selecting text. Nothing floating should open over that.
 */
export function visitorIsBusy(): boolean {
  if (typeof document === 'undefined') return false
  const active = document.activeElement
  if (active instanceof HTMLElement && isTextEntry(active)) return true
  if (
    document.querySelector(
      'dialog[open], [role="dialog"][aria-modal="true"]:not([data-slot^="promo-"]), [role="alertdialog"]',
    )
  )
    return true
  const selection = window.getSelection?.()
  return Boolean(selection && !selection.isCollapsed)
}

/** Engagement is per page: navigating resets it without a state write. */
function useEngaged(
  pathname: string,
  enabled: boolean,
  { delayMs = 8000, scrollDepth = 0.3 }: PromotionEngagement,
): boolean {
  const [engagedOn, setEngagedOn] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!enabled) return
    let waited = delayMs <= 0
    let scrolled = scrollDepth <= 0
    let done = false
    let retry: number | undefined
    const engage = () => {
      if (done) return
      // Never interrupt: wait out typing, other modals and hidden tabs.
      if (isHidden() || visitorIsBusy()) {
        window.clearTimeout(retry)
        retry = window.setTimeout(engage, 1500)
        return
      }
      done = true
      setEngagedOn(pathname)
    }
    const check = () => {
      if (waited && scrolled) engage()
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      const depth = max <= 0 ? 1 : window.scrollY / max
      if (depth >= scrollDepth) {
        scrolled = true
        check()
      }
    }
    const timer = Number.isFinite(delayMs)
      ? window.setTimeout(() => {
          waited = true
          onScroll()
          check()
        }, delayMs)
      : undefined
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(retry)
      window.removeEventListener('scroll', onScroll)
    }
  }, [pathname, enabled, delayMs, scrollDepth])

  return engagedOn === pathname
}

const NO_ROUTES: readonly string[] = []
const DEFAULT_DIALOG_ENGAGEMENT: PromotionEngagement = {}
const DEFAULT_TOAST_ENGAGEMENT: PromotionEngagement = {
  delayMs: 4000,
  scrollDepth: 0.15,
}
const NO_LABELS: Partial<PromotionLabels> = {}
const NO_PLUGINS: readonly PromotionPlugin[] = []

/**
 * A full-screen story takes over the screen, so only the visitor starts one
 * (openPromotion from a "See what's new" button); it never auto-opens.
 */
const autoOpens = (promotion: Promotion) => promotion.presentation !== 'story'
const BUDGET_KEY = 'promo:budget:floating'

const shownKey = (promotion: Promotion) => `${dismissalKey(promotion)}:shown`
const minimizedKey = (promotion: Promotion) => `${dismissalKey(promotion)}:min`

/** Holds promotion state for one page tree: selection, frequency, dismissals, plugins and events. Surfaces read it with `usePromotions`. */
export function PromotionProvider({
  source,
  sourceKey,
  pathname,
  now: readNow = Date.now,
  tickMs = 60_000,
  storage = browserDismissalStore,
  suppressOn = NO_ROUTES,
  dialogEngagement = DEFAULT_DIALOG_ENGAGEMENT,
  toastEngagement = DEFAULT_TOAST_ENGAGEMENT,
  onEvent,
  linkComponent = DefaultLink,
  labels: labelOverrides = NO_LABELS,
  plugins = NO_PLUGINS,
  floatingBudgetHours = 24,
  allowBarWithFloating = true,
  locale,
  timeZone,
  children,
}: PromotionProviderProps) {
  const loaded = useLoadedRecords(source, sourceKey)
  const records = React.useMemo(
    () =>
      locale
        ? loaded.map((record) => localizePromotion(record, locale))
        : loaded,
    [loaded, locale],
  )
  const now = useClock(readNow, tickMs, records)
  // Local writes, so a dismissal applies at once even if storage throws.
  const [written, setWritten] = React.useState<ReadonlyMap<string, number>>(
    () => new Map(),
  )
  // Bumped when another tab writes, so reads are redone.
  const [storageVersion, setStorageVersion] = React.useState(0)
  const [forced, setForced] = React.useState<string | null>(null)
  const [bottomInset, setBottomInset] = React.useState(0)
  const [inboxOpen, setInboxOpen] = React.useState(false)
  // Spotlight anchors present on the page right now (registered on mount).
  const [anchors, setAnchors] = React.useState<ReadonlyMap<string, number>>(
    () => new Map(),
  )
  const registerAnchor = React.useCallback((name: string) => {
    setAnchors((previous) =>
      new Map(previous).set(name, (previous.get(name) ?? 0) + 1),
    )
    return () =>
      setAnchors((previous) => {
        const next = new Map(previous)
        const count = (next.get(name) ?? 1) - 1
        if (count <= 0) next.delete(name)
        else next.set(name, count)
        return next
      })
  }, [])
  const [openFloating, setOpenFloating] = React.useState<{
    id: string
    pathname: string
  } | null>(null)

  React.useEffect(
    () => storage.subscribe?.(() => setStorageVersion((v) => v + 1)),
    [storage],
  )

  // Triggers from add-ons (exit intent, idle) mark a placement engaged here.
  const [pluginEngaged, setPluginEngaged] = React.useState<
    Partial<Record<'toast' | 'dialog', string>>
  >({})
  const readNowRef = React.useRef(readNow)
  React.useLayoutEffect(() => {
    readNowRef.current = readNow
  })
  React.useEffect(() => {
    const cleanups = plugins.map((plugin) =>
      plugin.setup?.({
        pathname,
        now: () => readNowRef.current(),
        engage: (placement) =>
          setPluginEngaged((previous) =>
            previous[placement] === pathname
              ? previous
              : { ...previous, [placement]: pathname },
          ),
      }),
    )
    return () => cleanups.forEach((cleanup) => cleanup?.())
  }, [plugins, pathname])

  const read = React.useCallback(
    (key: string, scope: DismissScope) => {
      // Re-read after a cross-tab write bumps the version.
      void storageVersion
      const id = `${scope}|${key}`
      const value = written.has(id) ? written.get(id) : storage.get(key, scope)
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    },
    [written, storage, storageVersion],
  )
  const write = React.useCallback(
    (key: string, scope: DismissScope, at = readNow()) => {
      storage.set(key, at, scope)
      setWritten((previous) => new Map(previous).set(`${scope}|${key}`, at))
      return at
    },
    [readNow, storage],
  )

  const onEventRef = React.useRef(onEvent)
  React.useLayoutEffect(() => {
    onEventRef.current = onEvent
  })
  const report = React.useCallback<PromotionContextValue['report']>(
    (type, promotion) => {
      const event: PromotionEvent = {
        type,
        id: promotion.id,
        placement: promotion.placement,
        campaign: promotion.campaign,
        pathname,
      }
      onEventRef.current?.(event)
      for (const plugin of plugins) plugin.onEvent?.(event)
    },
    [pathname, plugins],
  )

  const isDismissed = React.useCallback(
    (promotion: Promotion) => {
      if (now === null) return true
      const at = read(dismissalKey(promotion), dismissScope(promotion.dismiss))
      if (at === null) return false
      const expiry = dismissalExpiry(promotion.dismiss, at)
      return expiry === null || now < expiry
    },
    [now, read],
  )

  const close = React.useCallback(
    (promotion: Promotion) => {
      write(dismissalKey(promotion), dismissScope(promotion.dismiss))
      setForced((id) => (id === promotion.id ? null : id))
      setOpenFloating((open) => (open?.id === promotion.id ? null : open))
    },
    [write],
  )

  const dismiss = React.useCallback(
    (promotion: Promotion) => {
      close(promotion)
      report('dismiss', promotion)
    },
    [close, report],
  )

  const labels = React.useMemo(
    () => ({ ...defaultPromotionLabels, ...labelOverrides }),
    [labelOverrides],
  )

  const suppressed = suppressOn.some((pattern) => matchRoute(pattern, pathname))
  const selection = React.useMemo<PromotionSelection>(
    () =>
      now === null
        ? { live: [], cards: {} }
        : selectPromotions(records, { pathname, now }),
    [now, pathname, records],
  )
  const allowed = (promotion: Promotion) =>
    now !== null &&
    plugins.every(
      (plugin) => plugin.allow?.(promotion, { pathname, now }) ?? true,
    )
  const available = (promotion: Promotion | undefined) =>
    !suppressed && promotion && !isDismissed(promotion) && allowed(promotion)
      ? promotion
      : null

  const barCandidate = available(selection.bar)
  const toastCandidate = available(selection.toast)
  const dialogCandidate = available(selection.dialog)
  const sheetCandidate =
    selection.sheet && !isDismissed(selection.sheet) && allowed(selection.sheet)
      ? selection.sheet
      : null
  const spotlightCandidate = available(selection.spotlight)
  const sides = suppressed
    ? []
    : selection.live.filter(
        (promotion) =>
          promotion.placement === 'side' &&
          !isDismissed(promotion) &&
          allowed(promotion),
      )

  // Frequency: a floating surface shows at most once per its window, and at
  // most one of any campaign per budget window. An unanswered surface that
  // the visitor navigated away from does not chase them to the next page.
  const lastShown = (promotion: Promotion) =>
    read(shownKey(promotion), 'browser')
  const withinFrequency = (promotion: Promotion) =>
    now !== null &&
    frequencyAllows(lastShown(promotion), now, promotion.frequency?.hours)
  const budgetAt = read(BUDGET_KEY, 'browser')
  const withinBudget = (promotion: Promotion) =>
    floatingBudgetHours <= 0 ||
    now === null ||
    frequencyAllows(budgetAt, now, floatingBudgetHours) ||
    // The budget was spent on this very promotion; its frequency decides.
    (budgetAt !== null && lastShown(promotion) === budgetAt)
  const stillOpen = (promotion: Promotion) =>
    openFloating?.id === promotion.id && openFloating.pathname === pathname
  const fresh = (promotion: Promotion | null) =>
    promotion &&
    (forced === promotion.id ||
      stillOpen(promotion) ||
      (withinFrequency(promotion) && withinBudget(promotion)))
      ? promotion
      : null

  const dialogEngaged = useEngaged(
    pathname,
    Boolean(fresh(dialogCandidate)),
    dialogEngagement,
  )
  const spotlightEngaged = useEngaged(
    pathname,
    Boolean(fresh(spotlightCandidate)),
    toastEngagement,
  )
  const toastEngaged = useEngaged(
    pathname,
    Boolean(fresh(toastCandidate)),
    toastEngagement,
  )

  // A floating surface only joins a visible bar when it outranks it. The bar
  // never steps aside: it is in the page flow, and moving it shifts layout.
  // One campaign, one surface: if the bar already carries this campaign, its
  // toast or dialog would only repeat it louder.
  const outranksBar = (promotion: Promotion) =>
    !barCandidate ||
    (allowBarWithFloating &&
      !sharesCampaign(promotion, barCandidate) &&
      promotion.priority > barCandidate.priority)
  const engagedBy = (placement: 'toast' | 'dialog', engaged: boolean) =>
    engaged || pluginEngaged[placement] === pathname
  const dialog =
    dialogCandidate &&
    (forced === dialogCandidate.id ||
      stillOpen(dialogCandidate) ||
      (fresh(dialogCandidate) &&
        autoOpens(dialogCandidate) &&
        engagedBy('dialog', dialogEngaged) &&
        outranksBar(dialogCandidate)))
      ? dialogCandidate
      : null
  // A spotlight points at something on this page, so it needs its anchor
  // mounted. It ranks between the dialog and the toast: one at a time.
  const spotlight =
    !dialog &&
    spotlightCandidate &&
    anchors.has(spotlightCandidate.slot ?? 'default') &&
    (forced === spotlightCandidate.id ||
      stillOpen(spotlightCandidate) ||
      (fresh(spotlightCandidate) &&
        // Small and anchored, it can sit beside an in-flow bar; it still
        // counts as the one floating surface and spends the daily budget.
        engagedBy('toast', spotlightEngaged)))
      ? spotlightCandidate
      : null
  // An ignored toast does not vanish on the next page, nor chase the visitor
  // at full size: it folds into a chip for the rest of the visit.
  const toastOpenNow = Boolean(
    toastCandidate &&
    (forced === toastCandidate.id || stillOpen(toastCandidate)),
  )
  const toastShownRecently = Boolean(
    toastCandidate &&
    lastShown(toastCandidate) !== null &&
    !withinFrequency(toastCandidate),
  )
  const toastMinimized = Boolean(
    toastCandidate &&
    !toastOpenNow &&
    (toastShownRecently || read(minimizedKey(toastCandidate), 'tab') !== null),
  )
  const toast =
    !dialog &&
    toastCandidate &&
    (toastMinimized ||
      toastOpenNow ||
      (!spotlight &&
        fresh(toastCandidate) &&
        engagedBy('toast', toastEngaged) &&
        outranksBar(toastCandidate)))
      ? toastCandidate
      : null
  const sheetOpen = Boolean(sheetCandidate && forced === sheetCandidate.id)

  const value: PromotionContextValue = {
    now,
    pathname,
    selection,
    bar: barCandidate,
    toast,
    toastMinimized: Boolean(toast) && toastMinimized,
    dialog,
    bottomInset,
    setBottomInset,
    sheet: sheetCandidate,
    sheetOpen,
    spotlight,
    registerAnchor,
    sides,
    closeSheet: () =>
      setForced((id) => (id === sheetCandidate?.id ? null : id)),
    // The best card in the slot the visitor has not dismissed and no plugin
    // vetoed, so a lower card can take the place of an ineligible one.
    card: (slot) =>
      slotPromotions(selection, slot).find(
        (promotion) => !isDismissed(promotion) && allowed(promotion),
      ) ?? null,
    cards: (slot) =>
      slotPromotions(selection, slot).filter(
        (promotion) => !isDismissed(promotion) && allowed(promotion),
      ),
    inbox: suppressed
      ? []
      : inboxPromotions(selection)
          .filter(allowed)
          .map((promotion) => ({ promotion, hidden: isDismissed(promotion) })),
    inboxOpen,
    setInboxOpen,
    pointingAt: (href) => {
      if (now === null) return null
      const all = [
        selection.bar,
        selection.toast,
        selection.sheet,
        selection.side,
        selection.dialog,
        ...Object.values(selection.cards),
      ]
      return (
        all.find(
          (promotion): promotion is Promotion =>
            promotion?.cta?.href === href &&
            targetsRoute(promotion, pathname) &&
            !isDismissed(promotion) &&
            allowed(promotion),
        ) ?? null
      )
    },
    dismiss,
    complete: close,
    release: (promotion) => {
      setForced((id) => (id === promotion.id ? null : id))
      setOpenFloating((open) => (open?.id === promotion.id ? null : open))
    },
    minimize: (promotion) => {
      write(minimizedKey(promotion), 'tab')
      setForced((id) => (id === promotion.id ? null : id))
      setOpenFloating((open) => (open?.id === promotion.id ? null : open))
    },
    restore: (promotion) => {
      // NaN reads as "never written", in this map and in the browser store.
      write(minimizedKey(promotion), 'tab', Number.NaN)
      setForced(promotion.id)
    },
    openPromotion: setForced,
    markShown: (promotion) => {
      if (stillOpen(promotion)) return
      const at = write(shownKey(promotion), 'browser')
      // Only interruptions spend the budget; an offer the visitor opened does not.
      if (promotion.placement !== 'sheet') write(BUDGET_KEY, 'browser', at)
      setOpenFloating({ id: promotion.id, pathname })
      report('impression', promotion)
    },
    report,
    Link: linkComponent,
    labels,
    timeZone,
  }

  return (
    <PromotionContext.Provider value={value}>
      {children}
    </PromotionContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */
/*  Impressions and focus                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Fires once per page view when at least half the element has been visible
 * for a second in a visible tab. Rendering is not an impression; being seen is.
 */
export function useImpression(
  promotion: Promotion | null,
  onImpression: ((promotion: Promotion) => void) | undefined,
  viewKey = '',
) {
  const ref = React.useRef<HTMLElement | null>(null)
  const seen = React.useRef<string | null>(null)

  React.useEffect(() => {
    const element = ref.current
    if (!promotion || !element || !onImpression) return
    const key = `${promotion.id}@${viewKey}`
    if (seen.current === key) return
    if (typeof IntersectionObserver === 'undefined') return

    let timer: number | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isHidden()) {
          timer = window.setTimeout(() => {
            seen.current = key
            onImpression(promotion)
            observer.disconnect()
          }, 1000)
        } else if (timer !== undefined) {
          window.clearTimeout(timer)
          timer = undefined
        }
      },
      { threshold: 0.5 },
    )
    observer.observe(element)
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      observer.disconnect()
    }
  }, [promotion, onImpression, viewKey])

  return ref
}

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * When a surface holding focus goes away, focus would fall to <body> and a
 * keyboard user would start over from the top. Move it to the next tabbable
 * element after the surface instead.
 */
export function moveFocusPast(container: HTMLElement | null) {
  if (!container || !container.contains(document.activeElement)) return
  const all = Array.from(document.querySelectorAll<HTMLElement>(TABBABLE))
  const next = all.find(
    (element) =>
      !container.contains(element) &&
      container.compareDocumentPosition(element) &
        Node.DOCUMENT_POSITION_FOLLOWING &&
      element.offsetParent !== null,
  )
  next?.focus({ preventScroll: true })
}
