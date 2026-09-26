import { describe, expect, test } from 'bun:test'

import {
  dismissScope,
  frequencyAllows,
  localizePromotion,
  isPromotion,
  parsePromotion,
  selectPromotions,
  type Promotion,
} from './promotion'
import { isRightToLeft, promotionLabels } from './promotion-labels'
import {
  composeStores,
  memoryDismissalStore,
  readPromotionCookies,
} from './promotion-stores'

const HOUR = 3_600_000
const T0 = Date.UTC(2026, 8, 29, 3, 30)

function promo(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'p1',
    state: 'published',
    placement: 'toast',
    title: 'Spring sale',
    tone: 'neutral',
    include: [],
    exclude: [],
    startsAt: T0 - HOUR,
    endsAt: T0 + 100 * HOUR,
    priority: 50,
    dismiss: { mode: 'days', days: 7 },
    dismissalVersion: 1,
    revision: 1,
    ...overrides,
  }
}

describe('frequency', () => {
  test('never shown always allows; the window is inclusive at its end', () => {
    expect(frequencyAllows(null, T0)).toBe(true)
    expect(frequencyAllows(T0, T0 + 23 * HOUR)).toBe(false)
    expect(frequencyAllows(T0, T0 + 24 * HOUR)).toBe(true)
    expect(frequencyAllows(T0, T0 + 2 * HOUR, 2)).toBe(true)
  })

  test('parses a frequency window and rejects silly ones', () => {
    const base = {
      placement: 'toast',
      title: 'Hi',
      startsAt: T0,
      endsAt: T0 + HOUR,
    }
    const ok = parsePromotion({ ...base, frequency: { hours: 48 } })
    expect(ok.ok && ok.value.frequency).toEqual({ hours: 48 })
    expect(parsePromotion({ ...base, frequency: { hours: 0 } }).ok).toBe(false)
  })
})

describe('dismissal scopes', () => {
  test('session dismissals default to the tab, others to the browser', () => {
    expect(dismissScope({ mode: 'session' })).toBe('tab')
    expect(dismissScope({ mode: 'days', days: 3 })).toBe('browser')
    expect(dismissScope({ mode: 'never-again', scope: 'account' })).toBe(
      'account',
    )
  })

  test('parse keeps a valid scope and refuses an unknown one', () => {
    const base = {
      placement: 'bar',
      title: 'Hi',
      startsAt: T0,
      endsAt: T0 + HOUR,
    }
    const ok = parsePromotion({
      ...base,
      dismiss: { mode: 'days', days: 2, scope: 'cookie' },
    })
    expect(ok.ok && ok.value.dismiss).toEqual({
      mode: 'days',
      days: 2,
      scope: 'cookie',
    })
    expect(
      parsePromotion({ ...base, dismiss: { mode: 'session', scope: 'server' } })
        .ok,
    ).toBe(false)
  })

  test('composeStores routes each scope to its own store', () => {
    const account = memoryDismissalStore()
    const browser = memoryDismissalStore()
    const store = composeStores({ account, browser })
    store.set('promo:a:1', 5, 'account')
    store.set('promo:b:1', 7, 'browser')
    expect(account.get('promo:a:1', 'account')).toBe(5)
    expect(browser.get('promo:a:1', 'browser')).toBeNull()
    // No cookie store given: cookie falls back to the browser store.
    store.set('promo:c:1', 9, 'cookie')
    expect(browser.get('promo:c:1', 'cookie')).toBe(9)
  })

  test('memory store treats NaN as removal', () => {
    const store = memoryDismissalStore()
    store.set('k', 1, 'tab')
    store.set('k', Number.NaN, 'tab')
    expect(store.get('k', 'tab')).toBeNull()
  })

  test('reads promotion cookies from a header and ignores others', () => {
    const map = readPromotionCookies(
      'theme=dark; promo_promo_a_1=1700; promo_x=nope',
    )
    expect(map.get('promo_promo_a_1')).toBe(1700)
    expect(map.has('theme')).toBe(false)
    expect(map.has('promo_x')).toBe(false)
  })
})

