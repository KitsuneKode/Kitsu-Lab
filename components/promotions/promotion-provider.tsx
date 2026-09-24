'use client'

import * as React from 'react'

import {
  dismissalExpiry,
  dismissalKey,
  isModal,
  matchRoute,
  selectPromotions,
  type Promotion,
  type PromotionPlacement,
  type PromotionSelection,
} from './promotion'

/* -------------------------------------------------------------------------- */
/*  Contracts the host provides                                               */
/* -------------------------------------------------------------------------- */

/** Records the provider chooses from. An array, or anything that can load one. */
export type PromotionSource =
  | readonly Promotion[]
  | { load: (signal: AbortSignal) => Promise<readonly Promotion[]> }

export type PromotionEvent = {
  /** `copy` is a visitor copying the offer's code. */
  type: 'impression' | 'click' | 'dismiss' | 'copy'
  id: string
  placement: PromotionPlacement
  campaign?: string
}

/** Where dismissals live. Values are the epoch ms the visitor dismissed at. */
export type DismissalStore = {
  get: (key: string) => number | null
  set: (
    key: string,
    dismissedAt: number,
    scope: 'session' | 'persistent',
  ) => void
}

export type PromotionLinkProps = {
  href: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
  target?: string
  rel?: string
}

/* -------------------------------------------------------------------------- */
/*  Defaults                                                                  */
/* -------------------------------------------------------------------------- */

function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

/** localStorage for lasting dismissals, sessionStorage for per-visit ones. */
export const browserDismissalStore: DismissalStore = {
  get(key) {
    for (const kind of ['session', 'local'] as const) {
      try {
        const raw = safeStorage(kind)?.getItem(key)
        const value = raw ? Number(raw) : Number.NaN
        if (Number.isFinite(value)) return value
      } catch {
        // Storage can throw in private windows; treat as not dismissed.
      }
    }
    return null
  },
  set(key, dismissedAt, scope) {
    try {
      safeStorage(scope === 'session' ? 'session' : 'local')?.setItem(
        key,
        String(dismissedAt),
      )
    } catch {
      // Dismissal still applies for this render via provider state.
    }
  },
}

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
  selection: PromotionSelection
  bar: Promotion | null
  /** The corner, sheet or dialog allowed to show right now, if any. */
  overlay: Promotion | null
  card: (slot: string) => Promotion | null
  dismiss: (promotion: Promotion) => void
  report: (event: PromotionEvent) => void
  Link: React.ComponentType<PromotionLinkProps>
  timeZone?: string
}

const PromotionContext = React.createContext<PromotionContextValue | null>(null)

export function usePromotions(): PromotionContextValue {
  const value = React.useContext(PromotionContext)
  if (!value)
    throw new Error(
      'Promotion components must be rendered inside <PromotionProvider>.',
    )
  return value
}

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

export type PromotionProviderProps = {
  source: PromotionSource
  /** The current route. Pass your router's pathname, e.g. `usePathname()`. */
  pathname: string
  /** Injectable clock for previews and tests. */
  now?: () => number
  /** How often the clock is re-read, so windows open and close on time. */
  tickMs?: number
  storage?: DismissalStore
  /** Route patterns where the bar and overlays never appear (checkout, sign-in). */
  suppressOn?: readonly string[]
  /** Overlays wait for this much time and scroll depth before they may open. */
  engagement?: { delayMs?: number; scrollDepth?: number }
  onEvent?: (event: PromotionEvent) => void
  /** Your framework's link, so internal CTAs navigate client-side. */
  linkComponent?: React.ComponentType<PromotionLinkProps>
  /** Shown next to schedule text in countdowns and editors. */
  timeZone?: string
  children: React.ReactNode
}

function useLoadedRecords(source: PromotionSource): readonly Promotion[] {
  const isArray = Array.isArray(source)
  const [loaded, setLoaded] = React.useState<readonly Promotion[]>([])

  React.useEffect(() => {
    if (Array.isArray(source)) return
    const controller = new AbortController()
    ;(source as Exclude<PromotionSource, readonly Promotion[]>)
      .load(controller.signal)
      .then((records) => {
        if (!controller.signal.aborted) setLoaded(records)
      })
      .catch(() => {
        // A promotion is never worth an error screen. Show nothing.
      })
    return () => controller.abort()
  }, [source])

  return isArray ? (source as readonly Promotion[]) : loaded
}

function createClockStore(now: () => number, tickMs: number) {
  let value = now()
  return {
    subscribe(onChange: () => void) {
      value = now()
      const timer = window.setInterval(() => {
        value = now()
        onChange()
      }, tickMs)
      return () => window.clearInterval(timer)
    },
    get: () => value,
  }
}

const serverClock = () => null

/**
 * The clock as an external store: SSR and hydration read null, so nothing
 * time-dependent renders until the browser's own clock is known.
 */
function useClock(now: () => number, tickMs: number): number | null {
  const store = React.useMemo(
    () => createClockStore(now, tickMs),
    [now, tickMs],
  )
  return React.useSyncExternalStore(store.subscribe, store.get, serverClock)
}

/** Engagement is per page: navigating resets it without a state write. */
function useEngaged(
  pathname: string,
  {
    delayMs = 8000,
    scrollDepth = 0.3,
  }: { delayMs?: number; scrollDepth?: number },
): boolean {
  const [engagedOn, setEngagedOn] = React.useState<string | null>(null)

  React.useEffect(() => {
    let waited = delayMs <= 0
    let scrolled = scrollDepth <= 0
    const check = () => {
      if (waited && scrolled) setEngagedOn(pathname)
    }
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      // A page too short to scroll counts as read.
      const depth = max <= 0 ? 1 : window.scrollY / max
      if (depth >= scrollDepth) {
        scrolled = true
        check()
      }
    }
    const timer = window.setTimeout(() => {
      waited = true
      onScroll()
      check()
    }, delayMs)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
  }, [pathname, delayMs, scrollDepth])

  return engagedOn === pathname
}

