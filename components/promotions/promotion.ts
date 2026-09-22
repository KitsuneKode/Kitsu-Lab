/**
 * Promotion core: types and pure rules. No React, no storage, no network, so
 * every rule here is testable with plain data and an injected clock.
 */

export const PROMOTION_PLACEMENTS = ['bar', 'card', 'dialog'] as const
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
  bar?: Promotion
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
 * At most one bar, one dialog and one card per slot for this route and time.
 * Priority first, then id, so the result is stable across renders and servers.
 * Never mutates the input.
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
    } else if (beats(promotion, selection[promotion.placement])) {
      selection[promotion.placement] = promotion
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
  isAllowedHref?: (href: string) => boolean
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

  let media: PromotionMedia | undefined
  if (input.media !== undefined && input.media !== null) {
    const raw = isRecord(input.media) ? input.media : {}
    const alt = plainText(raw.alt, 160, true)
    if (
      typeof raw.src !== 'string' ||
      !isAllowedHref(raw.src) ||
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
      tone,
      include,
      exclude,
      startsAt,
      endsAt,
      priority,
      dismiss,
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
    | 'dialog-overlap'
    | 'everywhere-dialog'
  message: string
}

/**
 * Taste checks. These never block saving; they tell a reviewer what might
 * make the page louder than intended.
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
  if (draft.placement === 'dialog' && draft.include.length === 0)
    warnings.push({
      code: 'everywhere-dialog',
      message:
        'A dialog on every page is the loudest option. Consider targeting the pages it is about.',
    })
  if (draft.placement === 'dialog') {
    const overlapping = others.find(
      (other) =>
        other.placement === 'dialog' &&
        other.state === 'published' &&
        other.startsAt < draft.endsAt &&
        draft.startsAt < other.endsAt,
    )
    if (overlapping)
      warnings.push({
        code: 'dialog-overlap',
        message: `“${overlapping.title}” is also a dialog in this window. Only the higher priority one shows.`,
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
