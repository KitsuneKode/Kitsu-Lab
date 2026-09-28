import type { PromotionEvent } from '@/components/promotions'

/**
 * Simulated visitors for the Results tab, with known true rates, so the
 * statistics can be watched converging on the truth. Deterministic: the
 * same batch number always produces the same visitors.
 */
export const SIMULATED_TRUTH = [
  {
    id: 'launch-offer',
    placement: 'toast',
    campaign: 'launch-offer',
    arms: { control: 0.06, urgency: 0.085 },
    note: 'Toast: the urgency arm truly converts 8.5% against 6%.',
  },
  {
    id: 'launch-upgrade',
    placement: 'dialog',
    campaign: 'launch-week',
    holdout: 0.2,
    arms: { all: 0.05 },
    heldRate: 0.035,
    note: 'Upgrade dialog: 5% when shown, 3.5% for the 20% held out.',
  },
] as const

/** mulberry32: small, fast, and good enough for a demo. */
function random(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function simulateVisitors(
  count: number,
  batch: number,
): PromotionEvent[] {
  const next = random(0x51eed + batch * 7919)
  const events: PromotionEvent[] = []
  for (let i = 0; i < count; i += 1) {
    for (const record of SIMULATED_TRUTH) {
      const base = {
        id: record.id,
        placement: record.placement,
        campaign: record.campaign,
        pathname: '/pricing',
      } as const
      if ('holdout' in record && next() < record.holdout) {
        events.push({ ...base, type: 'holdout' })
        if (next() < record.heldRate)
          events.push({ ...base, type: 'convert', variant: 'holdout' })
        continue
      }
      const arms = Object.entries(record.arms)
      const [arm, rate] = arms[Math.floor(next() * arms.length)]!
      const variant = arm === 'all' ? {} : { variant: arm }
      events.push({ ...base, ...variant, type: 'impression' })
      const converted = next() < rate
      if (converted || next() < 0.04)
        events.push({ ...base, ...variant, type: 'click' })
      if (converted) events.push({ ...base, ...variant, type: 'convert' })
    }
  }
  return events
}
