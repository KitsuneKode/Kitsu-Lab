import { describe, expect, test } from 'bun:test'

import {
  countdownVisible,
  deliveryState,
  dismissalExpiry,
  dismissalKey,
  formatPrice,
  formatTimeLeft,
  isOverlay,
  offerBadge,
  matchRoute,
  parsePromotion,
  reviewPromotion,
  selectPromotions,
  targetsRoute,
  type Promotion,
} from './promotion'

const DAY = 86_400_000
const T0 = Date.UTC(2026, 8, 29, 3, 30)

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p1',
    state: 'published',
    placement: 'bar',
    title: 'New batch',
    tone: 'neutral',
    include: [],
    exclude: [],
    startsAt: T0,
    endsAt: T0 + 7 * DAY,
    priority: 50,
    dismiss: { mode: 'days', days: 7 },
    dismissalVersion: 1,
    revision: 1,
    ...overrides,
  }
}

describe('matchRoute', () => {
  test('exact match ignores trailing slashes and query strings', () => {
    expect(matchRoute('/courses', '/courses/')).toBe(true)
    expect(matchRoute('/courses', '/courses?x=1')).toBe(true)
    expect(matchRoute('/', '/')).toBe(true)
    expect(matchRoute('/courses', '/courses/apsc')).toBe(false)
  })

  test('/* matches descendants only; /** includes the base', () => {
    expect(matchRoute('/courses/*', '/courses')).toBe(false)
    expect(matchRoute('/courses/*', '/courses/apsc')).toBe(true)
    expect(matchRoute('/courses/**', '/courses')).toBe(true)
    expect(matchRoute('/courses/**', '/courses/apsc/syllabus')).toBe(true)
    expect(matchRoute('/courses/*', '/coursesx')).toBe(false)
  })

  test('* matches everything', () => {
    expect(matchRoute('*', '/anything/at/all')).toBe(true)
  })
})

describe('targetsRoute', () => {
  test('empty include means everywhere; exclude always wins', () => {
    expect(targetsRoute({ include: [], exclude: [] }, '/x')).toBe(true)
    expect(
      targetsRoute({ include: [], exclude: ['/checkout/**'] }, '/checkout/pay'),
    ).toBe(false)
    expect(
      targetsRoute(
        { include: ['/courses/**'], exclude: ['/courses/old'] },
        '/courses/old',
      ),
    ).toBe(false)
  })
})

describe('deliveryState', () => {
  test('window is [start, end)', () => {
    const p = promo()
    expect(deliveryState(p, T0 - 1)).toBe('scheduled')
    expect(deliveryState(p, T0)).toBe('live')
    expect(deliveryState(p, p.endsAt - 1)).toBe('live')
    expect(deliveryState(p, p.endsAt)).toBe('ended')
  })

  test('non-published states never deliver, whatever the clock', () => {
    for (const state of ['draft', 'paused', 'archived'] as const)
      expect(deliveryState(promo({ state }), T0 + DAY)).toBe(state)
  })

  test('a non-finite clock fails closed', () => {
    expect(deliveryState(promo(), Number.NaN)).toBe('ended')
  })
})

describe('selectPromotions', () => {
  test('one per placement and per card slot, highest priority then id', () => {
    const records = [
      promo({ id: 'b', priority: 50 }),
      promo({ id: 'a', priority: 50 }),
      promo({ id: 'c', priority: 10 }),
      promo({ id: 'd', placement: 'dialog', priority: 5 }),
      promo({ id: 'k', placement: 'corner', priority: 30 }),
      promo({ id: 's', placement: 'sheet', priority: 20 }),
      promo({ id: 'e', placement: 'card', slot: 'hero' }),
      promo({ id: 'f', placement: 'card', slot: 'hero', priority: 90 }),
      promo({ id: 'g', placement: 'card' }),
    ]
    const before = JSON.stringify(records)
    const selection = selectPromotions(records, { pathname: '/', now: T0 + 1 })
    expect(selection.bar?.id).toBe('a')
    // One overlay across corner, sheet and dialog: the highest priority wins.
    expect(selection.overlay?.id).toBe('k')
    expect(selection.cards.hero?.id).toBe('f')
    expect(selection.cards.default?.id).toBe('g')
    expect(JSON.stringify(records)).toBe(before)
  })

  test('skips records that are not live or not targeted', () => {
    const selection = selectPromotions(
      [
        promo({ id: 'future', startsAt: T0 + DAY }),
        promo({ id: 'other-page', include: ['/books'] }),
        promo({ id: 'draft', state: 'draft' }),
      ],
      { pathname: '/', now: T0 + 1 },
    )
    expect(selection.bar).toBeUndefined()
  })
})

