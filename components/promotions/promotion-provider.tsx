'use client'

import * as React from 'react'

import {
  dismissalExpiry,
  dismissalKey,
  matchRoute,
  nextBoundary,
  sanitizePromotions,
  selectPromotions,
  targetsRoute,
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
  | { load: (signal: AbortSignal) => Promise<readonly unknown[]> }

export type PromotionEvent = {
  type: 'impression' | 'click' | 'dismiss' | 'copy'
  id: string
  placement: PromotionPlacement
  campaign?: string
  /** The route the visitor was on, so conversions can be attributed per page. */
  pathname: string
}

/** Where dismissals live. Values are the epoch ms the visitor dismissed at. */
export type DismissalStore = {
  get: (key: string) => number | null
  set: (
    key: string,
    dismissedAt: number,
    scope: 'session' | 'persistent',
  ) => void
  /** Optional: call `onChange` when another tab writes, so dismissals sync. */
  subscribe?: (onChange: () => void) => () => void
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
  subscribe(onChange) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('promo:')) onChange()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
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
  pathname: string
  selection: PromotionSelection
  bar: Promotion | null
  toast: Promotion | null
  /** The toast is folded into a small chip the visitor can reopen. */
  toastMinimized: boolean
  dialog: Promotion | null
  card: (slot: string) => Promotion | null
  /** Live promotions on this route whose button points at `href`. */
  pointingAt: (href: string) => Promotion | null
  dismiss: (promotion: Promotion) => void
  /** Closes a surface after its button was used. Not reported as a dismissal. */
  complete: (promotion: Promotion) => void
  minimize: (promotion: Promotion) => void
  restore: (promotion: Promotion) => void
  /** Opens a live toast or dialog now, skipping the engagement wait. */
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
  /** Also open when a desktop pointer leaves through the top of the window. */
  exitIntent?: boolean
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
  /** Your framework's link, so internal CTAs navigate client-side. */
  linkComponent?: React.ComponentType<PromotionLinkProps>
  labels?: Partial<PromotionLabels>
  /** Shown next to schedule text in countdowns and editors. */
  timeZone?: string
  children: React.ReactNode
}

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
  records: readonly Promotion[],
) {
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
        const edge = nextBoundary(records, current)
        const untilEdge = edge === null ? tickMs : edge - current + 20
        timer = window.setTimeout(
          tick,
          Math.max(250, Math.min(tickMs, untilEdge)),
        )
      }
      const onVisible = () => {
        if (!isHidden()) tick()
      }
      value = now()
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
  const store = React.useMemo(
    () => createClockStore(now, tickMs, records),
    [now, tickMs, records],
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
  {
    delayMs = 8000,
    scrollDepth = 0.3,
    exitIntent = false,
  }: PromotionEngagement,
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
    const onLeave = (event: MouseEvent) => {
      if (event.relatedTarget === null && event.clientY <= 0) engage()
    }
    const timer = Number.isFinite(delayMs)
      ? window.setTimeout(() => {
          waited = true
          onScroll()
          check()
        }, delayMs)
      : undefined
    window.addEventListener('scroll', onScroll, { passive: true })
    if (exitIntent) document.addEventListener('mouseout', onLeave)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(retry)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('mouseout', onLeave)
    }
  }, [pathname, enabled, delayMs, scrollDepth, exitIntent])

  return engagedOn === pathname
}

const NO_ROUTES: readonly string[] = []
const DEFAULT_DIALOG_ENGAGEMENT: PromotionEngagement = {}
const DEFAULT_TOAST_ENGAGEMENT: PromotionEngagement = {
  delayMs: 4000,
  scrollDepth: 0.15,
}
const NO_LABELS: Partial<PromotionLabels> = {}

