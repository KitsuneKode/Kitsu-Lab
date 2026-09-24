import type { Promotion } from './promotion'
import type { PromotionEvent } from './promotion-provider'

export type PromotionPluginContext = {
  pathname: string
  now: () => number
  /**
   * Counts as engagement for this page, as if the delay and scroll depth had
   * been met. The provider's other rules still apply: frequency, the daily
   * budget, dismissals, and never over a busy visitor.
   */
  engage: (placement: 'toast' | 'dialog') => void
}

/**
 * Add-ons extend the provider without growing its props. Each hook is
 * optional; keep the `plugins` array stable (define it outside render).
 */
export type PromotionPlugin = {
  name: string
  /** Veto a candidate, e.g. hide incentives from people who just bought. */
  allow?: (
    promotion: Promotion,
    context: { pathname: string; now: number },
  ) => boolean
  /** Extra triggers. Runs per page; return a cleanup. */
  setup?: (context: PromotionPluginContext) => (() => void) | void
  /** Sees every event, e.g. to forward to an analytics vendor. */
  onEvent?: (event: PromotionEvent) => void
}

/**
 * Opens a toast or dialog when a mouse leaves through the top of the window,
 * which usually means heading for the tabs or the close button.
 *
 * Desktop only by design: the phone equivalents (sudden scroll-up, trapping
 * the back button) feel hostile, so there are none. It waits `minDwellMs` on
 * the page first, and the provider's frequency rules keep it to once a day.
 */
export function exitIntent({
  placement = 'dialog',
  minDwellMs = 4000,
}: {
  placement?: 'toast' | 'dialog'
  minDwellMs?: number
} = {}): PromotionPlugin {
  return {
    name: 'exit-intent',
    setup({ engage, pathname }) {
      if (!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches)
        return
      const arrived = performance.now()
      const onLeave = (event: MouseEvent) => {
        if (event.relatedTarget !== null || event.clientY > 0) return
        if (performance.now() - arrived < minDwellMs) return
        engage(placement)
      }
      document.addEventListener('mouseout', onLeave)
      void pathname
      return () => document.removeEventListener('mouseout', onLeave)
    },
  }
}

/**
 * Opens after the visitor has been idle for `ms`: no pointer, key or scroll.
 * A pause often means "thinking it over", a fair moment for a quiet toast.
 */
export function idle({
  placement = 'toast',
  ms = 20_000,
}: { placement?: 'toast' | 'dialog'; ms?: number } = {}): PromotionPlugin {
  return {
    name: 'idle',
    setup({ engage }) {
      let timer = window.setTimeout(() => engage(placement), ms)
      const reset = () => {
        window.clearTimeout(timer)
        timer = window.setTimeout(() => engage(placement), ms)
      }
      const events = ['pointermove', 'keydown', 'scroll', 'touchstart'] as const
      for (const type of events)
        window.addEventListener(type, reset, { passive: true })
      return () => {
        window.clearTimeout(timer)
        for (const type of events) window.removeEventListener(type, reset)
      }
    },
  }
}

/**
 * Hides promotions whose `campaign` is in `exclude()`, e.g. the host's list
 * of campaigns this visitor already converted on. Runs on every selection.
 */
export function excludeCampaigns(
  exclude: () => readonly string[],
): PromotionPlugin {
  return {
    name: 'exclude-campaigns',
    allow: (promotion) =>
      !promotion.campaign || !exclude().includes(promotion.campaign),
  }
}
