import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

/**
 * Animated audio bars shown while read-aloud is active — the affordance
 * ElevenLabs-style audio UIs use, adapted to SpeechSynthesis (which has no
 * media element to wire a real waveform/analyser to). Pure CSS, currentColor,
 * and frozen under prefers-reduced-motion.
 */
export function SpeakingBars({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      {...props}
      aria-hidden
      className={cn('inline-flex items-end gap-[3px]', className)}
    >
      {[0, 1, 2].map((bar) => (
        <span
          key={bar}
          className="bp-speaking-bar inline-block w-[2px] rounded-full bg-current"
          style={{ animationDelay: `${bar * 140}ms` }}
        />
      ))}
    </span>
  )
}
