'use client'

import * as React from 'react'
import { Popover } from '@base-ui/react/popover'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import type { Promotion } from './promotion'
import { usePromotions } from './promotion-provider'

export type TourStep = {
  /** A CSS selector for what this step explains, e.g. `[data-tour="share"]`. */
  target: string
  title: string
  body?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

/** The event `startTour` sends; a tour listens for its own id. */
export const PROMOTION_TOUR_EVENT = 'promotion:tour'

/**
 * Starts (or resumes) a tour. Call it from something the visitor did, like
 * a "Take the tour" button: a tour never starts by itself.
 */
export function startTour(id: string, { restart = false } = {}) {
  window.dispatchEvent(
    new CustomEvent(PROMOTION_TOUR_EVENT, { detail: { id, restart } }),
  )
}

const HALO = 'promo-tour-halo'

/** Laid out and not hidden: responsive layouts often keep a hidden twin of
    a control for another breakpoint, and a step should point at the one
    the visitor can see. */
function isShown(element: Element) {
  if (element.getClientRects().length === 0) return false
  return getComputedStyle(element).visibility !== 'hidden'
}

function ensureHalo() {
  if (document.getElementById(HALO)) return
  const style = document.createElement('style')
  style.id = HALO
  style.textContent = `
[data-promo-toured] {
  outline: 2px solid color-mix(in oklch, var(--primary) 70%, transparent);
  outline-offset: 4px;
  border-radius: 6px;
}
@media (forced-colors: active) { [data-promo-toured] { outline-color: Highlight; } }`
  document.head.append(style)
}

/**
 * A product tour: a few steps, each pointing at one thing on the page.
 *
 * It only starts when asked (`startTour(id)`), resumes where the visitor
 * left off, and skips a step whose target is not on the page rather than
 * stalling. Each step scrolls its target into view and outlines it; the
 * card says where the visitor is ("2 of 4") and offers Back, Next and Skip.
 * Focus moves into the card so keyboard users can follow, and returns to
 * whatever started the tour. Escape pauses it.
 *
 * Events go through the provider like any campaign: an impression when it
 * starts, a click when it is finished, a dismiss when it is skipped, so
 * completion rates show up in your analytics and in CampaignResults.
 */
export function PromoTour({
  id,
  steps,
  label = 'Tour',
  container,
}: {
  id: string
  steps: readonly TourStep[]
  /** Shown in reports and to assistive tech. */
  label?: string
  /** Where targets are looked up and the card portals, e.g. a demo frame. */
  container?: HTMLElement | null
}) {
  const { report, recall, remember } = usePromotions()
  const reduce = useReducedMotion()
  const [step, setStep] = React.useState<number | null>(null)
  const [target, setTarget] = React.useState<Element | null>(null)
  const opener = React.useRef<HTMLElement | null>(null)
  const nextButton = React.useRef<HTMLButtonElement>(null)
  const record = React.useMemo(
    () =>
      ({
        id,
        placement: 'spotlight',
        campaign: id,
        title: label,
        state: 'published',
        tone: 'neutral',
        include: [],
        exclude: [],
        startsAt: 0,
        endsAt: 0,
        priority: 0,
        dismiss: { mode: 'session' },
        dismissalVersion: 1,
        revision: 1,
      }) satisfies Promotion,
    [id, label],
  )
  const markKey = `tour:${id}`

  const find = React.useCallback(
    (selector: string) =>
      [...(container ?? document).querySelectorAll(selector)].find(isShown) ??
      null,
    [container],
  )

  /** The nearest step from `from` in `direction` whose target exists. */
  const reachable = React.useCallback(
    (from: number, direction: 1 | -1) => {
      for (let i = from; i >= 0 && i < steps.length; i += direction)
        if (find(steps[i]!.target)) return i
      return null
    },
    [steps, find],
  )

  const finish = React.useCallback(
    (completed: boolean) => {
      report(completed ? 'click' : 'dismiss', record)
      remember(markKey, completed ? steps.length : (step ?? 0))
      setStep(null)
      setTarget(null)
      opener.current?.focus({ preventScroll: true })
    },
    [report, record, remember, markKey, steps.length, step],
  )

  // startTour(id): resume where the visitor left off, unless asked to restart.
  React.useEffect(() => {
    const onStart = (event: Event) => {
      const detail = (event as CustomEvent<{ id: string; restart: boolean }>)
        .detail
      if (detail?.id !== id) return
      const saved = recall(markKey)
      const from =
        detail.restart || saved === null || saved >= steps.length ? 0 : saved
      const first = reachable(from, 1) ?? reachable(0, 1)
      if (first === null) return
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      report('impression', record)
      setStep(first)
    }
    window.addEventListener(PROMOTION_TOUR_EVENT, onStart)
    return () => window.removeEventListener(PROMOTION_TOUR_EVENT, onStart)
  }, [id, markKey, recall, reachable, record, report, steps.length])

  // The step effect runs once per step, not whenever a callback or an
  // inline `steps` array changes identity: it scrolls the page.
  const latest = React.useRef({ reachable, finish, remember, reduce })
  React.useLayoutEffect(() => {
    latest.current = { reachable, finish, remember, reduce }
  })
  const selector = step === null ? null : (steps[step]?.target ?? null)

  // Each step: find its target, bring it into view, outline it.
  React.useEffect(() => {
    if (step === null || selector === null) return
    const { reachable, finish, remember, reduce } = latest.current
    const element = find(selector)
    if (!element) {
      // The target left the page (the DOM is the external system here):
      // move on rather than stall.
      const next = reachable(step, 1)
      // oxlint-disable-next-line react/set-state-in-effect -- reacts to the DOM losing the step's target
      if (next === null) finish(true)
      // oxlint-disable-next-line react/set-state-in-effect -- reacts to the DOM losing the step's target
      else setStep(next)
      return
    }
    ensureHalo()
    element.setAttribute('data-promo-toured', '')
    element.scrollIntoView({
      block: 'center',
      behavior: reduce ? 'auto' : 'smooth',
    })
    remember(markKey, step)
    // oxlint-disable-next-line react/set-state-in-effect -- the anchor is read from the DOM after the step commits
    setTarget(element)
    return () => element.removeAttribute('data-promo-toured')
  }, [step, selector, find, markKey])

  if (step === null || !target) return null
  const current = steps[step]!
  const next = reachable(step + 1, 1)
  const previous = step > 0 ? reachable(step - 1, -1) : null
  const last = next === null

  return (
    <Popover.Root
      open
      modal={false}
      onOpenChange={(open, details) => {
        // Only Escape closes it; clicking the outlined target is expected.
        if (!open && details.reason === 'escape-key') finish(false)
      }}
    >
      <Popover.Portal container={container}>
        <Popover.Positioner
          anchor={target}
          side={current.side ?? 'bottom'}
          sideOffset={14}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            // A new step animates in from its own target.
            key={step}
            data-slot="promo-tour"
            // Keyboard users land on Next; focus returns to the opener on finish.
            initialFocus={nextButton}
            finalFocus={false}
            aria-label={`${label}, step ${step + 1} of ${steps.length}`}
            className="bg-popover text-popover-foreground w-[min(20rem,calc(100vw-1.5rem))] origin-[var(--transform-origin)] rounded-[calc(var(--promo-radius,0.75rem)+0.125rem)] p-4 text-sm shadow-xl ring-1 ring-black/5 transition-[scale,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.95] data-starting-style:opacity-0 motion-reduce:transition-opacity dark:ring-white/10"
          >
            <Popover.Arrow className="data-[side=bottom]:-top-1.5 data-[side=left]:-right-1.5 data-[side=right]:-left-1.5 data-[side=top]:-bottom-1.5">
              <span className="bg-popover block size-3 rotate-45 rounded-[2px] ring-1 ring-black/5 dark:ring-white/10" />
            </Popover.Arrow>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
                  {step + 1} of {steps.length}
                </span>
                <span aria-hidden className="flex flex-1 gap-1">
                  {steps.map((s, i) => (
                    <span
                      key={s.target + i}
                      className={cn(
                        'h-0.5 flex-1 rounded-full transition-colors duration-300',
                        i <= step ? 'bg-foreground' : 'bg-foreground/15',
                      )}
                    />
                  ))}
                </span>
              </div>
              <Popover.Title className="[font-family:var(--promo-display,inherit)] leading-snug font-medium text-balance">
                {current.title}
              </Popover.Title>
              {current.body ? (
                <Popover.Description className="text-muted-foreground text-pretty">
                  {current.body}
                </Popover.Description>
              ) : null}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => finish(false)}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -ms-1 rounded-md px-1 py-0.5 text-xs transition-colors duration-150 outline-none focus-visible:ring-3"
                >
                  Skip tour
                </button>
                <span className="ms-auto flex gap-1.5">
                  {previous !== null ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setStep(previous)}
                    >
                      Back
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    ref={nextButton}
                    size="sm"
                    onClick={() => (last ? finish(true) : setStep(next))}
                  >
                    {last ? 'Done' : 'Next'}
                  </Button>
                </span>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