const shownKey = (promotion: Promotion) => `${dismissalKey(promotion)}:shown`
const minimizedKey = (promotion: Promotion) => `${dismissalKey(promotion)}:min`

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
  timeZone,
  children,
}: PromotionProviderProps) {
  const records = useLoadedRecords(source, sourceKey)
  const now = useClock(readNow, tickMs, records)
  // Local writes, so a dismissal applies at once even if storage throws.
  const [written, setWritten] = React.useState<ReadonlyMap<string, number>>(
    () => new Map(),
  )
  // Bumped when another tab writes, so reads are redone.
  const [storageVersion, setStorageVersion] = React.useState(0)
  const [forced, setForced] = React.useState<string | null>(null)
  const [openFloating, setOpenFloating] = React.useState<{
    id: string
    pathname: string
  } | null>(null)

  React.useEffect(
    () => storage.subscribe?.(() => setStorageVersion((v) => v + 1)),
    [storage],
  )

  const read = React.useCallback(
    (key: string) => {
      // Re-read after a cross-tab write bumps the version.
      void storageVersion
      const value = written.has(key) ? written.get(key) : storage.get(key)
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    },
    [written, storage, storageVersion],
  )
  const write = React.useCallback(
    (key: string, scope: 'session' | 'persistent') => {
      const at = readNow()
      storage.set(key, at, scope)
      setWritten((previous) => new Map(previous).set(key, at))
    },
    [readNow, storage],
  )

  const onEventRef = React.useRef(onEvent)
  React.useLayoutEffect(() => {
    onEventRef.current = onEvent
  })
  const report = React.useCallback<PromotionContextValue['report']>(
    (type, promotion) =>
      onEventRef.current?.({
        type,
        id: promotion.id,
        placement: promotion.placement,
        campaign: promotion.campaign,
        pathname,
      }),
    [pathname],
  )

  const isDismissed = React.useCallback(
    (promotion: Promotion) => {
      if (now === null) return true
      const at = read(dismissalKey(promotion))
      if (at === null) return false
      const expiry = dismissalExpiry(promotion.dismiss, at)
      return expiry === null || now < expiry
    },
    [now, read],
  )

  const close = React.useCallback(
    (promotion: Promotion) => {
      write(
        dismissalKey(promotion),
        promotion.dismiss.mode === 'session' ? 'session' : 'persistent',
      )
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
        ? { cards: {} }
        : selectPromotions(records, { pathname, now }),
    [now, pathname, records],
  )
  const available = (promotion: Promotion | undefined) =>
    !suppressed && promotion && !isDismissed(promotion) ? promotion : null

  const barCandidate = available(selection.bar)
  const toastCandidate = available(selection.toast)
  const dialogCandidate = available(selection.dialog)

  // A floating surface opens once per visit. If it vanished without being
  // answered (the visitor navigated away), it does not chase them.
  const stillOpen = (promotion: Promotion) =>
    openFloating?.id === promotion.id && openFloating.pathname === pathname
  const fresh = (promotion: Promotion | null) =>
    promotion &&
    (forced === promotion.id ||
      stillOpen(promotion) ||
      read(shownKey(promotion)) === null)
      ? promotion
      : null

  const dialogEngaged = useEngaged(
    pathname,
    Boolean(fresh(dialogCandidate)),
    dialogEngagement,
  )
  const toastEngaged = useEngaged(
    pathname,
    Boolean(fresh(toastCandidate)),
    toastEngagement,
  )

  // A floating surface only joins a visible bar when it outranks it. The bar
  // never steps aside: it is in the page flow, and moving it shifts layout.
  const outranksBar = (promotion: Promotion) =>
    !barCandidate || promotion.priority > barCandidate.priority
  const dialog =
    dialogCandidate &&
    fresh(dialogCandidate) &&
    (forced === dialogCandidate.id ||
      stillOpen(dialogCandidate) ||
      (dialogEngaged && outranksBar(dialogCandidate)))
      ? dialogCandidate
      : null
  // An ignored toast does not vanish on the next page, nor chase the visitor
  // at full size: it folds into a chip for the rest of the visit.
  const toastOpenNow = Boolean(
    toastCandidate &&
    (forced === toastCandidate.id || stillOpen(toastCandidate)),
  )
  const toastShownBefore = Boolean(
    toastCandidate && read(shownKey(toastCandidate)) !== null,
  )
  const toastMinimized = Boolean(
    toastCandidate &&
    !toastOpenNow &&
    (toastShownBefore || read(minimizedKey(toastCandidate)) !== null),
  )
  const toast =
    !dialog &&
    toastCandidate &&
    (toastMinimized ||
      toastOpenNow ||
      (toastEngaged && outranksBar(toastCandidate)))
      ? toastCandidate
      : null

  const value: PromotionContextValue = {
    now,
    pathname,
    selection,
    bar: barCandidate,
    toast,
    toastMinimized: Boolean(toast) && toastMinimized,
    dialog,
    card: (slot) => {
      const candidate = selection.cards[slot]
      return candidate && !isDismissed(candidate) ? candidate : null
    },
    pointingAt: (href) => {
      if (now === null) return null
      const all = [
        selection.bar,
        selection.toast,
        selection.dialog,
        ...Object.values(selection.cards),
      ]
      return (
        all.find(
          (promotion) =>
            promotion?.cta?.href === href &&
            targetsRoute(promotion, pathname) &&
            !isDismissed(promotion),
        ) ?? null
      )
    },
    dismiss,
    complete: close,
    minimize: (promotion) => {
      write(minimizedKey(promotion), 'session')
      setForced((id) => (id === promotion.id ? null : id))
      setOpenFloating((open) => (open?.id === promotion.id ? null : open))
    },
    restore: (promotion) => {
      // NaN reads as "never written", in this map and in the browser store.
      storage.set(minimizedKey(promotion), Number.NaN, 'session')
      setWritten((previous) =>
        new Map(previous).set(minimizedKey(promotion), Number.NaN),
      )
      setForced(promotion.id)
    },
    openPromotion: setForced,
    markShown: (promotion) => {
      if (stillOpen(promotion)) return
      write(shownKey(promotion), 'session')
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
