import { describe, expect, test } from 'bun:test'

import { parsePromotion, type PromotionContent } from './promotion'
import { promotionJsonSchema, promotionSchemaFields } from './promotion-schema'

/**
 * Every field an editor or agent can set. A new field on PromotionContent
 * fails to compile here until it is listed, and then fails the test below
 * until the schema describes it.
 */
const CONTENT_FIELDS: Record<keyof PromotionContent, true> = {
  placement: true,
  slot: true,
  presentation: true,
  eyebrow: true,
  title: true,
  body: true,
  media: true,
  gallery: true,
  cta: true,
  code: true,
  revealCode: true,
  tone: true,
  include: true,
  exclude: true,
  startsAt: true,
  endsAt: true,
  priority: true,
  dismiss: true,
  showCountdown: true,
  frequency: true,
  triggers: true,
  audience: true,
  variants: true,
  holdout: true,
  campaign: true,
  translations: true,
}

const T0 = Date.UTC(2026, 8, 28)

describe('promotion JSON schema', () => {
  test('describes every field the parser accepts, and nothing else', () => {
    expect([...promotionSchemaFields].sort()).toEqual(
      Object.keys(CONTENT_FIELDS).sort(),
    )
  })

  test('limits come from the parser constants', () => {
    const { title, priority } = promotionJsonSchema.properties
    expect(title.maxLength).toBe(80)
    expect(priority.maximum).toBe(100)
  })

  test('a campaign shaped by the schema parses', () => {
    // What an assistant might write from the schema alone.
    const written = {
      placement: 'side',
      eyebrow: 'Launch week',
      title: 'Today: ink on any page',
      body: 'Pen and marker, kept with the page.',
      media: {
        src: '/clips/ink.webp',
        alt: 'Ink drawn on a page',
        width: 960,
        height: 600,
        video: {
          sources: [
            { src: '/clips/ink.webm', type: 'video/webm' },
            { src: '/clips/ink.mp4', type: 'video/mp4' },
          ],
        },
      },
      cta: { label: 'Follow along', href: '/changelog' },
      tone: 'brand',
      include: ['/', '/pricing'],
      exclude: ['/checkout'],
      startsAt: T0,
      endsAt: T0 + 4 * 86_400_000,
      priority: 60,
      dismiss: { mode: 'days', days: 7, scope: 'browser' },
      audience: { exclude: ['member'] },
      variants: [{ id: 'control' }, { id: 'short', title: 'Ink is here' }],
      holdout: 10,
      campaign: 'launch-week',
      translations: { fr: { title: 'Aujourd’hui : l’encre partout' } },
    }
    const result = parsePromotion(written)
    expect(result.ok).toBe(true)
  })
})
