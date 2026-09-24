import { describe, expect, test } from 'bun:test'

import { courseEnrolmentKit } from './kit-course-enrolment'
import { productLaunchKit } from './kit-product-launch'
import { storeSaleKit } from './kit-store-sale'
import {
  GALLERY_MAX,
  inboxPromotions,
  isPromotion,
  parsePromotion,
  selectPromotions,
  sharesCampaign,
  slotPromotions,
  type Promotion,
} from './promotion'

const HOUR = 3_600_000
const T0 = Date.UTC(2026, 8, 29, 9)

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p',
    state: 'published',
    placement: 'card',
    slot: 'hero',
    title: 'Offer',
    tone: 'neutral',
    include: [],
    exclude: [],
    startsAt: T0 - HOUR,
    endsAt: T0 + 48 * HOUR,
    priority: 50,
    dismiss: { mode: 'session' },
    dismissalVersion: 1,
    revision: 1,
    ...overrides,
  }
}

describe('several campaigns at once', () => {
  const records = [
    promo({ id: 'b', priority: 40 }),
    promo({ id: 'a', priority: 90 }),
    promo({ id: 'c', priority: 40 }),
    promo({ id: 'side', slot: 'side' }),
    promo({ id: 'later', startsAt: T0 + HOUR }),
  ]
  const selection = selectPromotions(records, { pathname: '/', now: T0 })

  test('live is every live record, best first, ties by id', () => {
    expect(selection.live.map((p) => p.id)).toEqual(['a', 'side', 'b', 'c'])
    expect(selection.cards.hero?.id).toBe('a')
  })

  test('slotPromotions gives the carousel its slides in order', () => {
    expect(slotPromotions(selection, 'hero').map((p) => p.id)).toEqual([
      'a',
      'b',
      'c',
    ])
    expect(slotPromotions(selection, 'none')).toEqual([])
  })

  test('sharesCampaign needs both sides to name the same campaign', () => {
    expect(sharesCampaign({ campaign: 'x' }, { campaign: 'x' })).toBe(true)
    expect(sharesCampaign({ campaign: 'x' }, { campaign: 'y' })).toBe(false)
    expect(sharesCampaign({}, {})).toBe(false)
    expect(sharesCampaign(null, { campaign: 'x' })).toBe(false)
  })

  test('the inbox lists actionable offers once per campaign', () => {
    const inbox = inboxPromotions({
      live: [
        promo({
          id: 'bar',
          placement: 'bar',
          campaign: 'sale',
          cta: { label: 'Go', href: '/s' },
        }),
        promo({
          id: 'toast',
          placement: 'toast',
          campaign: 'sale',
          cta: { label: 'Go', href: '/s' },
        }),
        promo({ id: 'code', placement: 'sheet', code: 'SAVE' }),
        promo({ id: 'plain', placement: 'toast' }),
        promo({
          id: 'layout',
          placement: 'card',
          cta: { label: 'Go', href: '/x' },
        }),
        promo({ id: 'coupon-card', placement: 'card', code: 'CARD' }),
      ],
    })
    expect(inbox.map((p) => p.id)).toEqual(['bar', 'code', 'coupon-card'])
  })
})

describe('galleries', () => {
  const base = {
    placement: 'card',
    title: 'Hi',
    startsAt: T0,
    endsAt: T0 + HOUR,
  }
  const image = { src: '/a.webp', alt: 'A', width: 16, height: 9 }

  test('accepts up to the limit and rejects bad images', () => {
    const ok = parsePromotion({ ...base, gallery: [image, image] })
    expect(ok.ok && ok.value.gallery?.length).toBe(2)
    expect(
      parsePromotion({ ...base, gallery: Array(GALLERY_MAX + 1).fill(image) })
        .ok,
    ).toBe(false)
    expect(
      parsePromotion({ ...base, gallery: [{ ...image, alt: '' }] }).ok,
    ).toBe(false)
    expect(
      parsePromotion({ ...base, gallery: [{ ...image, src: 'javascript:x' }] })
        .ok,
    ).toBe(false)
  })

  test('isPromotion rejects a malformed gallery', () => {
    expect(isPromotion(promo({ gallery: [image] }))).toBe(true)
    expect(isPromotion({ ...promo(), gallery: 'nope' })).toBe(false)
  })
})

describe('kits', () => {
  const kits = {
    store: storeSaleKit({ startsAt: T0, id: 'spring' }),
    launch: productLaunchKit({ startsAt: T0 }),
    course: courseEnrolmentKit({ startsAt: T0 }),
  }

  test.each(Object.entries(kits))(
    '%s: every record is valid and uniquely named',
    (_, kit) => {
      const ids = new Set<string>()
      for (const record of kit.promotions) {
        expect(isPromotion(record)).toBe(true)
        const parsed = parsePromotion(record)
        if (!parsed.ok)
          throw new Error(`${record.id}: ${JSON.stringify(parsed.errors)}`)
        expect(ids.has(record.id)).toBe(false)
        ids.add(record.id)
      }
    },
  )

  test('ids and campaigns take the prefix; overrides and routes apply', () => {
    const kit = storeSaleKit({
      startsAt: T0,
      id: 'autumn',
      routes: { product: '/store/overshirt' },
      overrides: { bar: { title: 'Up to 40% off wool' } },
    })
    const bar = kit.promotions.find((p) => p.id === 'autumn-bar')!
    expect(bar.title).toBe('Up to 40% off wool')
    expect(bar.campaign).toBe('autumn-sale')
    expect(bar.cta?.href).toBe('/store/overshirt')
  })

  test('the store kit fills the hero slot with two campaigns', () => {
    const selection = selectPromotions(kits.store.promotions, {
      pathname: '/shop',
      now: T0,
    })
    expect(slotPromotions(selection, 'hero')).toHaveLength(2)
    expect(sharesCampaign(selection.bar, selection.toast)).toBe(true)
  })
})