describe('dismissal', () => {
  test('key changes only with dismissalVersion', () => {
    const a = dismissalKey(promo({ revision: 1 }))
    expect(dismissalKey(promo({ revision: 9, title: 'Edited' }))).toBe(a)
    expect(dismissalKey(promo({ dismissalVersion: 2 }))).not.toBe(a)
  })

  test('days mode expires; session and never-again do not', () => {
    expect(dismissalExpiry({ mode: 'days', days: 3 }, T0)).toBe(T0 + 3 * DAY)
    expect(dismissalExpiry({ mode: 'session' }, T0)).toBeNull()
    expect(dismissalExpiry({ mode: 'never-again' }, T0)).toBeNull()
  })
})

describe('countdown', () => {
  test('only within the last 14 days, and only when asked for', () => {
    const p = promo({ showCountdown: true, endsAt: T0 + 20 * DAY })
    expect(countdownVisible(p, T0)).toBe(false)
    expect(countdownVisible(p, T0 + 7 * DAY)).toBe(true)
    expect(countdownVisible({ ...p, showCountdown: false }, T0 + 7 * DAY)).toBe(
      false,
    )
  })

  test('formats whole units', () => {
    expect(formatTimeLeft(T0 + 3 * DAY + 5, T0)).toBe('Ends in 3 days')
    expect(formatTimeLeft(T0 + DAY + 3_600_000, T0)).toBe('Ends in 1 day')
    expect(formatTimeLeft(T0 + 5 * 3_600_000 + 20 * 60_000, T0)).toBe(
      'Ends in 5h 20m',
    )
    expect(formatTimeLeft(T0 + 2 * 3_600_000, T0)).toBe('Ends in 2h')
    expect(formatTimeLeft(T0 + 30_000, T0)).toBe('Ends in 1 min')
    expect(formatTimeLeft(T0, T0)).toBeNull()
  })
})

