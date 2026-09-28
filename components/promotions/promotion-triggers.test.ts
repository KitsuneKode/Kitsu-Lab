import { describe, expect, test } from 'bun:test'

import {
  TRIGGERS_MAX,
  isPromotion,
  opensOnItsOwn,
  parsePromotion,
  selectPromotions,
  triggeredBy,
  type Promotion,
} from './promotion'

const HOUR = 3_600_000
const T0 = Date.UTC(2026, 8, 29, 9)

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p',
    state: 'published',
    placement: 'dialog',
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

describe('event triggers', () => {
  const base = {
    placement: 'dialog',
    title: 'Upgrade and save 20%',
    startsAt: T0,
    endsAt: T0 + HOUR,
  }

  test('parses event names and drops duplicates', () => {
    const result = parsePromotion({
      ...base,
      triggers: ['upgrade-intent', 'plan:limit', 'upgrade-intent'],
    })
    expect(result.ok && result.value.triggers).toEqual([
      'upgrade-intent',
      'plan:limit',
    ])
    const none = parsePromotion({ ...base, triggers: [] })
    expect(none.ok && 'triggers' in none.value).toBe(false)
  })

  test('rejects bad names, too many, and placements that cannot pop up', () => {
    for (const triggers of [
      ['Upgrade Now'],
      ['<script>'],
      [''],
      'upgrade',
      Array.from({ length: TRIGGERS_MAX + 1 }, (_, i) => `e${i}`),
    ]) {
      const result = parsePromotion({ ...base, triggers })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.errors.triggers).toBeDefined()
    }
    const bar = parsePromotion({
      ...base,
      placement: 'bar',
      triggers: ['upgrade-intent'],
    })
    expect(bar.ok).toBe(false)
  })

  test('stored records with malformed triggers are rejected', () => {
    expect(isPromotion(promo({ triggers: ['upgrade-intent'] }))).toBe(true)
    expect(isPromotion(promo({ triggers: [42] as never }))).toBe(false)
  })

  test('triggered and story records never open by themselves', () => {
    expect(opensOnItsOwn(promo())).toBe(true)
    expect(opensOnItsOwn(promo({ triggers: ['upgrade-intent'] }))).toBe(false)
    expect(opensOnItsOwn(promo({ presentation: 'story' }))).toBe(false)
  })

  test('picks the best live record for the event on this route', () => {
    const records = [
      promo({ id: 'launch', priority: 90 }),
      promo({ id: 'low', priority: 10, triggers: ['upgrade-intent'] }),
      promo({ id: 'high', priority: 60, triggers: ['upgrade-intent'] }),
      promo({
        id: 'elsewhere',
        priority: 99,
        triggers: ['upgrade-intent'],
        include: ['/docs'],
      }),
      promo({
        id: 'bar',
        placement: 'bar',
        priority: 99,
        triggers: ['upgrade-intent'],
      }),
    ]
    const selection = selectPromotions(records, {
      pathname: '/pricing',
      now: T0,
    })
    expect(triggeredBy(selection, 'upgrade-intent')?.id).toBe('high')
    expect(
      triggeredBy(selection, 'upgrade-intent', (p) => p.id !== 'high')?.id,
    ).toBe('low')
    expect(triggeredBy(selection, 'checkout')).toBeNull()
  })
})

describe('stored media', () => {
  test('rejects a media caption that is not text, which would crash React', () => {
    const media = { src: '/a.webp', alt: 'A', width: 16, height: 9 }
    expect(isPromotion(promo({ media: { ...media, caption: 'Hi' } }))).toBe(
      true,
    )
    expect(
      isPromotion(promo({ media: { ...media, caption: { x: 1 } as never } })),
    ).toBe(false)
  })
})
