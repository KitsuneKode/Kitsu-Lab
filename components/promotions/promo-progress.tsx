'use client'

import * as React from 'react'
import { IconCheck } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

/**
 * "€16 away from free shipping". Progress towards a reward the visitor
 * already wants, so it helps rather than interrupts. It needs no provider:
 * the host passes the current value (a cart total, lessons completed) and the
 * goal, and decides what the reward is.
 *
 * The fill animates with `scaleX` (transform only) on a strong ease-out.
 * The text is a polite live region, so a screen reader hears the change once
 * the cart updates, not on every render.
 */
export function PromoProgress({
  value,
  goal,
  reward,
  format = (n) => String(n),
  remaining = (left, rewardText) => (
    <>
      You’re <b className="font-semibold tabular-nums">{left}</b> away from{' '}
      {rewardText}
    </>
  ),
  reached = (rewardText) => (
    <>
      You’ve unlocked <b className="font-semibold">{rewardText}</b>
    </>
  ),
  className,
}: {
  value: number
  goal: number
  /** e.g. "free shipping", "a free notebook". */
  reward: string
  /** Formats amounts, e.g. `(n) => euro.format(n)`. */
  format?: (n: number) => string
  remaining?: (left: string, reward: string) => React.ReactNode
  reached?: (reward: string) => React.ReactNode
  className?: string
}) {
  const safeGoal = goal > 0 ? goal : 1
  const ratio = Math.min(1, Math.max(0, value / safeGoal))
  const done = ratio >= 1
  const left = Math.max(0, safeGoal - value)
  return (
    <div
      data-slot="promo-progress"
      data-state={done ? 'reached' : 'progress'}
      className={cn('flex flex-col gap-2 text-sm', className)}
    >
      <p aria-live="polite" className="flex items-center gap-1.5">
        {done ? (
          <IconCheck
            aria-hidden
            className="size-4 text-emerald-600 dark:text-emerald-400"
          />
        ) : null}
        <span>{done ? reached(reward) : remaining(format(left), reward)}</span>
      </p>
      <div
        role="progressbar"
        aria-label={reward}
        aria-valuemin={0}
        aria-valuemax={safeGoal}
        aria-valuenow={Math.min(value, safeGoal)}
        aria-valuetext={done ? reward : format(left)}
        className="bg-muted h-2 overflow-hidden rounded-full forced-colors:border"
      >
        <div
          className={cn(
            'h-full origin-left rounded-full transition-[transform,background-color] duration-400 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none rtl:origin-right',
            done ? 'bg-emerald-600 dark:bg-emerald-400' : 'bg-primary',
          )}
          style={{ transform: `scaleX(${ratio})` }}
        />
      </div>
    </div>
  )
}
