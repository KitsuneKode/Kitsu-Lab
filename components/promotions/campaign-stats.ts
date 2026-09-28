/**
 * Campaign results from the provider's own events, with honest uncertainty.
 * No React and no dependencies, so it runs anywhere: in the browser over a
 * live event log, or on the server over events from your warehouse.
 *
 * Rates are per exposure: an impression for a shown arm, a `holdout` event
 * for the kept-out group (both counted once per page view).
 */
import type { PromotionEvent } from './promotion-provider'

export type Metric = 'click' | 'convert'

export type ArmStats = {
  /** `control`, a variant id, `holdout`, or `all` for a record without arms. */
  arm: string
  exposures: number
  clicks: number
  conversions: number
  dismissals: number
  /** Successes for the chosen metric over exposures; 0 with no exposures. */
  rate: number
  /** 95% Wilson interval for `rate`. */
  interval: [number, number]
}

export type Verdict = 'better' | 'worse' | 'unclear' | 'not-enough-data'

export type Comparison = {
  arm: string
  against: string
  /** Difference in rates, arm minus baseline (percentage points / 100). */
  difference: number
  /** Relative change against the baseline rate; null when that is 0. */
  relative: number | null
  /** 95% interval for `difference`. */
  interval: [number, number]
  /** Two-sided p-value of a two-proportion z-test. */
  pValue: number
  verdict: Verdict
  /** Rough exposures per arm still needed to call it, when not enough data. */
  moreNeeded: number | null
}

export type RecordStats = {
  id: string
  placement: PromotionEvent['placement']
  campaign?: string
  /** Control first, other arms by name, holdout last. */
  arms: ArmStats[]
  /** Each arm against control, and everyone shown against the holdout. */
  comparisons: Comparison[]
}

const Z = 1.959964 // 95%
const Z_POWER = 0.841621 // 80% power

/** 95% Wilson score interval for `successes` of `n`. */
export function wilson(successes: number, n: number): [number, number] {
  if (n === 0) return [0, 0]
  const p = successes / n
  const z2 = Z * Z
  const center = (p + z2 / (2 * n)) / (1 + z2 / n)
  const half =
    (Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n)
  // Exact at the extremes; floating point would leave 0.9999999999999999.
  return [
    successes === 0 ? 0 : Math.max(0, center - half),
    successes === n ? 1 : Math.min(1, center + half),
  ]
}

