'use client'

import * as React from 'react'
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconHourglass,
  IconMinus,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import type { Promotion } from './promotion'
import type { PromotionEvent } from './promotion-provider'
import {
  campaignStats,
  type ArmStats,
  type Comparison,
  type Metric,
  type RecordStats,
} from './campaign-stats'

const VERDICT = {
  better: { icon: IconArrowUpRight, label: 'Better' },
  worse: { icon: IconArrowDownRight, label: 'Worse' },
  unclear: { icon: IconMinus, label: 'No clear difference yet' },
  'not-enough-data': { icon: IconHourglass, label: 'Not enough data yet' },
} as const

/**
 * What each campaign did, from the provider's own events: exposures, click
 * and conversion rates per arm with 95% intervals, and a plain verdict for
 * every arm against control and for showing it at all against the holdout.
 *
 * It never overstates: until each arm has enough outcomes the verdict is
 * "not enough data yet" with a rough count of what is still needed, and a
 * difference that could be chance says so. Numbers are always in text; the
 * bars (one scale, leader emphasised, interval as a thin line) only help
 * the eye.
 */
export function CampaignResults({
  events,
  promotions = [],
  locale,
  defaultMetric = 'convert',
  className,
}: {
  events: readonly PromotionEvent[]
  /** To show titles instead of ids. */
  promotions?: readonly Pick<Promotion, 'id' | 'title'>[]
  locale?: string
  defaultMetric?: Metric
  className?: string
}) {
  const [metric, setMetric] = React.useState<Metric>(defaultMetric)
  const stats = React.useMemo(
    () => campaignStats(events, { metric }),
    [events, metric],
  )
  const titles = new Map(promotions.map((p) => [p.id, p.title]))
  // One decimal always, so rates line up in their column (6.0% by 7.8%).
  const percent = new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  const count = new Intl.NumberFormat(locale)

  return (
    <section
      aria-label="Campaign results"
      data-slot="campaign-results"
      className={cn('flex flex-col gap-6', className)}
    >
      {/* Filters live in one row above every result. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground text-sm">
          {stats.length
            ? `${stats.length} ${stats.length === 1 ? 'campaign' : 'campaigns'} measured`
            : 'No results yet'}
        </p>
        <div
          role="radiogroup"
          aria-label="Measure"
          className="bg-muted inline-flex rounded-lg p-0.5 text-sm"
        >
          {(['convert', 'click'] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={metric === value}
              onClick={() => setMetric(value)}
              className={cn(
                'focus-visible:ring-ring/50 rounded-md px-3 py-1 transition-[background-color,color] duration-150 outline-none focus-visible:ring-3',
                metric === value
                  ? 'bg-background text-foreground shadow-xs'
                  : // muted-foreground on the muted track is under 4.5:1 in light.
                    'text-foreground/70 hover:text-foreground',
              )}
            >
              {value === 'convert' ? 'Conversions' : 'Clicks'}
            </button>
          ))}
        </div>
      </div>

      {stats.length === 0 ? (
        <p className="text-muted-foreground max-w-prose text-sm text-pretty">
          Exposures, clicks and conversions appear here as visitors see your
          campaigns. Send the provider’s events here, or read them back from
          your analytics.
        </p>
      ) : (
        stats.map((record) => (
          <RecordResult
            key={record.id}
            record={record}
            title={titles.get(record.id) ?? record.id}
            metric={metric}
            percent={percent}
            count={count}
          />
        ))
      )}
    </section>
  )
}

function RecordResult({
  record,
  title,
  metric,
  percent,
  count,
}: {
  record: RecordStats
  title: string
  metric: Metric
  percent: Intl.NumberFormat
  count: Intl.NumberFormat
}) {
  const shown = record.arms.filter((arm) => arm.arm !== 'holdout')
  const exposures = shown.reduce((sum, arm) => sum + arm.exposures, 0)
  const clicks = shown.reduce((sum, arm) => sum + arm.clicks, 0)
  const conversions = shown.reduce((sum, arm) => sum + arm.conversions, 0)
  const rate = (n: number) => (exposures ? Math.min(1, n / exposures) : 0)
  // One scale for every bar in this record, with room for the intervals.
  const top = Math.max(0.01, ...record.arms.map((arm) => arm.interval[1]))
  const leader = [...shown].sort((a, b) => b.rate - a.rate)[0]?.arm
  const armLabel = (arm: string) =>
    arm === 'all'
      ? 'Everyone shown'
      : arm === 'holdout'
        ? 'Holdout (not shown)'
        : arm === 'shown'
          ? 'Everyone shown'
          : arm === 'control'
            ? 'Control'
            : arm.charAt(0).toUpperCase() + arm.slice(1)

  return (
    <article className="border-border/60 flex flex-col gap-5 rounded-xl border p-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-medium text-balance">{title}</h3>
        <span className="text-muted-foreground text-xs">
          {record.placement}
          {record.campaign ? ` · ${record.campaign}` : ''}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-4">
        {[
          ['Exposures', count.format(exposures)],
          ['Click rate', percent.format(rate(clicks))],
          ['Conversion rate', percent.format(rate(conversions))],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-1">
            <dt className="text-muted-foreground text-xs">{label}</dt>
            <dd className="text-2xl font-medium tracking-tight">{value}</dd>
          </div>
        ))}
      </dl>

      <table className="w-full text-sm">
        <caption className="sr-only">
          {metric === 'convert' ? 'Conversion' : 'Click'} rate by arm, with 95%
          intervals
        </caption>
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th scope="col" className="pb-2 text-start font-normal">
              Arm
            </th>
            <th scope="col" className="pb-2 text-end font-normal">
              Exposures
            </th>
            <th scope="col" className="pb-2 text-end font-normal">
              {metric === 'convert' ? 'Conversions' : 'Clicks'}
            </th>
            <th scope="col" className="ps-4 pb-2 text-start font-normal">
              Rate, 95% interval
            </th>
          </tr>
        </thead>
        <tbody>
          {record.arms.map((arm) => (
            <ArmRow
              key={arm.arm}
              arm={arm}
              label={armLabel(arm.arm)}
              lead={arm.arm === leader && shown.length > 1}
              top={top}
              metric={metric}
              percent={percent}
              count={count}
            />
          ))}
        </tbody>
      </table>

      {record.comparisons.length ? (
        <ul className="flex flex-col gap-2 text-sm">
          {record.comparisons.map((comparison) => (
            <VerdictLine
              key={`${comparison.arm}-${comparison.against}`}
              comparison={comparison}
              armLabel={armLabel}
              percent={percent}
              count={count}
            />
          ))}
        </ul>
      ) : null}
    </article>
  )
}

function ArmRow({
  arm,
  label,
  lead,
  top,
  metric,
  percent,
  count,
}: {
  arm: ArmStats
  label: string
  lead: boolean
  top: number
  metric: Metric
  percent: Intl.NumberFormat
  count: Intl.NumberFormat
}) {
  const at = (value: number) => `${Math.min(100, (value / top) * 100)}%`
  return (
    <tr className="border-border/60 border-t">
      <th scope="row" className="py-2.5 pe-3 text-start font-medium">
        {label}
      </th>
      <td className="py-2.5 text-end tabular-nums">
        {count.format(arm.exposures)}
      </td>
      <td className="py-2.5 text-end tabular-nums">
        {count.format(metric === 'convert' ? arm.conversions : arm.clicks)}
      </td>
      <td className="py-2.5 ps-4">
        <div className="flex items-center gap-3">
          <span className="w-28 shrink-0 tabular-nums">
            {percent.format(arm.rate)}
            <span className="text-muted-foreground text-xs">
              {' '}
              {percent.format(arm.interval[0])} to{' '}
              {percent.format(arm.interval[1])}
            </span>
          </span>
          {/* One scale per record; the leader carries the emphasis. */}
          <span aria-hidden className="relative h-2 min-w-16 flex-1">
            <span
              className={cn(
                'absolute inset-y-0 start-0 rounded-e-[4px]',
                lead ? 'bg-primary' : 'bg-muted-foreground/40',
              )}
              style={{ width: at(arm.rate) }}
            />
            <span
              className="bg-foreground/70 absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
              style={{
                insetInlineStart: at(arm.interval[0]),
                width: `calc(${at(arm.interval[1])} - ${at(arm.interval[0])})`,
              }}
            />
          </span>
        </div>
      </td>
    </tr>
  )
}