describe('parsePromotion', () => {
  const valid = {
    placement: 'card',
    slot: 'hero',
    title: '  New   batch  ',
    body: 'Starts Monday.',
    tone: 'brand',
    cta: { label: 'See the batch', href: '/courses/victor' },
    include: ['/', '/courses/*', '/'],
    exclude: [],
    startsAt: T0,
    endsAt: T0 + DAY,
  }

  test('accepts and normalises valid input with defaults', () => {
    const result = parsePromotion(valid)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.title).toBe('New batch')
    expect(result.value.include).toEqual(['/', '/courses/*'])
    expect(result.value.priority).toBe(50)
    expect(result.value.dismiss).toEqual({ mode: 'days', days: 7 })
    expect(result.value.cta?.external).toBeUndefined()
  })

  test('rejects markup, unsafe links and inverted windows', () => {
    const result = parsePromotion({
      ...valid,
      title: '<b>Sale</b>',
      cta: { label: 'Go', href: 'javascript:alert(1)' },
      endsAt: T0 - 1,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors.title).toBeDefined()
    expect(result.errors['cta.href']).toBeDefined()
    expect(result.errors.endsAt).toBeDefined()
  })

  test('protocol-relative links are not internal', () => {
    const result = parsePromotion({
      ...valid,
      cta: { label: 'Go', href: '//evil.example' },
    })
    expect(result.ok).toBe(false)
  })

  test('hosts can narrow links and routes', () => {
    const result = parsePromotion(valid, {
      isAllowedHref: (href) => href === '/contact',
      isAllowedRoute: (route) => route === '/',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors['cta.href']).toBeDefined()
    expect(result.errors.include).toBeDefined()
  })

  test('narrowing button links does not narrow image sources', () => {
    const result = parsePromotion(
      {
        ...valid,
        cta: { label: 'Go', href: '/contact' },
        media: {
          src: '/img/launch.webp',
          alt: 'Launch',
          width: 1200,
          height: 675,
        },
      },
      { isAllowedHref: (href) => href === '/contact' },
    )
    expect(result.ok).toBe(true)
  })

  test('https links are marked external', () => {
    const result = parsePromotion({
      ...valid,
      cta: { label: 'Store', href: 'https://example.com' },
    })
    expect(result.ok && result.value.cta?.external).toBe(true)
  })
})

describe('reviewPromotion', () => {
  test('warns about loud or confusing choices without blocking', () => {
    const draft = {
      ...promo({
        placement: 'dialog',
        showCountdown: true,
        endsAt: T0 + 30 * DAY,
      }),
      cta: { label: 'Store', href: 'https://example.com', external: true },
    }
    const codes = reviewPromotion(
      draft,
      [promo({ id: 'other', placement: 'corner' })],
      T0,
    ).map((w) => w.code)
    expect(codes).toEqual([
      'long-countdown',
      'external-cta',
      'everywhere-modal',
      'overlay-overlap',
    ])
  })

  test('an offer needs terms for its code and a button to act on', () => {
    const codes = reviewPromotion(
      promo({ placement: 'card', offer: { code: 'EARLY20' } }),
      [],
      T0,
    ).map((w) => w.code)
    expect(codes).toEqual(['code-without-terms', 'offer-without-cta'])
  })

  test('overlays on unrelated pages do not collide', () => {
    const codes = reviewPromotion(
      promo({ placement: 'corner', include: ['/books'] }),
      [promo({ id: 'x', placement: 'sheet', include: ['/courses/*'] })],
      T0,
    ).map((w) => w.code)
    expect(codes).not.toContain('overlay-overlap')
  })
})

describe('offers', () => {
  const base = {
    placement: 'card',
    title: 'Early bird',
    tone: 'brand',
    startsAt: T0,
    endsAt: T0 + DAY,
  }

  test('accepts a percentage, a price with a higher was, and a code', () => {
    const result = parsePromotion({
      ...base,
      offer: {
        percentOff: 20,
        price: { amount: 6009, was: 8009, currency: 'inr' },
        code: ' early20 ',
        terms: 'New enrolments only.',
      },
      highlights: ['  Live classes ', '', 'Recorded on the app'],
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.offer).toEqual({
      percentOff: 20,
      price: { amount: 6009, was: 8009, currency: 'INR' },
      code: 'EARLY20',
      terms: 'New enrolments only.',
    })
    expect(result.value.highlights).toEqual([
      'Live classes',
      'Recorded on the app',
    ])
  })

  test('refuses an inflated was-price, a silly percentage and a bad code', () => {
    const result = parsePromotion({
      ...base,
      offer: {
        percentOff: 99,
        price: { amount: 100, was: 90, currency: 'INR' },
        code: 'no spaces allowed',
      },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(Object.keys(result.errors).toSorted()).toEqual([
      'offer.code',
      'offer.percentOff',
      'offer.price',
    ])
  })

  test('an empty offer is an error, not a silent no-op', () => {
    const result = parsePromotion({ ...base, offer: { terms: 'Hi' } })
    expect(result.ok).toBe(false)
  })

  test('the badge says what the author wrote, or the saving', () => {
    expect(offerBadge({ percentOff: 15 })).toBe('15% off')
    expect(
      offerBadge(
        { price: { amount: 6009, was: 8009, currency: 'INR' } },
        'en-IN',
      ),
    ).toBe(`Save ${formatPrice(2000, 'INR', 'en-IN')}`)
    expect(offerBadge({ code: 'X12' })).toBeNull()
  })

  test('only overlays keep a trigger', () => {
    const card = parsePromotion({ ...base, trigger: 'exit-intent' })
    expect(card.ok && card.value.trigger).toBeFalsy()
    const corner = parsePromotion({
      ...base,
      placement: 'corner',
      trigger: 'exit-intent',
    })
    expect(corner.ok && corner.value.trigger).toBe('exit-intent')
    expect(isOverlay('corner')).toBe(true)
    expect(isOverlay('bar')).toBe(false)
  })
})