/** Standard normal CDF (Abramowitz and Stegun 7.1.26, error under 1.5e-7). */
function normalCdf(x: number): number {
  const t = 1 / (1 + 0.3275911 * (Math.abs(x) / Math.SQRT2))
  const poly =
    t *
    (0.254829592 +
      t *
        (-0.284496736 +
          t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  const erf = 1 - poly * Math.exp(-(x * x) / 2)
  return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

/** The normal approximation holds once each arm has 5 successes and 5 failures. */
function enough(successes: number, n: number) {
  return successes >= 5 && n - successes >= 5
}

/** Compares `arm` with `base` on their rates. */
export function compare(
  arm: ArmStats,
  base: ArmStats,
  metric: Metric,
): Comparison {
  const s1 = metric === 'click' ? arm.clicks : arm.conversions
  const s2 = metric === 'click' ? base.clicks : base.conversions
  const n1 = arm.exposures
  const n2 = base.exposures
  const p1 = n1 ? s1 / n1 : 0
  const p2 = n2 ? s2 / n2 : 0
  const difference = p1 - p2
  const unpooled = Math.sqrt(
    (n1 ? (p1 * (1 - p1)) / n1 : 0) + (n2 ? (p2 * (1 - p2)) / n2 : 0),
  )
  // The test and the interval share one standard error, so a verdict can
  // never contradict the interval printed beside it (a pooled test and an
  // unpooled interval disagree near the boundary).
  const z = unpooled > 0 && n1 && n2 ? difference / unpooled : 0
  const pValue = z === 0 ? 1 : 2 * (1 - normalCdf(Math.abs(z)))
  const interval: [number, number] = [
    difference - Z * unpooled,
    difference + Z * unpooled,
  ]
  const ready = enough(s1, n1) && enough(s2, n2)
  const verdict: Verdict = !ready
    ? 'not-enough-data'
    : pValue < 0.05
      ? difference > 0
        ? 'better'
        : 'worse'
      : 'unclear'
  let moreNeeded: number | null = null
  if (verdict === 'not-enough-data' || verdict === 'unclear') {
    // Exposures per arm to detect the observed difference (or a 20% relative
    // change when there is none yet) at 95% confidence and 80% power.
    const baseRate = p2 || p1 || 0
    const target = Math.abs(difference) || baseRate * 0.2
    if (target > 0 && baseRate > 0 && baseRate < 1) {
      const variance =
        p1 * (1 - p1) + p2 * (1 - p2) || 2 * baseRate * (1 - baseRate)
      const perArm = Math.ceil(((Z + Z_POWER) ** 2 * variance) / target ** 2)
      moreNeeded = Math.max(0, perArm - Math.min(n1, n2))
    }
  }
  return {
    arm: arm.arm,
    against: base.arm,
    difference,
    relative: p2 > 0 ? difference / p2 : null,
    interval,
    pValue,
    verdict,
    moreNeeded,
  }
}

function emptyArm(arm: string): ArmStats {
  return {
    arm,
    exposures: 0,
    clicks: 0,
    conversions: 0,
    dismissals: 0,
    rate: 0,
    interval: [0, 0],
  }
}

function armOrder(a: string, b: string) {
  const rank = (arm: string) =>
    arm === 'control' ? 0 : arm === 'holdout' ? 2 : 1
  return rank(a) - rank(b) || a.localeCompare(b)
}

/** Per-record arms and comparisons from a list of provider events. */
export function campaignStats(
  events: readonly PromotionEvent[],
  { metric = 'convert' }: { metric?: Metric } = {},
): RecordStats[] {
  const records = new Map<
    string,
    {
      placement: PromotionEvent['placement']
      campaign?: string
      arms: Map<string, ArmStats>
    }
  >()
  for (const event of events) {
    let record = records.get(event.id)
    if (!record) {
      record = {
        placement: event.placement,
        campaign: event.campaign,
        arms: new Map(),
      }
      records.set(event.id, record)
    }
    const name = event.type === 'holdout' ? 'holdout' : (event.variant ?? 'all')
    const arm = record.arms.get(name) ?? emptyArm(name)
    record.arms.set(name, arm)
    if (event.type === 'impression' || event.type === 'holdout')
      arm.exposures += 1
    else if (event.type === 'click') arm.clicks += 1
    else if (event.type === 'convert') arm.conversions += 1
    else if (event.type === 'dismiss') arm.dismissals += 1
  }

  return [...records].map(([id, record]) => {
    const arms = [...record.arms.values()]
      .filter((arm) => arm.exposures > 0 || arm.conversions > 0)
      .sort((a, b) => armOrder(a.arm, b.arm))
    for (const arm of arms) {
      const successes = metric === 'click' ? arm.clicks : arm.conversions
      // A conversion can come from a visitor exposed on another page view;
      // never report a rate above 100%.
      const capped = Math.min(successes, arm.exposures)
      arm.rate = arm.exposures ? capped / arm.exposures : 0
      arm.interval = wilson(capped, arm.exposures)
    }
    const comparisons: Comparison[] = []
    const control = arms.find((arm) => arm.arm === 'control')
    if (control)
      for (const arm of arms)
        if (arm.arm !== 'control' && arm.arm !== 'holdout')
          comparisons.push(compare(arm, control, metric))
    const holdout = arms.find((arm) => arm.arm === 'holdout')
    if (holdout) {
      const shown = arms.filter((arm) => arm.arm !== 'holdout')
      const all = shown.reduce<ArmStats>(
        (sum, arm) => ({
          ...sum,
          exposures: sum.exposures + arm.exposures,
          clicks: sum.clicks + arm.clicks,
          conversions: sum.conversions + arm.conversions,
          dismissals: sum.dismissals + arm.dismissals,
        }),
        emptyArm('shown'),
      )
      if (all.exposures) comparisons.push(compare(all, holdout, metric))
    }
    return {
      id,
      placement: record.placement,
      campaign: record.campaign,
      arms,
      comparisons,
    }
  })
}
