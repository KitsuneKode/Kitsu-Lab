import {
  fromZonedInput,
  toZonedInput,
  type DialogPresentation,
  type DismissScope,
  type PromotionContent,
  type PromotionPlacement,
  type PromotionTone,
} from './promotion'

/**
 * The editor's form state and its translation to and from a promotion,
 * kept free of React so the round trip can be tested: loading a record
 * and saving it unchanged must never lose a field.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type Draft = {
  placement: PromotionPlacement
  slot: string
  eyebrow: string
  title: string
  body: string
  tone: PromotionTone
  ctaLabel: string
  ctaHref: string
  code: string
  mediaSrc: string
  mediaAlt: string
  mediaWidth: number
  mediaHeight: number
  include: string[]
  exclude: string[]
  startsAt: string
  endsAt: string
  priority: number
  dismissMode: 'session' | 'days' | 'never-again'
  dismissDays: number
  showCountdown: boolean
  presentation: DialogPresentation
  revealCode: boolean
  campaign: string
  /** 0 means the default window. */
  frequencyHours: number
  /** Comma- or space-separated names, parsed on save. */
  triggers: string
  audienceInclude: string
  audienceExclude: string
  /** Empty means the browser, the default. */
  dismissScope: '' | DismissScope
  /** The original copy's share of visitors when variants exist. */
  controlWeight: number
  variants: DraftVariant[]
  holdout: number
}

export type DraftVariant = {
  /** Stable React key; `id` is editable, so it cannot be the key. */
  key: string
  id: string
  title: string
  body: string
  ctaLabel: string
  weight: number
}

/** Builds the form draft from an existing record, showing its dates in the editor time zone. */
export function initialDraft(
  initial: Partial<PromotionContent> = {},
  now: number,
  timeZone: string | undefined,
): Draft {
  const startsAt = initial.startsAt ?? Math.ceil(now / HOUR) * HOUR
  const endsAt = initial.endsAt ?? startsAt + 7 * DAY
  return {
    placement: initial.placement ?? 'bar',
    slot: initial.slot ?? 'default',
    eyebrow: initial.eyebrow ?? '',
    title: initial.title ?? '',
    body: initial.body ?? '',
    tone: initial.tone ?? 'neutral',
    ctaLabel: initial.cta?.label ?? '',
    ctaHref: initial.cta?.href ?? '',
    code: initial.code ?? '',
    mediaSrc: initial.media?.src ?? '',
    mediaAlt: initial.media?.alt ?? '',
    mediaWidth: initial.media?.width ?? 1600,
    mediaHeight: initial.media?.height ?? 900,
    include: initial.include ?? [],
    exclude: initial.exclude ?? [],
    startsAt: toZonedInput(startsAt, timeZone),
    endsAt: toZonedInput(endsAt, timeZone),
    priority: initial.priority ?? 50,
    dismissMode: initial.dismiss?.mode ?? 'days',
    dismissDays: initial.dismiss?.mode === 'days' ? initial.dismiss.days : 7,
    showCountdown: initial.showCountdown ?? false,
    presentation: initial.presentation ?? 'center',
    revealCode: initial.revealCode ?? false,
    campaign: initial.campaign ?? '',
    frequencyHours: initial.frequency?.hours ?? 0,
    triggers: (initial.triggers ?? []).join(', '),
    audienceInclude: (initial.audience?.include ?? []).join(', '),
    audienceExclude: (initial.audience?.exclude ?? []).join(', '),
    dismissScope: initial.dismiss?.scope ?? '',
    controlWeight:
      initial.variants?.find((v) => v.id === 'control')?.weight ?? 1,
    variants: (initial.variants ?? [])
      .filter((v) => v.id !== 'control')
      .map((v, index) => ({
        key: `loaded-${index}`,
        id: v.id,
        title: v.title ?? '',
        body: v.body ?? '',
        ctaLabel: v.ctaLabel ?? '',
        weight: v.weight ?? 1,
      })),
    holdout: initial.holdout ?? 0,
  }
}

/** "a, b  c" → ["a", "b", "c"]; parsing validates the names. */
export const names = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((name) => name.trim())
    .filter(Boolean)

export const OPENS_ON_EVENT: ReadonlySet<PromotionPlacement> = new Set([
  'toast',
  'dialog',
  'sheet',
])
export const HAS_FREQUENCY: ReadonlySet<PromotionPlacement> = new Set([
  'toast',
  'dialog',
  'spotlight',
])

/**
 * Fields the form does not show are carried over from `initial`, so saving
 * an existing promotion never silently drops its gallery or translations.
 */
export function toInput(
  draft: Draft,
  timeZone: string | undefined,
  initial: Partial<PromotionContent> = {},
) {
  const hasCta = draft.ctaLabel.trim() !== '' || draft.ctaHref.trim() !== ''
  const hasMedia = draft.mediaSrc.trim() !== '' || draft.mediaAlt.trim() !== ''
  return {
    placement: draft.placement,
    slot:
      draft.placement === 'card' || draft.placement === 'spotlight'
        ? draft.slot
        : undefined,
    presentation: draft.placement === 'dialog' ? draft.presentation : undefined,
    eyebrow: draft.eyebrow,
    title: draft.title,
    body: draft.body,
    tone: draft.tone,
    cta: hasCta ? { label: draft.ctaLabel, href: draft.ctaHref } : undefined,
    code: draft.code,
    media: hasMedia
      ? {
          src: draft.mediaSrc.trim(),
          alt: draft.mediaAlt,
          width: draft.mediaWidth,
          height: draft.mediaHeight,
        }
      : undefined,
    include: draft.include,
    exclude: draft.exclude,
    startsAt: fromZonedInput(draft.startsAt, timeZone),
    endsAt: fromZonedInput(draft.endsAt, timeZone),
    priority: draft.priority,
    dismiss: {
      ...(draft.dismissMode === 'days'
        ? { mode: 'days', days: draft.dismissDays }
        : { mode: draft.dismissMode }),
      ...(draft.dismissScope ? { scope: draft.dismissScope } : {}),
    },
    showCountdown: draft.showCountdown,
    gallery: initial.gallery,
    translations: initial.translations,
    revealCode: draft.code.trim() && draft.revealCode ? true : undefined,
    frequency:
      HAS_FREQUENCY.has(draft.placement) && draft.frequencyHours > 0
        ? { hours: draft.frequencyHours }
        : undefined,
    campaign: draft.campaign.trim() || undefined,
    // Only where they can apply, so switching to a bar never trips an error.
    triggers: OPENS_ON_EVENT.has(draft.placement)
      ? names(draft.triggers)
      : undefined,
    audience:
      draft.audienceInclude.trim() || draft.audienceExclude.trim()
        ? {
            include: names(draft.audienceInclude),
            exclude: names(draft.audienceExclude),
          }
        : undefined,
    variants: draft.variants.length
      ? [
          { id: 'control', weight: draft.controlWeight },
          ...draft.variants.map((variant) => ({
            id: variant.id.trim().toLowerCase(),
            weight: variant.weight,
            title: variant.title,
            body: variant.body,
            ctaLabel: variant.ctaLabel,
          })),
        ]
      : undefined,
    holdout: draft.holdout || undefined,
  }
}
