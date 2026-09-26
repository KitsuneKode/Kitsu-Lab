import { describe, expect, test } from 'bun:test'

import {
  HOLDOUT_MAX,
  VARIANTS_MAX,
  assignVariant,
  audienceAllows,
  conversionKeys,
  isPromotion,
  parsePromotion,
  type Promotion,
} from './promotion'

const HOUR = 3_600_000
const T0 = Date.UTC(2026, 8, 29, 9)

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p',
    state: 'published',
    placement: 'toast',
    title: 'Original title',
    body: 'Original body',
    cta: { label: 'Upgrade', href: '/pricing' },
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

const base = {
  placement: 'toast',
  title: 'Hi',
  startsAt: T0,
  endsAt: T0 + HOUR,
}

describe('audiences', () => {
  const set = (...names: string[]) => new Set(names)

  test('no audience means everyone', () => {
    expect(audienceAllows(promo(), set())).toBe(true)
  })

  test('include needs one match; exclude always wins', () => {
    const p = promo({
      audience: { include: ['member', 'plan:pro'], exclude: ['new'] },
    })
    expect(audienceAllows(p, set('member', 'returning'))).toBe(true)
    expect(audienceAllows(p, set('returning'))).toBe(false)
    expect(audienceAllows(p, set('member', 'new'))).toBe(false)
  })

  test('parses, deduplicates and rejects bad segment names', () => {
    const ok = parsePromotion({
      ...base,
      audience: { include: ['member', 'member', 'cart:50+'] },
    })
    expect(ok.ok && ok.value.audience).toEqual({
      include: ['member', 'cart:50+'],
    })
    const bad = parsePromotion({
      ...base,
      audience: { include: ['Member Plus'] },
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors.audience).toBeDefined()
    const empty = parsePromotion({ ...base, audience: { include: [] } })
    expect(empty.ok && 'audience' in empty.value).toBe(false)
  })
})

describe('variants and holdout', () => {
  const variants = [
    { id: 'control' },
    { id: 'urgency', title: 'Ends Sunday: 20% off', ctaLabel: 'Claim it' },
  ]

  test('a visitor always lands in the same arm', () => {
    const p = promo({ variants })
    const a = assignVariant(p, 12345).promotion.variant
    for (let i = 0; i < 5; i += 1)
      expect(assignVariant(p, 12345).promotion.variant).toBe(a)
  })

  test('arms split roughly by weight across visitors', () => {
    const p = promo({
      variants: [
        { id: 'control', weight: 3 },
        { id: 'b', weight: 1 },
      ],
    })
    let b = 0
    for (let seed = 1; seed <= 4000; seed += 1)
      if (assignVariant(p, seed).promotion.variant === 'b') b += 1
    expect(b / 4000).toBeGreaterThan(0.2)
    expect(b / 4000).toBeLessThan(0.3)
  })

  test('a non-control arm replaces copy and drops control translations', () => {
    const p = promo({
      variants: [
        { id: 'urgency', title: 'Ends Sunday', ctaLabel: 'Claim it' },
        { id: 'urgency2', title: 'x' },
      ],
      translations: { fr: { title: 'Titre' } },
    })
    let seed = 1
    while (assignVariant(p, seed).promotion.variant !== 'urgency') seed += 1
    const out = assignVariant(p, seed).promotion
    expect(out.title).toBe('Ends Sunday')
    expect(out.cta?.label).toBe('Claim it')
    expect(out.cta?.href).toBe('/pricing')
    expect(out.body).toBe('Original body')
    expect(out.translations).toBeUndefined()
  })

  test('holdout keeps about that share of visitors out', () => {
    const p = promo({ holdout: 10 })
    let held = 0
    for (let seed = 1; seed <= 4000; seed += 1)
      if (assignVariant(p, seed).held) held += 1
    expect(held / 4000).toBeGreaterThan(0.07)
    expect(held / 4000).toBeLessThan(0.13)
  })

  test('parse limits: 2 to max arms, unique ids, weights 1-100, holdout 1-max', () => {
    expect(parsePromotion({ ...base, variants }).ok).toBe(true)
    for (const bad of [
      [{ id: 'only' }],
      [{ id: 'a' }, { id: 'a' }],
      [{ id: 'a', weight: 0 }, { id: 'b' }],
      Array.from({ length: VARIANTS_MAX + 1 }, (_, i) => ({ id: `v${i}` })),
      [{ id: 'a', title: 42 }, { id: 'b' }],
    ])
      expect(parsePromotion({ ...base, variants: bad }).ok).toBe(false)
    expect(parsePromotion({ ...base, holdout: HOLDOUT_MAX + 1 }).ok).toBe(false)
    const zero = parsePromotion({ ...base, holdout: 0 })
    expect(zero.ok && 'holdout' in zero.value).toBe(false)
  })

  test('stored records with malformed experiments are rejected', () => {
    expect(isPromotion(promo({ variants }))).toBe(true)
    expect(isPromotion(promo({ variants: [{ id: 'x' }] as never }))).toBe(false)
    expect(isPromotion(promo({ holdout: 99 }))).toBe(false)
  })
})

describe('conversions', () => {
  test('a record converts by id, and by campaign when it has one', () => {
    expect(conversionKeys(promo())).toEqual(['promo:converted:id:p'])
    expect(conversionKeys(promo({ campaign: 'spring' }))).toEqual([
      'promo:converted:id:p',
      'promo:converted:spring',
    ])
  })
})