describe('translations', () => {
  const record = promo({
    cta: { label: 'Upgrade', href: '/pricing' },
    translations: {
      fr: { title: 'Soldes', ctaLabel: 'Passer' },
      'pt-BR': { title: 'Promoção' },
    },
  })

  test('exact tag, then language, then the default copy', () => {
    expect(localizePromotion(record, 'pt-BR').title).toBe('Promoção')
    expect(localizePromotion(record, 'fr-CA').title).toBe('Soldes')
    expect(localizePromotion(record, 'fr').cta?.label).toBe('Passer')
    expect(localizePromotion(record, 'de').title).toBe('Spring sale')
    expect(localizePromotion(record, undefined)).toBe(record)
  })

  test('parse validates locale tags and plain text', () => {
    const base = {
      placement: 'card',
      title: 'Hi',
      startsAt: T0,
      endsAt: T0 + HOUR,
    }
    expect(
      parsePromotion({ ...base, translations: { fr: { title: 'Salut' } } }).ok,
    ).toBe(true)
    expect(
      parsePromotion({ ...base, translations: { 'not a tag': { title: 'x' } } })
        .ok,
    ).toBe(false)
    expect(
      parsePromotion({ ...base, translations: { fr: { title: '<b>x</b>' } } })
        .ok,
    ).toBe(false)
  })
})

describe('sheet placement', () => {
  test('one sheet is selected alongside the others', () => {
    const s = selectPromotions(
      [promo({ id: 's', placement: 'sheet' }), promo({ id: 't' })],
      { pathname: '/', now: T0 },
    )
    expect(s.sheet?.id).toBe('s')
    expect(s.toast?.id).toBe('t')
  })

  test('revealCode only sticks when there is a code', () => {
    const base = {
      placement: 'sheet',
      title: 'Hi',
      startsAt: T0,
      endsAt: T0 + HOUR,
      revealCode: true,
    }
    const withCode = parsePromotion({ ...base, code: 'SAVE10' })
    const without = parsePromotion(base)
    expect(withCode.ok && withCode.value.revealCode).toBe(true)
    expect(without.ok && without.value.revealCode).toBeUndefined()
  })
})

describe('label packs', () => {
  test('countdowns come from Intl in each language', () => {
    expect(promotionLabels.en.endsIn({ unit: 'day', value: 3 })).toBe(
      'Ends in 3 days',
    )
    expect(promotionLabels.en.endsIn({ unit: 'day', value: 1 })).toBe(
      'Ends tomorrow',
    )
    expect(promotionLabels.fr.endsIn({ unit: 'day', value: 3 })).toBe(
      'Se termine dans 3 jours',
    )
    expect(promotionLabels.de.endsIn({ unit: 'hour', value: 2 })).toBe(
      'Endet in 2 Stunden',
    )
    expect(promotionLabels.ja.endsIn({ unit: 'day', value: 3 })).toContain('3')
  })

  test('every pack defines every label', () => {
    const keys = Object.keys(promotionLabels.en).sort()
    for (const pack of Object.values(promotionLabels))
      expect(Object.keys(pack).sort()).toEqual(keys)
  })

  test('detects right-to-left locales', () => {
    expect(isRightToLeft('ar')).toBe(true)
    expect(isRightToLeft('he-IL')).toBe(true)
    expect(isRightToLeft('en')).toBe(false)
    expect(isRightToLeft('arn')).toBe(false)
  })
})

describe('review fixes', () => {
  test('isPromotion drops rows whose text fields would crash rendering', () => {
    const ok = promo()
    expect(isPromotion(ok)).toBe(true)
    expect(isPromotion({ ...ok, eyebrow: { nested: true } })).toBe(false)
    expect(isPromotion({ ...ok, code: 20 })).toBe(false)
    expect(
      isPromotion({ ...ok, translations: { fr: { title: { x: 1 } } } }),
    ).toBe(false)
    expect(isPromotion({ ...ok, frequency: { hours: '24' } })).toBe(false)
    expect(isPromotion({ ...ok, presentation: 'carousel' })).toBe(false)
    expect(
      isPromotion({
        ...ok,
        frequency: { hours: 12 },
        translations: { fr: { title: 'Soldes' } },
      }),
    ).toBe(true)
  })

  test('one malformed cookie is skipped, the rest still read', () => {
    const map = readPromotionCookies('promo_a=%E0%A4%A; promo_b=42')
    expect(map.has('promo_a')).toBe(false)
    expect(map.get('promo_b')).toBe(42)
  })
})