function VerdictLine({
  comparison,
  armLabel,
  percent,
  count,
}: {
  comparison: Comparison
  armLabel: (arm: string) => string
  percent: Intl.NumberFormat
  count: Intl.NumberFormat
}) {
  const verdict = VERDICT[comparison.verdict]
  const Icon = verdict.icon
  const points = (value: number) =>
    `${value >= 0 ? '+' : '−'}${Math.abs(value * 100).toFixed(1)} pts`
  const against =
    comparison.against === 'holdout'
      ? 'not showing it'
      : armLabel(comparison.against).toLowerCase()
  const subject =
    comparison.arm === 'shown' ? 'Showing it' : armLabel(comparison.arm)
  return (
    <li className="flex items-start gap-2">
      <Icon
        aria-hidden
        className="text-muted-foreground mt-0.5 size-4 shrink-0"
      />
      <p className="text-pretty">
        <span className="font-medium">{verdict.label}.</span>{' '}
        <span className="text-muted-foreground">
          {subject} against {against}: {points(comparison.difference)}
          {comparison.relative !== null
            ? ` (${comparison.relative >= 0 ? '+' : '−'}${percent.format(Math.abs(comparison.relative))})`
            : ''}
          , 95% interval {points(comparison.interval[0])} to{' '}
          {points(comparison.interval[1])}.
          {comparison.moreNeeded
            ? ` About ${count.format(comparison.moreNeeded)} more exposures per arm to tell.`
            : ''}
        </span>
      </p>
    </li>
  )
}
