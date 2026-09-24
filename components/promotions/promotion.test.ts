import { describe, expect, test } from 'bun:test'

import {
  countdownVisible,
  defaultIsAllowedHref,
  deliveryState,
  describeSchedule,
  fromZonedInput,
  isPromotion,
  nextBoundary,
  routesMayOverlap,
  sanitizePromotions,
  toZonedInput,
  dismissalExpiry,
  dismissalKey,
  formatTimeLeft,
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
      promo({ id: 'e', placement: 'card', slot: 'hero' }),
      promo({ id: 'f', placement: 'card', slot: 'hero', priority: 90 }),
      promo({ id: 'g', placement: 'card' }),
    ]
    const before = JSON.stringify(records)
    const selection = selectPromotions(records, { pathname: '/', now: T0 + 1 })
    expect(selection.bar?.id).toBe('a')
    expect(selection.dialog?.id).toBe('d')
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
    expect(formatTimeLeft(T0 + 2 * 3_600_000, T0)).toBe('Ends in 2 hours')
    expect(formatTimeLeft(T0 + 30_000, T0)).toBe('Ends in 1 minute')
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
      [promo({ id: 'other', placement: 'dialog' })],
      T0,
    ).map((w) => w.code)
    expect(codes).toEqual([
      'long-countdown',
      'external-cta',
      'everywhere-dialog',
      'dialog-overlap',
    ])
  })
})

describe('hardening', () => {
  test('refuses backslash and control-character hrefs (open redirects)', () => {
    expect(defaultIsAllowedHref('/courses')).toBe(true)
    expect(defaultIsAllowedHref('/\\evil.com')).toBe(false)
    expect(defaultIsAllowedHref('//evil.com')).toBe(false)
    expect(defaultIsAllowedHref('/a\tb')).toBe(false)
    expect(defaultIsAllowedHref('javascript:alert(1)')).toBe(false)
  })

  test('media sources are not limited by a narrowed CTA list', () => {
    const result = parsePromotion(
      {
        placement: 'card',
        title: 'Hi',
        cta: { label: 'Go', href: '/courses' },
        media: { src: '/img/a.webp', alt: 'A class', width: 16, height: 9 },
        startsAt: T0,
        endsAt: T0 + DAY,
      },
      { isAllowedHref: (href) => href === '/courses' },
    )
    expect(result.ok).toBe(true)
  })

  test('codes are normalised to upper case and validated', () => {
    const base = {
      placement: 'bar',
      title: 'Hi',
      startsAt: T0,
      endsAt: T0 + DAY,
    }
    const ok = parsePromotion({ ...base, code: ' night20 ' })
    expect(ok.ok && ok.value.code).toBe('NIGHT20')
    const bad = parsePromotion({ ...base, code: 'NO SPACES' })
    expect(bad.ok).toBe(false)
  })

  test('isPromotion drops malformed rows instead of crashing selection', () => {
    const rows = [
      promo(),
      { ...promo({ id: 'x' }), include: undefined },
      null,
      'x',
    ]
    expect(sanitizePromotions(rows).map((p) => p.id)).toEqual(['p1'])
    expect(sanitizePromotions({ not: 'an array' })).toEqual([])
    expect(
      isPromotion({ ...promo(), cta: { label: 'Go', href: 'javascript:x' } }),
    ).toBe(false)
  })

  test('selects one toast alongside bar and dialog', () => {
    const selection = selectPromotions(
      [
        promo({ id: 'b' }),
        promo({ id: 't1', placement: 'toast', priority: 10 }),
        promo({ id: 't2', placement: 'toast', priority: 90 }),
      ],
      { pathname: '/', now: T0 },
    )
    expect(selection.bar?.id).toBe('b')
    expect(selection.toast?.id).toBe('t2')
  })

  test('nextBoundary finds the nearest start or end of published records', () => {
    const records = [
      promo({ startsAt: T0 + DAY, endsAt: T0 + 3 * DAY }),
      promo({ id: 'b', startsAt: T0 - DAY, endsAt: T0 + 2 * DAY }),
      promo({ id: 'c', state: 'draft', startsAt: T0 + 60_000 }),
    ]
    expect(nextBoundary(records, T0)).toBe(T0 + DAY)
    expect(nextBoundary(records, T0 + 5 * DAY)).toBeNull()
  })
})

describe('time zones', () => {
  test('round-trips wall-clock input in an explicit zone', () => {
    // 29 Sep 2026, 09:00 IST is 03:30 UTC.
    const ms = fromZonedInput('2026-09-29T09:00', 'Asia/Kolkata')
    expect(ms).toBe(Date.UTC(2026, 8, 29, 3, 30))
    expect(toZonedInput(ms!, 'Asia/Kolkata')).toBe('2026-09-29T09:00')
    expect(toZonedInput(ms!, 'UTC')).toBe('2026-09-29T03:30')
  })

  test('handles daylight saving on both sides of the jump', () => {
    const winter = fromZonedInput('2026-01-15T12:00', 'America/New_York')
    const summer = fromZonedInput('2026-07-15T12:00', 'America/New_York')
    expect(winter).toBe(Date.UTC(2026, 0, 15, 17))
    expect(summer).toBe(Date.UTC(2026, 6, 15, 16))
  })

  test('rejects malformed input', () => {
    expect(fromZonedInput('', 'UTC')).toBeUndefined()
    expect(fromZonedInput('tomorrow', 'UTC')).toBeUndefined()
  })

  test('schedule text names the zone', () => {
    expect(
      describeSchedule(T0, T0 + 7 * DAY, { timeZone: 'UTC', locale: 'en-GB' }),
    ).toMatch(/UTC \(7 days\)$/)
  })
})

describe('review, refined', () => {
  test('never warns about overlapping itself', () => {
    const self = promo({ id: 'me', placement: 'dialog', include: ['/courses'] })
    const codes = reviewPromotion(self, [self], T0, { id: 'me' }).map(
      (w) => w.code,
    )
    expect(codes).not.toContain('dialog-overlap')
  })

  test('disjoint routes do not overlap; nested ones do', () => {
    expect(
      routesMayOverlap({ include: ['/books'] }, { include: ['/courses/*'] }),
    ).toBe(false)
    expect(
      routesMayOverlap(
        { include: ['/courses/**'] },
        { include: ['/courses/a'] },
      ),
    ).toBe(true)
    expect(
      routesMayOverlap(
        { include: ['/courses/*'] },
        { include: ['/courses/*'] },
      ),
    ).toBe(true)
    expect(routesMayOverlap({ include: [] }, { include: ['/books'] })).toBe(
      true,
    )
  })

  test('flags a dialog with nothing to do', () => {
    const codes = reviewPromotion(
      promo({ placement: 'dialog', include: ['/'] }),
      [],
      T0,
    ).map((w) => w.code)
    expect(codes).toContain('dialog-without-cta')
  })
})