/**
 * Exit intent: the pointer leaving through the top of the window, towards the
 * tabs or the address bar. Desktop only; touch screens have no such gesture,
 * so the caller falls back to engagement there.
 */
function useExitIntent(pathname: string): {
  supported: boolean
  fired: boolean
} {
  const [firedOn, setFiredOn] = React.useState<string | null>(null)
  const supported = React.useSyncExternalStore(
    subscribeNever,
    () => window.matchMedia('(hover: hover) and (pointer: fine)').matches,
    () => false,
  )

  React.useEffect(() => {
    if (!supported) return
    const onLeave = (event: MouseEvent) => {
      if (event.relatedTarget === null && event.clientY <= 0)
        setFiredOn(pathname)
    }
    document.addEventListener('mouseout', onLeave)
    return () => document.removeEventListener('mouseout', onLeave)
  }, [pathname, supported])

  return { supported, fired: firedOn === pathname }
}

function subscribeNever() {
  return () => {}
}

const NO_ROUTES: readonly string[] = []
const DEFAULT_ENGAGEMENT: { delayMs?: number; scrollDepth?: number } = {}

export function PromotionProvider({
  source,
  pathname,
  now: readNow = Date.now,
  tickMs = 60_000,
  storage = browserDismissalStore,
  suppressOn = NO_ROUTES,
  engagement = DEFAULT_ENGAGEMENT,
  onEvent,
  linkComponent = DefaultLink,
  timeZone,
  children,
}: PromotionProviderProps) {
  const records = useLoadedRecords(source)
  const now = useClock(readNow, tickMs)
  const engaged = useEngaged(pathname, engagement)
  const exit = useExitIntent(pathname)
  // Dismissals made this render cycle apply immediately, even if storage throws.
  const [dismissedNow, setDismissedNow] = React.useState<ReadonlySet<string>>(
    new Set(),
  )

  const report = React.useCallback(
    (event: PromotionEvent) => onEvent?.(event),
    [onEvent],
  )

  const isDismissed = React.useCallback(
    (promotion: Promotion) => {
      const key = dismissalKey(promotion)
      if (dismissedNow.has(key)) return true
      if (now === null) return true
      const at = storage.get(key)
      if (at === null) return false
      const expiry = dismissalExpiry(promotion.dismiss, at)
      return expiry === null || now < expiry
    },
    [dismissedNow, now, storage],
  )

  const dismiss = React.useCallback(
    (promotion: Promotion) => {
      const key = dismissalKey(promotion)
      storage.set(
        key,
        Date.now(),
        promotion.dismiss.mode === 'session' ? 'session' : 'persistent',
      )
      setDismissedNow((previous) => new Set(previous).add(key))
      report({
        type: 'dismiss',
        id: promotion.id,
        placement: promotion.placement,
        campaign: promotion.campaign,
      })
    },
    [report, storage],
  )

  const value = React.useMemo<PromotionContextValue>(() => {
    const selection =
      now === null
        ? { cards: {} }
        : selectPromotions(records, { pathname, now })
    const suppressed = suppressOn.some((pattern) =>
      matchRoute(pattern, pathname),
    )

    const barCandidate =
      !suppressed && selection.bar && !isDismissed(selection.bar)
        ? selection.bar
        : null
    const overlayCandidate =
      !suppressed && selection.overlay && !isDismissed(selection.overlay)
        ? selection.overlay
        : null

    // An overlay opens on its trigger: exit intent where the device has a
    // pointer, engagement everywhere else.
    const triggered =
      overlayCandidate?.trigger === 'exit-intent' && exit.supported
        ? exit.fired
        : engaged

    // A corner card sits beside the bar. A sheet or dialog takes over the
    // page, so it only opens over a visible bar when its priority is strictly
    // higher, and then the bar steps aside.
    const overlay =
      overlayCandidate &&
      triggered &&
      (!isModal(overlayCandidate.placement) ||
        !barCandidate ||
        overlayCandidate.priority > barCandidate.priority)
        ? overlayCandidate
        : null
    const bar = overlay && isModal(overlay.placement) ? null : barCandidate

    return {
      now,
      selection,
      bar,
      overlay,
      card: (slot) => {
        const candidate = selection.cards[slot]
        return candidate && !isDismissed(candidate) ? candidate : null
      },
      dismiss,
      report,
      Link: linkComponent,
      timeZone,
    }
  }, [
    dismiss,
    engaged,
    exit.fired,
    exit.supported,
    isDismissed,
    linkComponent,
    now,
    pathname,
    records,
    report,
    suppressOn,
    timeZone,
  ])

  return (
    <PromotionContext.Provider value={value}>
      {children}
    </PromotionContext.Provider>
  )
}

/* -------------------------------------------------------------------------- */
/*  Impressions                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Fires once when at least half the element has been visible for a second.
 * Rendering is not an impression; being seen is.
 */
export function useImpression(
  promotion: Promotion | null,
  onImpression: ((promotion: Promotion) => void) | undefined,
) {
  const ref = React.useRef<HTMLElement | null>(null)
  const seen = React.useRef<string | null>(null)

  React.useEffect(() => {
    const element = ref.current
    if (!promotion || !element || !onImpression) return
    if (seen.current === promotion.id) return
    if (typeof IntersectionObserver === 'undefined') return

    let timer: number | undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          timer = window.setTimeout(() => {
            seen.current = promotion.id
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
  }, [promotion, onImpression])

  return ref
}
