import { describe, expect, test } from 'bun:test'

import {
  combineSinks,
  dataLayerSink,
  eventProperties,
  ga4Sink,
  posthogSink,
  segmentSink,
  vercelSink,
} from './promotion-analytics'
import type { PromotionEvent } from './promotion-provider'

const click: PromotionEvent = {
  type: 'click',
  id: 'launch-offer',
  placement: 'toast',
  campaign: 'launch-week',
  variant: 'urgency',
  pathname: '/pricing',
}

describe('analytics sinks', () => {
  test('properties are flat and omit what is absent', () => {
    expect(
      eventProperties({ ...click, campaign: undefined, variant: undefined }),
    ).toEqual({
      promotion_id: 'launch-offer',
      placement: 'toast',
      pathname: '/pricing',
    })
  })

  test('values stay within GA4 limits', () => {
    const long = eventProperties({ ...click, pathname: `/${'a'.repeat(300)}` })
    expect(long.pathname).toHaveLength(100)
  })

  test('each vendor gets its own call shape', () => {
    const calls: unknown[][] = []
    posthogSink({ capture: (...a) => calls.push(['posthog', ...a]) })(click)
    ga4Sink((...a) => calls.push(['gtag', ...a]))(click)
    segmentSink({ track: (...a) => calls.push(['segment', ...a]) })(click)
    vercelSink((...a) => calls.push(['vercel', ...a]))(click)
    const layer: unknown[] = []
    dataLayerSink(layer)(click)
    expect(calls.map((c) => c.slice(0, 3))).toEqual([
      [
        'posthog',
        'promotion_click',
        expect.objectContaining({ variant: 'urgency' }),
      ],
      ['gtag', 'event', 'promotion_click'],
      [
        'segment',
        'promotion_click',
        expect.objectContaining({ campaign: 'launch-week' }),
      ],
      [
        'vercel',
        'promotion_click',
        expect.objectContaining({ placement: 'toast' }),
      ],
    ])
    expect(layer).toEqual([
      expect.objectContaining({
        event: 'promotion_click',
        promotion_id: 'launch-offer',
      }),
    ])
  })

  test('include and prefix narrow and rename', () => {
    const names: string[] = []
    const send = vercelSink((name) => names.push(name), {
      prefix: 'promo.',
      include: ['click', 'convert'],
    })
    send({ ...click, type: 'impression' })
    send(click)
    expect(names).toEqual(['promo.click'])
  })

  test('a throwing vendor never reaches the page or the other sinks', () => {
    const heard: string[] = []
    const all = combineSinks(
      posthogSink({
        capture: () => {
          throw new Error('blocked by an ad blocker')
        },
      }),
      false,
      (event) => {
        throw new Error(`custom sink failed on ${event.type}`)
      },
      vercelSink((name) => heard.push(name)),
    )
    expect(() => all(click)).not.toThrow()
    expect(heard).toEqual(['promotion_click'])
  })
})
