import type { Promotion, PromotionCopy, PromotionMedia } from './promotion'
import type { PromotionProviderProps } from './promotion-provider'

export const HOUR = 3_600_000
export const DAY = 24 * HOUR

/**
 * A kit is a ready-made campaign: records that work together, plus the
 * provider settings they were designed for. Spread `provider` into your
 * `<PromotionProvider>`, add `promotions` to your source, and edit the copy.
 */
export type PromotionKit = {
  promotions: Promotion[]
  provider: Pick<
    PromotionProviderProps,
    'suppressOn' | 'dialogEngagement' | 'toastEngagement'
  >
  /** Slots the kit fills, so you know where to place PromoCard or PromoPill. */
  slots: string[]
}

export type KitOptions<Routes extends Record<string, string>> = {
  /** When the campaign starts. Defaults to now. */
  startsAt?: number
  /** Prefix for record ids and campaign names, e.g. `spring-26`. */
  id?: string
  /** Your real routes. Defaults are generic paths. */
  routes?: Partial<Routes>
  /** Per-record changes, keyed by the kit's record name. */
  overrides?: Record<string, Partial<Promotion>>
  /** Your images for galleries, replacing the kit's samples. */
  images?: PromotionMedia[]
}

export type Langs = 'fr' | 'de' | 'ja' | 'hi' | 'ar'
export const tr = (copy: Record<Langs, PromotionCopy>) => copy

export function record(
  base: Pick<Promotion, 'id' | 'placement' | 'title'> & Partial<Promotion>,
): Promotion {
  return {
    state: 'published',
    tone: 'neutral',
    include: [],
    exclude: [],
    startsAt: 0,
    endsAt: 0,
    priority: 50,
    dismiss: { mode: 'days', days: 3 },
    dismissalVersion: 1,
    revision: 1,
    ...base,
  }
}

/** Applies the prefix and overrides a kit's caller passed in. */
export function finish(
  records: Record<string, Promotion>,
  {
    id = 'kit',
    overrides = {},
  }: { id?: string; overrides?: Record<string, Partial<Promotion>> },
): Promotion[] {
  return Object.entries(records).map(([name, value]) => ({
    ...value,
    ...overrides[name],
    id: `${id}-${name}`,
    ...(value.campaign ? { campaign: `${id}-${value.campaign}` } : {}),
  }))
}

export const SAMPLE_SWATCHES: PromotionMedia[] = [
  {
    src: '/promo-samples/linen-sand.svg',
    alt: 'Sand linen overshirt',
    width: 1600,
    height: 900,
  },
  {
    src: '/promo-samples/linen-sage.svg',
    alt: 'Sage linen overshirt',
    width: 1600,
    height: 900,
  },
  {
    src: '/promo-samples/linen-ink.svg',
    alt: 'Ink linen overshirt',
    width: 1600,
    height: 900,
  },
  {
    src: '/promo-samples/linen-clay.svg',
    alt: 'Clay linen overshirt',
    width: 1600,
    height: 900,
  },
]

export const SAMPLE_PAGES: PromotionMedia[] = [1, 2, 3].map((n) => ({
  src: `/sample-pages/page-${n}.svg`,
  alt: `Page ${n} of the notes`,
  width: 1600,
  height: 900,
}))

export const QUIET_CHECKOUT = ['/checkout', '/checkout/**', '/login', '/signup']
