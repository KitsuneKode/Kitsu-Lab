/**
 * Promotion core: types and pure rules. No React, no storage, no network, so
 * every rule here is testable with plain data and an injected clock.
 */

/**
 * `sheet` is an offer that waits behind an edge tab and opens only when the
 * visitor asks, so it never counts as an interruption.
 */
export const PROMOTION_PLACEMENTS = [
  'bar',
  'card',
  'toast',
  'sheet',
  'side',
  'spotlight',
  'dialog',
] as const

/**
 * How a dialog presents itself. `center` is the classic modal; `split` puts
 * the image beside the copy for launches; `story` is a full-screen sequence
 * of slides. A story never opens on its own: only `openPromotion(id)`, i.e.
 * a visitor pressing something like "See what's new", can start it.
 */
export const DIALOG_PRESENTATIONS = ['center', 'split', 'story'] as const
export type DialogPresentation = (typeof DIALOG_PRESENTATIONS)[number]
export type PromotionPlacement = (typeof PROMOTION_PLACEMENTS)[number]

export const PROMOTION_TONES = ['neutral', 'brand', 'highlight'] as const
export type PromotionTone = (typeof PROMOTION_TONES)[number]

export const PROMOTION_STATES = [
  'draft',
  'published',
  'paused',
  'archived',
] as const
export type PromotionState = (typeof PROMOTION_STATES)[number]

export type PromotionDeliveryState =
  | 'draft'
  | 'scheduled'
  | 'live'
  | 'paused'
  | 'ended'
  | 'archived'

/**
 * Where a dismissal is remembered. `tab` forgets when the tab closes,
 * `browser` survives restarts, `cookie` is readable by the server (so an
 * inline bar can render without a layout shift), `account` follows a
 * signed-in visitor across devices. The host supplies the stores.
 */
export const DISMISS_SCOPES = ['tab', 'browser', 'cookie', 'account'] as const
export type DismissScope = (typeof DISMISS_SCOPES)[number]

export type PromotionDismiss = (
  | { mode: 'session' }
  | { mode: 'days'; days: number }
  | { mode: 'never-again' }
) & { scope?: DismissScope }

/** Campaign copy in another language. Missing fields fall back to the default. */
export type PromotionCopy = {
  eyebrow?: string
  title?: string
  body?: string
  ctaLabel?: string
}

export type PromotionMedia = {
  src: string
  alt: string
  width: number
  height: number
  /** Shown over the image in stories and under it in galleries. Plain text. */
  caption?: string
}

export type PromotionCta = {
  label: string
  href: string
  external?: boolean
}

/** Bar, toast and dialog interrupt; a card sits in the page's own flow. */
export const INTRUSIVE_PLACEMENTS = ['bar', 'toast', 'dialog'] as const
export type IntrusivePlacement = (typeof INTRUSIVE_PLACEMENTS)[number]

/** What an editor produces. Identity and lifecycle fields are added by the host. */
export type PromotionContent = {
  placement: PromotionPlacement
  /** For `card`: the named slot it fills. Ignored for other placements. */
  slot?: string
  eyebrow?: string
  title: string
  body?: string
  media?: PromotionMedia
  /**
   * Up to GALLERY_MAX images shown as a swipeable carousel on cards, sheets
   * and dialogs. `media` stays the single image for compact surfaces.
   */
  gallery?: PromotionMedia[]
  cta?: PromotionCta
  /** A code the visitor can copy, e.g. `NIGHT20`. Shown with a copy button. */
  code?: string
  tone: PromotionTone
  /** Route patterns such as `/`, `/courses` or `/courses/*`. Empty means every route. */
  include: string[]
  /** Always wins over `include`. */
  exclude: string[]
  /** Epoch ms. Delivery window is [startsAt, endsAt). */
  startsAt: number
  endsAt: number
  /** 0–100. Higher wins within a placement or slot. */
  priority: number
  dismiss: PromotionDismiss
  /** Only honoured when the window closes within COUNTDOWN_MAX_DAYS. */
  showCountdown?: boolean
  /** Hide the code behind a "Reveal" button: one small, honest commitment. */
  revealCode?: boolean
  /** Dialogs only. Defaults to `center`. */
  presentation?: DialogPresentation
  /**
   * Toast and dialog: at most once every `hours` per visitor, even across
   * tabs and without a dismissal. Defaults to DEFAULT_FREQUENCY_HOURS.
   */
  frequency?: { hours: number }
  /** Copy per locale, e.g. `{ fr: { title: '…' } }`. See localizePromotion. */
  translations?: Record<string, PromotionCopy>
  /** Opaque id handed to analytics callbacks. */
  campaign?: string
}

