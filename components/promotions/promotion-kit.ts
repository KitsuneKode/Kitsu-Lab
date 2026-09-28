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
  /**
   * Your images and clips. Kits ship no assets: without these, surfaces
   * that would carry a picture render as text, never as a broken image.
   */
  images?: PromotionMedia[]
}

export type Langs = 'fr' | 'de' | 'ja' | 'hi' | 'ar'
export const tr = (copy: Record<Langs, PromotionCopy>) => copy

/** Fills a kit record with safe defaults, so each kit only states what is specific to it. */
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

/** A gallery only when the host supplied images; kits ship no assets. */
export const galleryOf = (images: readonly PromotionMedia[]) =>
  images.length ? { gallery: [...images] } : {}

/** The image at `index`, or nothing, so a kit without images stays text-only. */
export const mediaAt = (images: readonly PromotionMedia[], index: number) => {
  const media = images[index] ?? images[0]
  return media ? { media } : {}
}

export const QUIET_CHECKOUT = ['/checkout', '/checkout/**', '/login', '/signup']
