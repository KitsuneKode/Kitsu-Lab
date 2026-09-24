/**
 * Promotion core: types and pure rules. No React, no storage, no network, so
 * every rule here is testable with plain data and an injected clock.
 */

/**
 * Where a promotion appears.
 *
 * - `bar`     a slim announcement across the top of the page
 * - `card`    inline, in a named slot the page reserves for it
 * - `corner`  a small floating card in a bottom corner; does not block the page
 * - `sheet`   a side panel for a campaign that needs room (details, offer)
 * - `dialog`  a centred modal, the loudest option
 *
 * `corner`, `sheet` and `dialog` are overlays: at most one shows at a time.
 */
export const PROMOTION_PLACEMENTS = [
  'bar',
  'card',
  'corner',
  'sheet',
  'dialog',
] as const
export type PromotionPlacement = (typeof PROMOTION_PLACEMENTS)[number]

export const OVERLAY_PLACEMENTS = ['corner', 'sheet', 'dialog'] as const
export type PromotionOverlayPlacement = (typeof OVERLAY_PLACEMENTS)[number]

export function isOverlay(
  placement: PromotionPlacement,
): placement is PromotionOverlayPlacement {
  return (OVERLAY_PLACEMENTS as readonly string[]).includes(placement)
}

/** Overlays that take focus and dim the page, so they wait for engagement. */
export function isModal(placement: PromotionPlacement) {
  return placement === 'sheet' || placement === 'dialog'
}

/**
 * When an overlay may open. `engaged` waits for time on page and scroll depth;
 * `exit-intent` waits for the pointer to leave towards the browser chrome on
 * desktop, and falls back to `engaged` on touch devices, which have no such
 * gesture.
 */
export const PROMOTION_TRIGGERS = ['engaged', 'exit-intent'] as const
export type PromotionTrigger = (typeof PROMOTION_TRIGGERS)[number]

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

export type PromotionDismiss =
  | { mode: 'session' }
  | { mode: 'days'; days: number }
  | { mode: 'never-again' }

export type PromotionMedia = {
  src: string
  alt: string
  width: number
  height: number
}

export type PromotionCta = {
  label: string
  href: string
  external?: boolean
}

/**
 * A real offer, shown as structured parts rather than written into the
 * title, so every placement renders it the same way and nothing overstates
 * it. At least one of `percentOff`, `price` or `code` is present.
 */
export type PromotionOffer = {
  /** Whole percent, 1–95. */
  percentOff?: number
  /** Major units (rupees, dollars). `was` must be higher than `amount`. */
  price?: { amount: number; was?: number; currency: string }
  /** Upper-case letters, digits and dashes, 3–24 characters. */
  code?: string
  /** What the offer applies to and any limits. */
  terms?: string
}

