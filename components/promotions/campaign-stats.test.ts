import { describe, expect, test } from 'bun:test'

import { campaignStats, compare, wilson, type ArmStats } from './campaign-stats'
import type { PromotionEvent } from './promotion-provider'

function events(
  arm: string | undefined,
  type: PromotionEvent['type'],
  count: number,
  id = 'offer',
): PromotionEvent[] {
  return Array.from({ length: count }, () => ({
    type,
    id,
    placement: 'toast' as const,
    campaign: 'spring',
    ...(arm ? { variant: arm } : {}),
    pathname: '/pricing',
  }))
}

const arm = (
  name: string,
  exposures: number,
  conversions: number,
): ArmStats => ({
  arm: name,
  exposures,
  clicks: 0,
  conversions,
  dismissals: 0,
  rate: conversions / exposures,
  interval: wilson(conversions, exposures),
})

describe('campaign stats', () => {
  test('Wilson intervals match known values and stay inside [0, 1]', () => {
    const [lo, hi] = wilson(50, 1000)
    expect(lo).toBeCloseTo(0.0381, 3)
    expect(hi).toBeCloseTo(0.0653, 3)
    expect(wilson(0, 10)[0]).toBe(0)
    expect(wilson(10, 10)[1]).toBe(1)
    expect(wilson(0, 0)).toEqual([0, 0])
  })

  test('a clear win is called better, with a significant p-value', () => {
    const result = compare(
      arm('b', 1000, 80),
      arm('control', 1000, 50),
      'convert',
    )
    expect(result.verdict).toBe('better')
    expect(result.difference).toBeCloseTo(0.03, 5)
    expect(result.relative).toBeCloseTo(0.6, 5)
    expect(result.pValue).toBeLessThan(0.01)
    expect(result.interval[0]).toBeGreaterThan(0)
  })

  test('a small sample says not enough data, and how much more is needed', () => {
    const result = compare(arm('b', 40, 3), arm('control', 40, 2), 'convert')
    expect(result.verdict).toBe('not-enough-data')
    expect(result.moreNeeded).toBeGreaterThan(0)
  })

  test('a real but unproven difference is unclear, never better', () => {
    const result = compare(
      arm('b', 400, 26),
      arm('control', 400, 20),
      'convert',
    )
    expect(result.verdict).toBe('unclear')
    expect(result.moreNeeded).toBeGreaterThan(0)
  })

  test('arms from events: control first, holdout last, lift against holdout', () => {
    const log = [
      ...events('control', 'impression', 500),
      ...events('control', 'convert', 25),
      ...events('bold', 'impression', 500),
      ...events('bold', 'convert', 40),
      ...events(undefined, 'holdout', 200),
      ...events('holdout', 'convert', 4),
      ...events('control', 'click', 60),
    ]
    const [record] = campaignStats(log)
    expect(record!.arms.map((a) => a.arm)).toEqual([
      'control',
      'bold',
      'holdout',
    ])
    expect(record!.arms[0]!.rate).toBeCloseTo(0.05, 5)
    expect(record!.comparisons.map((c) => `${c.arm}>${c.against}`)).toEqual([
      'bold>control',
      'shown>holdout',
    ])
    const lift = record!.comparisons[1]!
    expect(lift.difference).toBeCloseTo(65 / 1000 - 4 / 200, 5)
  })

  test('the click metric reads clicks, and rates never pass 100%', () => {
    const log = [
      ...events(undefined, 'impression', 3),
      ...events(undefined, 'click', 5),
    ]
    const [record] = campaignStats(log, { metric: 'click' })
    expect(record!.arms[0]!.rate).toBe(1)
  })
})

test('a verdict never contradicts its interval', () => {
  // Near the boundary a pooled test and an unpooled interval used to disagree.
  for (const [n1, s1, n2, s2] of [
    [3229, 167, 771, 27],
    [1000, 80, 1000, 50],
    [400, 26, 400, 20],
    [500, 30, 500, 45],
  ] as const) {
    const result = compare(arm('a', n1, s1), arm('b', n2, s2), 'convert')
    const excludesZero = result.interval[0] > 0 || result.interval[1] < 0
    expect(result.verdict === 'better' || result.verdict === 'worse').toBe(
      excludesZero,
    )
  }
})