export type Promotion = PromotionContent & {
  id: string
  state: PromotionState
  /** Bump to show a changed promotion to visitors who dismissed it. */
  dismissalVersion: number
  revision: number
}

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

export const TITLE_MAX = 80
export const BODY_MAX = 320
export const EYEBROW_MAX = 40
export const CTA_LABEL_MAX = 32
export const CODE_MAX = 24
export const GALLERY_MAX = 8
export const COUNTDOWN_MAX_DAYS = 14
/** Industry guidance is at most twice a day; we default to once. */
export const DEFAULT_FREQUENCY_HOURS = 24

/* -------------------------------------------------------------------------- */
/*  Routes                                                                    */
/* -------------------------------------------------------------------------- */

function normalizePath(path: string): string {
  const withoutQuery = path.split(/[?#]/, 1)[0] ?? ''
  const trimmed = withoutQuery.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

/**
 * Matches a pathname against a pattern. Supported forms:
 *   `/courses`    exact
 *   `/courses/*`  any descendant, not `/courses` itself
 *   `/courses/**` `/courses` and any descendant
 *   `*`           everything
 */
export function matchRoute(pattern: string, pathname: string): boolean {
  const path = normalizePath(pathname)
  const p = pattern.trim()
  if (p === '*' || p === '/**') return true
  if (p.endsWith('/**')) {
    const base = normalizePath(p.slice(0, -3))
    return path === base || path.startsWith(base === '/' ? '/' : `${base}/`)
  }
  if (p.endsWith('/*')) {
    const base = normalizePath(p.slice(0, -2))
    const prefix = base === '/' ? '/' : `${base}/`
    return path !== base && path.startsWith(prefix)
  }
  return normalizePath(p) === path
}

export function targetsRoute(
  promotion: Pick<PromotionContent, 'include' | 'exclude'>,
  pathname: string,
): boolean {
  if (promotion.exclude.some((pattern) => matchRoute(pattern, pathname)))
    return false
  if (promotion.include.length === 0) return true
  return promotion.include.some((pattern) => matchRoute(pattern, pathname))
}

/* -------------------------------------------------------------------------- */
/*  Lifecycle                                                                 */
/* -------------------------------------------------------------------------- */

/** Publishing never bypasses the schedule. */
export function deliveryState(
  promotion: Pick<Promotion, 'state' | 'startsAt' | 'endsAt'>,
  now: number,
): PromotionDeliveryState {
  if (promotion.state !== 'published') return promotion.state
  if (!Number.isFinite(now) || now >= promotion.endsAt) return 'ended'
  if (now < promotion.startsAt) return 'scheduled'
  return 'live'
}

export function countdownVisible(
  promotion: Pick<Promotion, 'showCountdown' | 'endsAt'>,
  now: number,
): boolean {
  if (!promotion.showCountdown) return false
  const remaining = promotion.endsAt - now
  return remaining > 0 && remaining <= COUNTDOWN_MAX_DAYS * DAY
}

/** Whole units left until `endsAt`, for a quiet "Ends in 3 days" label. */
export function timeLeft(
  endsAt: number,
  now: number,
): { unit: 'day' | 'hour' | 'minute'; value: number } | null {
  const remaining = endsAt - now
  if (remaining <= 0) return null
  if (remaining >= DAY)
    return { unit: 'day', value: Math.floor(remaining / DAY) }
  if (remaining >= 60 * MINUTE)
    return { unit: 'hour', value: Math.floor(remaining / (60 * MINUTE)) }
  return { unit: 'minute', value: Math.max(1, Math.floor(remaining / MINUTE)) }
}

export function formatTimeLeft(endsAt: number, now: number): string | null {
  const left = timeLeft(endsAt, now)
  if (!left) return null
  return `Ends in ${left.value} ${left.unit}${left.value === 1 ? '' : 's'}`
}

/* -------------------------------------------------------------------------- */
/*  Selection                                                                 */
/* -------------------------------------------------------------------------- */

export type PromotionSelection = {
  /** Every live, targeted record, best first. For carousels and the inbox. */
  live: Promotion[]
  bar?: Promotion
  toast?: Promotion
  sheet?: Promotion
  side?: Promotion
  /** One spotlight at a time; its `slot` names the anchor it points at. */
  spotlight?: Promotion
  dialog?: Promotion
  cards: Record<string, Promotion>
}

function beats(candidate: Promotion, current: Promotion | undefined) {
  if (!current) return true
  if (candidate.priority !== current.priority)
    return candidate.priority > current.priority
  return candidate.id < current.id
}

/**
 * At most one bar, one toast, one dialog and one card per slot for this route and time.
 * Priority first, then id, so the result is stable across renders and servers.
 * Never mutates the input.
 */
export function selectPromotions(
  promotions: readonly Promotion[],
  { pathname, now }: { pathname: string; now: number },
): PromotionSelection {
  const live = promotions
    .filter(
      (promotion) =>
        deliveryState(promotion, now) === 'live' &&
        targetsRoute(promotion, pathname),
    )
    .sort((a, b) => (beats(a, b) ? -1 : 1))
  const selection: PromotionSelection = { live, cards: {} }
  for (const promotion of live) {
    if (promotion.placement === 'card') {
      const slot = promotion.slot ?? 'default'
      if (beats(promotion, selection.cards[slot]))
        selection.cards[slot] = promotion
    } else if (beats(promotion, selection[promotion.placement])) {
      selection[promotion.placement] = promotion
    }
  }
  return selection
}

/** Every live card for a slot, best first: the carousel's slides. */
export function slotPromotions(
  selection: Pick<PromotionSelection, 'live'>,
  slot: string,
): Promotion[] {
  return selection.live.filter(
    (promotion) =>
      promotion.placement === 'card' && (promotion.slot ?? 'default') === slot,
  )
}

/** Two records belong to one campaign only when both name it. */
export function sharesCampaign(
  a: Pick<Promotion, 'campaign'> | null | undefined,
  b: Pick<Promotion, 'campaign'> | null | undefined,
): boolean {
  return Boolean(a?.campaign && b?.campaign && a.campaign === b.campaign)
}

/**
 * The offers worth listing in an inbox: live records with something to do
 * (a button or a code), one per campaign, best first. Cards filling layout
 * slots such as a sticky bar stay out unless they carry a code.
 */
export function inboxPromotions(
  selection: Pick<PromotionSelection, 'live'>,
): Promotion[] {
  const seen = new Set<string>()
  const out: Promotion[] = []
  for (const promotion of selection.live) {
    if (!promotion.cta && !promotion.code) continue
    if (promotion.placement === 'card' && !promotion.code) continue
    const key = promotion.campaign ?? `id:${promotion.id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(promotion)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/*  Dismissal                                                                 */
/* -------------------------------------------------------------------------- */

/** Copy edits keep the key; a deliberate dismissalVersion bump changes it. */
export function dismissalKey(
  promotion: Pick<Promotion, 'id' | 'dismissalVersion'>,
): string {
  return `promo:${encodeURIComponent(promotion.id)}:${promotion.dismissalVersion}`
}

/** The store a dismissal goes to. `session` dismissals default to the tab. */
export function dismissScope(dismiss: PromotionDismiss): DismissScope {
  return dismiss.scope ?? (dismiss.mode === 'session' ? 'tab' : 'browser')
}

/**
 * Whether a floating surface last shown at `lastShownAt` may show again.
 * Frequency is separate from dismissal: an ignored toast is not a rejected
 * one, but it still should not come back on every page.
 */
export function frequencyAllows(
  lastShownAt: number | null,
  now: number,
  hours: number = DEFAULT_FREQUENCY_HOURS,
): boolean {
  if (lastShownAt === null || !Number.isFinite(lastShownAt)) return true
  return now - lastShownAt >= hours * 60 * MINUTE
}

/**
 * The best translation for `locale`: an exact tag, then its language
 * (`fr-CA` → `fr`), then the record's own copy.
 */
export function localizePromotion<T extends PromotionContent>(
  promotion: T,
  locale: string | undefined,
): T {
  const table = promotion.translations
  if (!locale || !table) return promotion
  const copy = table[locale] ?? table[locale.split('-')[0] ?? '']
  if (!copy) return promotion
  return {
    ...promotion,
    ...(copy.eyebrow ? { eyebrow: copy.eyebrow } : {}),
    ...(copy.title ? { title: copy.title } : {}),
    ...(copy.body ? { body: copy.body } : {}),
    ...(copy.ctaLabel && promotion.cta
      ? { cta: { ...promotion.cta, label: copy.ctaLabel } }
      : {}),
  }
}

/** When a dismissal recorded at `dismissedAt` stops applying, or null for never. */
export function dismissalExpiry(
  dismiss: PromotionDismiss,
  dismissedAt: number,
): number | null {
  if (dismiss.mode === 'days') return dismissedAt + dismiss.days * DAY
  return null
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

export type PromotionParseOptions = {
  isAllowedHref?: (href: string) => boolean
  /** Image sources. Defaults to the href rule, not a host's narrowed CTA list. */
  isAllowedMediaSrc?: (src: string) => boolean
  isAllowedRoute?: (pattern: string) => boolean
  maxWindowDays?: number
}

export type PromotionParseResult =
  | { ok: true; value: PromotionContent }
  | { ok: false; errors: Partial<Record<PromotionField, string>> }

export type PromotionField =
  | 'form'
  | 'placement'
  | 'slot'
  | 'eyebrow'
  | 'title'
  | 'body'
  | 'media'
  | 'gallery'
  | 'cta.label'
  | 'cta.href'
  | 'code'
  | 'tone'
  | 'include'
  | 'exclude'
  | 'startsAt'
  | 'endsAt'
  | 'priority'
  | 'dismiss'
  | 'frequency'
  | 'translations'

const SAFE_HREF = /^(\/(?![/\\])|https:\/\/|tel:|mailto:)/i

/**
 * Same-site paths, https, tel: and mailto:. Backslashes are refused outright:
 * browsers read `/\\evil.com` as `//evil.com`, an open redirect.
 */
export function defaultIsAllowedHref(href: string): boolean {
  // oxlint-disable-next-line no-control-regex
  return SAFE_HREF.test(href) && !/[\s<>"\\\u0000-\u001f]/.test(href)
}

function defaultIsAllowedRoute(pattern: string): boolean {
  return pattern === '*' || /^\/[\w\-/.*]*$/.test(pattern)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Plain text only. Renderers use React text nodes, never an HTML sink. */
function plainText(
  value: unknown,
  max: number,
  required: boolean,
): { ok: true; value: string | undefined } | { ok: false } {
  if (value === undefined || value === null || value === '') {
    return required ? { ok: false } : { ok: true, value: undefined }
  }
  if (typeof value !== 'string') return { ok: false }
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (trimmed.length === 0)
    return required ? { ok: false } : { ok: true, value: undefined }
  if (trimmed.length > max || /[<>]/.test(trimmed)) return { ok: false }
  return { ok: true, value: trimmed }
}

function isInt(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  )
}

function isTime(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}

function routeList(
  value: unknown,
  allowed: (pattern: string) => boolean,
): string[] | null {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 24) return null
  const routes: string[] = []
  for (const item of value) {
    if (typeof item !== 'string') return null
    const pattern = item.trim()
    if (!pattern || !allowed(pattern)) return null
    routes.push(pattern)
  }
  return [...new Set(routes)]
}

function parseDismiss(value: unknown): PromotionDismiss | null {
  if (!isRecord(value)) return null
  if (
    value.scope !== undefined &&
    !DISMISS_SCOPES.some((s) => s === value.scope)
  )
    return null
  const scope =
    value.scope === undefined ? {} : { scope: value.scope as DismissScope }
  if (value.mode === 'session') return { mode: 'session', ...scope }
  if (value.mode === 'never-again') return { mode: 'never-again', ...scope }
  if (value.mode === 'days' && isInt(value.days, 1, 365))
    return { mode: 'days', days: value.days, ...scope }
  return null
}

const LOCALE_TAG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/

function parseTranslations(
  value: unknown,
): Record<string, PromotionCopy> | undefined | null {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) return null
  const entries = Object.entries(value)
  if (entries.length > 24) return null
  const out: Record<string, PromotionCopy> = {}
  for (const [locale, raw] of entries) {
    if (!LOCALE_TAG.test(locale) || !isRecord(raw)) return null
    const eyebrow = plainText(raw.eyebrow, EYEBROW_MAX, false)
    const title = plainText(raw.title, TITLE_MAX, false)
    const body = plainText(raw.body, BODY_MAX, false)
    const ctaLabel = plainText(raw.ctaLabel, CTA_LABEL_MAX, false)
    if (!eyebrow.ok || !title.ok || !body.ok || !ctaLabel.ok) return null
    out[locale] = {
      ...(eyebrow.value ? { eyebrow: eyebrow.value } : {}),
      ...(title.value ? { title: title.value } : {}),
      ...(body.value ? { body: body.value } : {}),
      ...(ctaLabel.value ? { ctaLabel: ctaLabel.value } : {}),
    }
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Validates untrusted editor input. Run it on the client for instant feedback
 * and again on the server before saving; the server's answer wins.
 */
export function parsePromotion(
  input: unknown,
  options: PromotionParseOptions = {},
): PromotionParseResult {
  if (!isRecord(input))
    return { ok: false, errors: { form: 'Enter the promotion details.' } }

  const isAllowedHref = options.isAllowedHref ?? defaultIsAllowedHref
  const isAllowedMediaSrc = options.isAllowedMediaSrc ?? defaultIsAllowedHref
  const isAllowedRoute = options.isAllowedRoute ?? defaultIsAllowedRoute
  const maxWindowDays = options.maxWindowDays ?? 365
  const errors: Partial<Record<PromotionField, string>> = {}

  const placement = PROMOTION_PLACEMENTS.find((p) => p === input.placement)
  if (!placement) errors.placement = 'Choose where the promotion appears.'

  const slot = plainText(input.slot, 40, false)
  if (!slot.ok) errors.slot = 'Use a short slot name.'

  const eyebrow = plainText(input.eyebrow, EYEBROW_MAX, false)
  if (!eyebrow.ok)
    errors.eyebrow = `Keep the label under ${EYEBROW_MAX} characters of plain text.`

  const title = plainText(input.title, TITLE_MAX, true)
  if (!title.ok)
    errors.title = `Write a title of 1–${TITLE_MAX} characters, plain text.`

  const body = plainText(input.body, BODY_MAX, false)
  if (!body.ok)
    errors.body = `Keep the message under ${BODY_MAX} characters of plain text.`

  const tone = PROMOTION_TONES.find((t) => t === input.tone) ?? 'neutral'

  let cta: PromotionCta | undefined
  if (input.cta !== undefined && input.cta !== null) {
    const raw = isRecord(input.cta) ? input.cta : {}
    const label = plainText(raw.label, CTA_LABEL_MAX, true)
    const href = typeof raw.href === 'string' ? raw.href.trim() : ''
    if (!label.ok)
      errors['cta.label'] = `Button text needs 1–${CTA_LABEL_MAX} characters.`
    if (!href || !isAllowedHref(href))
      errors['cta.href'] = 'Choose an allowed link.'
    if (label.ok && label.value && href && isAllowedHref(href)) {
      cta = {
        label: label.value,
        href,
        ...(raw.external === true || /^https:/i.test(href)
          ? { external: true }
          : {}),
      }
    }
  }

  const parseMedia = (value: unknown): PromotionMedia | null => {
    const raw = isRecord(value) ? value : {}
    const alt = plainText(raw.alt, 160, true)
    if (
      typeof raw.src !== 'string' ||
      !isAllowedMediaSrc(raw.src) ||
      !alt.ok ||
      !isInt(raw.width, 1, 10_000) ||
      !isInt(raw.height, 1, 10_000)
    )
      return null
    const caption = plainText(raw.caption, 120, false)
    if (!caption.ok) return null
    return {
      src: raw.src,
      alt: alt.value ?? '',
      width: raw.width,
      height: raw.height,
      ...(caption.value ? { caption: caption.value } : {}),
    }
  }

  let media: PromotionMedia | undefined
  if (input.media !== undefined && input.media !== null) {
    media = parseMedia(input.media) ?? undefined
    if (!media) errors.media = 'Images need a source, a description and a size.'
  }

  let gallery: PromotionMedia[] | undefined
  if (input.gallery !== undefined && input.gallery !== null) {
    const items = Array.isArray(input.gallery)
      ? input.gallery.map(parseMedia)
      : [null]
    if (items.length > GALLERY_MAX || items.some((item) => item === null))
      errors.gallery = `Up to ${GALLERY_MAX} images, each with a source, a description and a size.`
    else if (items.length > 0) gallery = items as PromotionMedia[]
  }

  let code: string | undefined
  if (input.code !== undefined && input.code !== null && input.code !== '') {
    const raw = typeof input.code === 'string' ? input.code.trim() : ''
    if (!new RegExp(`^[A-Za-z0-9_-]{1,${CODE_MAX}}$`).test(raw))
      errors.code = `Codes are 1–${CODE_MAX} letters, digits, - or _.`
    else code = raw.toUpperCase()
  }

  const include = routeList(input.include, isAllowedRoute)
  if (!include) errors.include = 'Choose pages from the allowed list.'
  const exclude = routeList(input.exclude, isAllowedRoute)
  if (!exclude) errors.exclude = 'Choose pages from the allowed list.'

  const { startsAt, endsAt } = input
  if (!isTime(startsAt)) errors.startsAt = 'Choose a start time.'
  if (!isTime(endsAt)) errors.endsAt = 'Choose an end time.'
  if (isTime(startsAt) && isTime(endsAt)) {
    if (endsAt <= startsAt) errors.endsAt = 'End after the start.'
    else if (endsAt - startsAt > maxWindowDays * DAY)
      errors.endsAt = `Keep the window within ${maxWindowDays} days.`
  }

  const priority = input.priority ?? 50
  if (!isInt(priority, 0, 100))
    errors.priority = 'Use a whole number from 0 to 100.'

  const dismiss = parseDismiss(input.dismiss ?? { mode: 'days', days: 7 })
  if (!dismiss)
    errors.dismiss = 'Choose how long a dismissal lasts (1–365 days).'

  const rawFrequency = isRecord(input.frequency)
    ? input.frequency.hours
    : undefined
  if (input.frequency !== undefined && !isInt(rawFrequency, 1, 24 * 90))
    errors.frequency = 'Show it at most once every 1 to 2160 hours.'

  const translations = parseTranslations(input.translations)
  if (translations === null)
    errors.translations =
      'Translations need locale codes like fr or pt-BR and plain-text copy.'

  if (
    Object.keys(errors).length > 0 ||
    !placement ||
    !title.ok ||
    !title.value ||
    !include ||
    !exclude ||
    !isTime(startsAt) ||
    !isTime(endsAt) ||
    !isInt(priority, 0, 100) ||
    !dismiss
  ) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    value: {
      placement,
      ...(placement === 'card' || placement === 'spotlight'
        ? { slot: (slot.ok && slot.value) || 'default' }
        : {}),
      ...(eyebrow.ok && eyebrow.value ? { eyebrow: eyebrow.value } : {}),
      title: title.value,
      ...(body.ok && body.value ? { body: body.value } : {}),
      ...(media ? { media } : {}),
      ...(gallery ? { gallery } : {}),
      ...(cta ? { cta } : {}),
      ...(code ? { code } : {}),
      tone,
      include,
      exclude,
      startsAt,
      endsAt,
      priority,
      dismiss,
      ...(input.showCountdown === true ? { showCountdown: true } : {}),
      ...(code && input.revealCode === true ? { revealCode: true } : {}),
      ...(placement === 'dialog' &&
      DIALOG_PRESENTATIONS.some((p) => p === input.presentation) &&
      input.presentation !== 'center'
        ? { presentation: input.presentation as DialogPresentation }
        : {}),
      ...(isInt(rawFrequency, 1, 24 * 90)
        ? { frequency: { hours: rawFrequency } }
        : {}),
      ...(translations ? { translations } : {}),
      ...(typeof input.campaign === 'string' && input.campaign.trim()
        ? { campaign: input.campaign.trim().slice(0, 64) }
        : {}),
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Untrusted records                                                         */
/* -------------------------------------------------------------------------- */

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

/**
 * Structural check for a stored record. The provider usually sits in the root
 * layout, so one malformed row from a CMS must be dropped, not crash the app.
 */
const optionalString = (value: unknown) =>
  value === undefined || typeof value === 'string'

export function isPromotion(value: unknown): value is Promotion {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    value.id !== '' &&
    PROMOTION_STATES.some((state) => state === value.state) &&
    PROMOTION_PLACEMENTS.some((placement) => placement === value.placement) &&
    typeof value.title === 'string' &&
    // Everything that renders as text must be text, or React throws.
    optionalString(value.eyebrow) &&
    optionalString(value.body) &&
    optionalString(value.code) &&
    optionalString(value.slot) &&
    optionalString(value.campaign) &&
    (value.translations === undefined ||
      parseTranslations(value.translations) !== null) &&
    (value.frequency === undefined ||
      (isRecord(value.frequency) &&
        isInt(value.frequency.hours, 1, 24 * 90))) &&
    (value.presentation === undefined ||
      DIALOG_PRESENTATIONS.some((p) => p === value.presentation)) &&
    PROMOTION_TONES.some((tone) => tone === value.tone) &&
    isStringArray(value.include) &&
    isStringArray(value.exclude) &&
    isTime(value.startsAt) &&
    isTime(value.endsAt) &&
    typeof value.priority === 'number' &&
    Number.isFinite(value.priority) &&
    parseDismiss(value.dismiss) !== null &&
    typeof value.dismissalVersion === 'number' &&
    (value.cta === undefined ||
      (isRecord(value.cta) &&
        typeof value.cta.label === 'string' &&
        typeof value.cta.href === 'string' &&
        defaultIsAllowedHref(value.cta.href))) &&
    (value.gallery === undefined ||
      (Array.isArray(value.gallery) &&
        value.gallery.every(
          (item) =>
            isRecord(item) &&
            typeof item.src === 'string' &&
            typeof item.alt === 'string' &&
            optionalString(item.caption),
        ))) &&
    (value.media === undefined ||
      (isRecord(value.media) &&
        typeof value.media.src === 'string' &&
        typeof value.media.alt === 'string'))
  )
}

/** Keeps the well-formed records and drops the rest, preserving order. */
export function sanitizePromotions(records: unknown): Promotion[] {
  return Array.isArray(records) ? records.filter(isPromotion) : []
}

/**
 * The next instant any published record starts or ends after `now`, so a
 * clock can wake exactly on a boundary instead of polling. Null when none.
 */
export function nextBoundary(
  promotions: readonly Pick<Promotion, 'state' | 'startsAt' | 'endsAt'>[],
  now: number,
): number | null {
  let next: number | null = null
  for (const promotion of promotions) {
    if (promotion.state !== 'published') continue
    for (const edge of [promotion.startsAt, promotion.endsAt]) {
      if (edge > now && (next === null || edge < next)) next = edge
    }
  }
  return next
}

/* -------------------------------------------------------------------------- */
/*  Time zones                                                                */
/* -------------------------------------------------------------------------- */

const pad = (n: number) => String(n).padStart(2, '0')

/** Offset of `timeZone` from UTC at instant `ms`, in ms (IST is +19_800_000). */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(ms)
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  )
  return asUtc - (ms - (ms % 1000))
}

/**
 * Formats an instant for `<input type="datetime-local">` as wall-clock time in
 * `timeZone` (the browser's zone when omitted). The input itself has no zone,
 * so an editor showing IST must convert here, not trust the browser.
 */
export function toZonedInput(ms: number, timeZone?: string): string {
  const date = new Date(timeZone ? ms + zoneOffset(ms, timeZone) : ms)
  const [y, mo, d, h, mi] = timeZone
    ? [
        date.getUTCFullYear(),
        date.getUTCMonth() + 1,
        date.getUTCDate(),
        date.getUTCHours(),
        date.getUTCMinutes(),
      ]
    : [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
      ]
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${pad(mi)}`
}

/**
 * Reads a `datetime-local` value as wall-clock time in `timeZone`. Across a
 * daylight-saving jump the offset is re-read at the result, so a time in the
 * skipped hour lands just after the jump rather than an hour off.
 */
export function fromZonedInput(
  value: string,
  timeZone?: string,
): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  if (!match) return undefined
  const [y, mo, d, h, mi] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ]
  if (!timeZone) {
    const ms = new Date(y, mo - 1, d, h, mi).getTime()
    return Number.isFinite(ms) ? ms : undefined
  }
  const wall = Date.UTC(y, mo - 1, d, h, mi)
  const first = wall - zoneOffset(wall, timeZone)
  return wall - zoneOffset(first, timeZone)
}

/* -------------------------------------------------------------------------- */
/*  Review helpers                                                            */
/* -------------------------------------------------------------------------- */

export type PromotionWarning = {
  code:
    | 'long-countdown'
    | 'external-cta'
    | 'dialog-overlap'
    | 'everywhere-dialog'
    | 'dialog-without-cta'
    | 'toast-overlap'
  message: string
}

function routeBase(pattern: string): string {
  return pattern.replace(/\/\*\*?$/, '') || '/'
}

/**
 * Whether two targetings could ever meet on one page. Conservative: when in
 * doubt it says yes, because a missed overlap is worse than a spare warning.
 */
export function routesMayOverlap(
  a: Pick<PromotionContent, 'include'>,
  b: Pick<PromotionContent, 'include'>,
): boolean {
  if (a.include.length === 0 || b.include.length === 0) return true
  return a.include.some((pa) =>
    b.include.some(
      (pb) =>
        pa === pb ||
        matchRoute(pa, routeBase(pb)) ||
        matchRoute(pb, routeBase(pa)) ||
        matchRoute(pa, `${routeBase(pb)}/x`) ||
        matchRoute(pb, `${routeBase(pa)}/x`),
    ),
  )
}

export type ReviewOptions = {
  /** The record being edited, so it never warns about overlapping itself. */
  id?: string
}

/**
 * Taste checks. These never block saving; they tell a reviewer what might
 * make the page louder than intended.
 */
export function reviewPromotion(
  draft: PromotionContent,
  others: readonly Promotion[] = [],
  now = Date.now(),
  { id }: ReviewOptions = {},
): PromotionWarning[] {
  const warnings: PromotionWarning[] = []
  if (
    draft.showCountdown &&
    draft.endsAt - Math.max(now, draft.startsAt) > COUNTDOWN_MAX_DAYS * DAY
  )
    warnings.push({
      code: 'long-countdown',
      message: `The countdown only appears in the last ${COUNTDOWN_MAX_DAYS} days.`,
    })
  if (draft.cta?.external)
    warnings.push({
      code: 'external-cta',
      message: 'The button leaves this site.',
    })
  if (draft.placement === 'dialog' && draft.include.length === 0)
    warnings.push({
      code: 'everywhere-dialog',
      message:
        'A dialog on every page is the loudest option. Consider targeting the pages it is about.',
    })
  if (draft.placement === 'dialog' && !draft.cta && !draft.code)
    warnings.push({
      code: 'dialog-without-cta',
      message:
        'A dialog with nothing to do only interrupts. Add a button, or use a bar or toast.',
    })
  if (draft.placement === 'dialog' || draft.placement === 'toast') {
    const overlapping = others.find(
      (other) =>
        other.id !== id &&
        other.placement === draft.placement &&
        other.state === 'published' &&
        other.startsAt < draft.endsAt &&
        draft.startsAt < other.endsAt &&
        routesMayOverlap(draft, other),
    )
    if (overlapping)
      warnings.push({
        code: draft.placement === 'dialog' ? 'dialog-overlap' : 'toast-overlap',
        message: `“${overlapping.title}” is also a ${draft.placement} on these pages in this window. Only the higher priority one shows.`,
      })
  }
  return warnings
}

/** "Mon 29 Sep, 9:00 am → Sun 5 Oct, 11:59 pm GMT+5:30 (7 days)" in the given zone. */
export function describeSchedule(
  startsAt: number,
  endsAt: number,
  { timeZone, locale }: { timeZone?: string; locale?: string } = {},
): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }
  const start = new Intl.DateTimeFormat(locale, options)
  const end = new Intl.DateTimeFormat(locale, {
    ...options,
    timeZoneName: 'short',
  })
  const days = Math.max(1, Math.round((endsAt - startsAt) / DAY))
  return `${start.format(startsAt)} → ${end.format(endsAt)} (${days} day${days === 1 ? '' : 's'})`
}
