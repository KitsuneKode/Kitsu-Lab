import { describe, expect, test } from 'bun:test'

import { parsePromotion, type PromotionContent } from './promotion'
import { initialDraft, names, toInput } from './promotion-editor-draft'

const T0 = Date.UTC(2026, 8, 29, 9)
const ZONE = 'UTC'

/** A record using every field the editor knows about, visible or not. */
const FULL: PromotionContent = {
  placement: 'dialog',
  title: 'Take 20% off your first year',
  body: 'Launch pricing for every seat.',
  eyebrow: 'Before you upgrade',
  tone: 'brand',
  code: 'TEAM20',
  revealCode: true,
  cta: { label: 'Upgrade', href: '/checkout' },
  include: ['/pricing'],
  exclude: [],
  startsAt: T0,
  endsAt: T0 + 7 * 86_400_000,
  priority: 70,
  dismiss: { mode: 'days', days: 3, scope: 'account' },
  frequency: { hours: 48 },
  triggers: ['upgrade-intent'],
  audience: { include: ['returning'], exclude: ['member'] },
  variants: [
    { id: 'control', weight: 2 },
    {
      id: 'urgency',
      weight: 1,
      title: 'Ends Sunday: 20% off',
      ctaLabel: 'Lock in 20%',
    },
  ],
  holdout: 10,
  campaign: 'launch-week',
  translations: { fr: { title: 'Profitez de 20 %' } },
}

/** Load a record into the form and save it without touching anything. */
function roundTrip(record: PromotionContent) {
  const draft = initialDraft(record, T0, ZONE)
  return parsePromotion(toInput(draft, ZONE, record))
}

describe('editor round trip', () => {
  test('saving an untouched record keeps every field', () => {
    const result = roundTrip(FULL)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const saved = result.value
    expect(saved.triggers).toEqual(['upgrade-intent'])
    expect(saved.audience).toEqual({
      include: ['returning'],
      exclude: ['member'],
    })
    expect(saved.variants).toEqual(FULL.variants)
    expect(saved.holdout).toBe(10)
    expect(saved.frequency).toEqual({ hours: 48 })
    expect(saved.campaign).toBe('launch-week')
    expect(saved.revealCode).toBe(true)
    expect(saved.dismiss).toEqual({ mode: 'days', days: 3, scope: 'account' })
    expect(saved.translations).toEqual(FULL.translations)
  })

  test('a plain record stays plain: no empty extras appear', () => {
    const plain: PromotionContent = {
      placement: 'bar',
      title: 'Hello',
      tone: 'neutral',
      include: [],
      exclude: [],
      startsAt: T0,
      endsAt: T0 + 86_400_000,
      priority: 50,
      dismiss: { mode: 'session' },
    }
    const result = roundTrip(plain)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    for (const key of [
      'triggers',
      'audience',
      'variants',
      'holdout',
      'frequency',
      'campaign',
      'revealCode',
    ])
      expect(key in result.value).toBe(false)
    expect('scope' in result.value.dismiss).toBe(false)
  })

  test('switching to a bar drops options a bar cannot use, without errors', () => {
    const draft = { ...initialDraft(FULL, T0, ZONE), placement: 'bar' as const }
    const result = parsePromotion(toInput(draft, ZONE, FULL))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.triggers).toBeUndefined()
    expect(result.value.frequency).toBeUndefined()
  })

  test('a variant with an invalid name is reported on variants', () => {
    const draft = initialDraft(FULL, T0, ZONE)
    draft.variants = [{ ...draft.variants[0]!, id: 'Has Spaces' }]
    const result = parsePromotion(toInput(draft, ZONE, FULL))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.errors.variants).toBeDefined()
  })

  test('names splits on commas and spaces', () => {
    expect(names(' member, plan:pro  cart:50+ ,')).toEqual([
      'member',
      'plan:pro',
      'cart:50+',
    ])
    expect(names('')).toEqual([])
  })
})