/** What an editor produces. Identity and lifecycle fields are added by the host. */
export type PromotionContent = {
  placement: PromotionPlacement
  /** For `card`: the named slot it fills. Ignored for other placements. */
  slot?: string
  eyebrow?: string
  title: string
  body?: string
  media?: PromotionMedia
  cta?: PromotionCta
  offer?: PromotionOffer
  /** Up to five short points, for cards, sheets and dialogs. */
  highlights?: string[]
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
  /** Overlays only. Defaults to `engaged`. */
  trigger?: PromotionTrigger
  /** Only honoured when the window closes within COUNTDOWN_MAX_DAYS. */
  showCountdown?: boolean
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
export const COUNTDOWN_MAX_DAYS = 14
export const HIGHLIGHT_MAX = 80
export const HIGHLIGHTS_MAX = 5
export const TERMS_MAX = 160
export const PERCENT_OFF_MAX = 95

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

/** Time left until `endsAt`, split for display. */
export function timeLeft(
  endsAt: number,
  now: number,
): { days: number; hours: number; minutes: number } | null {
  const remaining = endsAt - now
  if (remaining <= 0) return null
  const minutesTotal = Math.max(1, Math.floor(remaining / MINUTE))
  return {
    days: Math.floor(minutesTotal / (24 * 60)),
    hours: Math.floor((minutesTotal % (24 * 60)) / 60),
    minutes: minutesTotal % 60,
  }
}

/**
 * A quiet, truthful countdown: "Ends in 3 days", "Ends in 5h 20m",
 * "Ends in 12 min". Days are rounded down, so it never claims more time than
 * is left; under a day it gets precise, because that is when it matters.
 */
export function formatTimeLeft(endsAt: number, now: number): string | null {
  const left = timeLeft(endsAt, now)
  if (!left) return null
  if (left.days >= 1)
    return `Ends in ${left.days} day${left.days === 1 ? '' : 's'}`
  if (left.hours >= 1)
    return `Ends in ${left.hours}h${left.minutes ? ` ${left.minutes}m` : ''}`
  return `Ends in ${left.minutes} min`
}

/* -------------------------------------------------------------------------- */
/*  Offers                                                                    */
/* -------------------------------------------------------------------------- */

export function formatPrice(
  amount: number,
  currency: string,
  locale?: string,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount}`
  }
}

/**
 * The one-line badge for an offer: "20% off", "Save ₹2,000", or null when the
 * offer is only a code. A stated percentage wins over a computed saving, so
 * the badge always says what the author wrote.
 */
export function offerBadge(
  offer: PromotionOffer | undefined,
  locale?: string,
): string | null {
  if (!offer) return null
  if (offer.percentOff) return `${offer.percentOff}% off`
  const price = offer.price
  if (price?.was !== undefined && price.was > price.amount)
    return `Save ${formatPrice(price.was - price.amount, price.currency, locale)}`
  return null
}

/* -------------------------------------------------------------------------- */
/*  Selection                                                                 */
/* -------------------------------------------------------------------------- */

export type PromotionSelection = {
  bar?: Promotion
  /** The single corner, sheet or dialog allowed on this page right now. */
  overlay?: Promotion
  cards: Record<string, Promotion>
}

function beats(candidate: Promotion, current: Promotion | undefined) {
  if (!current) return true
  if (candidate.priority !== current.priority)
    return candidate.priority > current.priority
  return candidate.id < current.id
}

/**
 * At most one bar, one overlay (corner, sheet or dialog) and one card per slot
 * for this route and time. Priority first, then id, so the result is stable
 * across renders and servers. Never mutates the input.
 */
export function selectPromotions(
  promotions: readonly Promotion[],
  { pathname, now }: { pathname: string; now: number },
): PromotionSelection {
  const selection: PromotionSelection = { cards: {} }
  for (const promotion of promotions) {
    if (deliveryState(promotion, now) !== 'live') continue
    if (!targetsRoute(promotion, pathname)) continue
    if (promotion.placement === 'card') {
      const slot = promotion.slot ?? 'default'
      if (beats(promotion, selection.cards[slot]))
        selection.cards[slot] = promotion
    } else if (promotion.placement === 'bar') {
      if (beats(promotion, selection.bar)) selection.bar = promotion
    } else if (beats(promotion, selection.overlay)) {
      selection.overlay = promotion
    }
  }
  return selection
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
  /** Where the button may point. Defaults to internal paths, https, tel and mailto. */
  isAllowedHref?: (href: string) => boolean
  /** Where images may load from. Defaults to the same safe forms as links. */
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
  | 'cta.label'
  | 'cta.href'
  | 'offer'
  | 'offer.percentOff'
  | 'offer.price'
  | 'offer.code'
  | 'offer.terms'
  | 'highlights'
  | 'trigger'
  | 'tone'
  | 'include'
  | 'exclude'
  | 'startsAt'
  | 'endsAt'
  | 'priority'
  | 'dismiss'

const SAFE_HREF = /^(\/(?!\/)|https:\/\/|tel:|mailto:)/i

export function defaultIsAllowedHref(href: string): boolean {
  return SAFE_HREF.test(href) && !/[\s<>"]/.test(href)
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
  if (value.mode === 'session') return { mode: 'session' }
  if (value.mode === 'never-again') return { mode: 'never-again' }
  if (value.mode === 'days' && isInt(value.days, 1, 365))
    return { mode: 'days', days: value.days }
  return null
}

type Errors = Partial<Record<PromotionField, string>>

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,23}$/
const CURRENCY_PATTERN = /^[A-Z]{3}$/

function isMoney(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1_000_000_000
  )
}

function parseOffer(
  value: unknown,
  errors: Errors,
): PromotionOffer | undefined {
  if (value === undefined || value === null) return undefined
  if (!isRecord(value)) {
    errors.offer = 'Describe the offer.'
    return undefined
  }
  const offer: PromotionOffer = {}

  if (value.percentOff !== undefined && value.percentOff !== null) {
    if (isInt(value.percentOff, 1, PERCENT_OFF_MAX))
      offer.percentOff = value.percentOff
    else
      errors['offer.percentOff'] =
        `Use a whole percentage from 1 to ${PERCENT_OFF_MAX}.`
  }

  if (value.price !== undefined && value.price !== null) {
    const raw = isRecord(value.price) ? value.price : {}
    const currency =
      typeof raw.currency === 'string' ? raw.currency.trim().toUpperCase() : ''
    if (!isMoney(raw.amount) || !CURRENCY_PATTERN.test(currency)) {
      errors['offer.price'] = 'Give the price and a three-letter currency code.'
    } else if (
      raw.was !== undefined &&
      raw.was !== null &&
      (!isMoney(raw.was) || raw.was <= raw.amount)
    ) {
      errors['offer.price'] =
        'The earlier price must be higher than the offer price.'
    } else {
      offer.price = {
        amount: raw.amount,
        currency,
        ...(isMoney(raw.was) ? { was: raw.was } : {}),
      }
    }
  }

  if (value.code !== undefined && value.code !== null && value.code !== '') {
    const code =
      typeof value.code === 'string' ? value.code.trim().toUpperCase() : ''
    if (CODE_PATTERN.test(code)) offer.code = code
    else
      errors['offer.code'] =
        'Codes use letters, digits and dashes, 3–24 characters.'
  }

  const terms = plainText(value.terms, TERMS_MAX, false)
  if (!terms.ok)
    errors['offer.terms'] = `Keep the terms under ${TERMS_MAX} characters.`
  else if (terms.value) offer.terms = terms.value

  if (offer.percentOff === undefined && !offer.price && !offer.code) {
    if (
      !errors['offer.percentOff'] &&
      !errors['offer.price'] &&
      !errors['offer.code']
    )
      errors.offer = 'An offer needs a percentage, a price or a code.'
    return undefined
  }
  return offer
}

function parseHighlights(value: unknown, errors: Errors): string[] | undefined {
  if (value === undefined || value === null) return undefined
  if (!Array.isArray(value) || value.length > HIGHLIGHTS_MAX) {
    errors.highlights = `Use up to ${HIGHLIGHTS_MAX} points.`
    return undefined
  }
  const items: string[] = []
  for (const item of value) {
    const text = plainText(item, HIGHLIGHT_MAX, false)
    if (!text.ok) {
      errors.highlights = `Keep each point under ${HIGHLIGHT_MAX} characters of plain text.`
      return undefined
    }
    if (text.value) items.push(text.value)
  }
  return items.length ? items : undefined
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

  const offer = parseOffer(input.offer, errors)
  const highlights = parseHighlights(input.highlights, errors)

  let trigger: PromotionTrigger | undefined
  if (input.trigger !== undefined && input.trigger !== null) {
    trigger = PROMOTION_TRIGGERS.find((t) => t === input.trigger)
    if (!trigger) errors.trigger = 'Choose when the promotion may open.'
  }

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

  let media: PromotionMedia | undefined
  if (input.media !== undefined && input.media !== null) {
    const raw = isRecord(input.media) ? input.media : {}
    const alt = plainText(raw.alt, 160, true)
    if (
      typeof raw.src !== 'string' ||
      !isAllowedMediaSrc(raw.src) ||
      !alt.ok ||
      !isInt(raw.width, 1, 10_000) ||
      !isInt(raw.height, 1, 10_000)
    ) {
      errors.media = 'Images need a source, a description and a size.'
    } else {
      media = {
        src: raw.src,
        alt: alt.value ?? '',
        width: raw.width,
        height: raw.height,
      }
    }
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
      ...(placement === 'card'
        ? { slot: (slot.ok && slot.value) || 'default' }
        : {}),
      ...(eyebrow.ok && eyebrow.value ? { eyebrow: eyebrow.value } : {}),
      title: title.value,
      ...(body.ok && body.value ? { body: body.value } : {}),
      ...(media ? { media } : {}),
      ...(cta ? { cta } : {}),
      ...(offer ? { offer } : {}),
      ...(highlights ? { highlights } : {}),
      tone,
      include,
      exclude,
      startsAt,
      endsAt,
      priority,
      dismiss,
      ...(trigger && isOverlay(placement) ? { trigger } : {}),
      ...(input.showCountdown === true ? { showCountdown: true } : {}),
      ...(typeof input.campaign === 'string' && input.campaign.trim()
        ? { campaign: input.campaign.trim().slice(0, 64) }
        : {}),
    },
  }
}

/* -------------------------------------------------------------------------- */
/*  Review helpers                                                            */
/* -------------------------------------------------------------------------- */

export type PromotionWarning = {
  code:
    | 'long-countdown'
    | 'external-cta'
    | 'overlay-overlap'
    | 'everywhere-modal'
    | 'code-without-terms'
    | 'offer-without-cta'
  message: string
}

const PLACEMENT_NAMES: Record<PromotionPlacement, string> = {
  bar: 'bar',
  card: 'card',
  corner: 'corner card',
  sheet: 'side panel',
  dialog: 'dialog',
}

/** Whether two targetings can land on the same page. Conservative: when in doubt, yes. */
export function routesMayOverlap(
  a: Pick<PromotionContent, 'include'>,
  b: Pick<PromotionContent, 'include'>,
) {
  if (a.include.length === 0 || b.include.length === 0) return true
  return a.include.some((pa) =>
    b.include.some(
      (pb) =>
        pa === pb ||
        matchRoute(pa, pb.replace(/\/\*+$/, '')) ||
        matchRoute(pb, pa.replace(/\/\*+$/, '')),
    ),
  )
}

/**
 * Two overlays that could compete for the same visitor: both published, with
 * overlapping windows and pages. The provider shows only the higher priority.
 */
export function overlaysCollide(
  a: Pick<
    Promotion,
    'id' | 'placement' | 'state' | 'startsAt' | 'endsAt' | 'include'
  >,
  b: Pick<
    Promotion,
    'id' | 'placement' | 'state' | 'startsAt' | 'endsAt' | 'include'
  >,
) {
  return (
    a.id !== b.id &&
    isOverlay(a.placement) &&
    isOverlay(b.placement) &&
    a.state === 'published' &&
    b.state === 'published' &&
    a.startsAt < b.endsAt &&
    b.startsAt < a.endsAt &&
    routesMayOverlap(a, b)
  )
}

/**
 * Taste checks. These never block saving; they tell a reviewer what might
 * make the page louder or less clear than intended.
 */
export function reviewPromotion(
  draft: PromotionContent,
  others: readonly Promotion[] = [],
  now = Date.now(),
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
  if (isModal(draft.placement) && draft.include.length === 0)
    warnings.push({
      code: 'everywhere-modal',
      message: `A ${PLACEMENT_NAMES[draft.placement]} on every page is loud. Target the pages it is about.`,
    })
  if (draft.offer?.code && !draft.offer.terms)
    warnings.push({
      code: 'code-without-terms',
      message:
        'Say what the code applies to, so nobody is surprised at checkout.',
    })
  if (draft.offer && !draft.cta)
    warnings.push({
      code: 'offer-without-cta',
      message: 'There is an offer but no button to act on it.',
    })
  if (isOverlay(draft.placement)) {
    const overlapping = others.find(
      (other) =>
        isOverlay(other.placement) &&
        other.state === 'published' &&
        other.startsAt < draft.endsAt &&
        draft.startsAt < other.endsAt &&
        routesMayOverlap(draft, other),
    )
    if (overlapping)
      warnings.push({
        code: 'overlay-overlap',
        message: `“${overlapping.title}” (${PLACEMENT_NAMES[overlapping.placement]}) overlaps this window. Only one overlay shows at a time: the higher priority wins.`,
      })
  }
  return warnings
}

/** "Mon 29 Sep, 9:00 am → Sun 5 Oct, 11:59 pm (7 days)" in the given zone. */
export function describeSchedule(
  startsAt: number,
  endsAt: number,
  { timeZone, locale }: { timeZone?: string; locale?: string } = {},
): string {
  const format = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })
  const days = Math.max(1, Math.round((endsAt - startsAt) / DAY))
  return `${format.format(startsAt)} → ${format.format(endsAt)} (${days} day${days === 1 ? '' : 's'})`
}
