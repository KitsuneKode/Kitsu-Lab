'use client'

import * as React from 'react'
import { Popover } from '@base-ui/react/popover'

import { Button } from '@/components/ui/button'
import { usePromotions } from './promotion-provider'

const RING_STYLE_ID = 'promo-spotlight-ring'
const noopSubscribe = () => () => {}

/** One tiny stylesheet for the halo, so the host element needs no classes. */
function ensureRingStyle() {
  if (document.getElementById(RING_STYLE_ID)) return
  const style = document.createElement('style')
  style.id = RING_STYLE_ID
  style.textContent = `
[data-promo-spotlit] {
  outline: 2px solid color-mix(in oklch, var(--primary) 70%, transparent);
  outline-offset: 3px;
  transition: outline-offset 250ms cubic-bezier(0.23, 1, 0.32, 1);
}
@media (prefers-reduced-motion: no-preference) {
  [data-promo-spotlit] { animation: promo-spotlight-in 300ms cubic-bezier(0.23, 1, 0.32, 1); }
}
@keyframes promo-spotlight-in { from { outline-offset: 10px; outline-color: transparent; } }
@media (forced-colors: active) { [data-promo-spotlit] { outline-color: Highlight; } }`
  document.head.append(style)
}

/**
 * Points at one feature, once. Place it next to the element it explains and
 * give it the same name as the promotion's `slot`:
 *
 * ```tsx
 * const exportButton = useRef<HTMLButtonElement>(null)
 * <Button ref={exportButton}>Export</Button>
 * <PromoSpotlight name="export" anchor={exportButton} />
 * ```
 *
 * The popover scales in from its anchor (never the centre), outlines the
 * anchor with a soft halo, and does not take focus: the visitor keeps doing
 * what they were doing. It closes on "Got it", Escape, or when the visitor
 * uses the feature itself, which counts as a conversion, not a dismissal.
 */
export function PromoSpotlight({
  name,
  anchor,
  side = 'bottom',
  container,
}: {
  name: string
  anchor: React.RefObject<HTMLElement | null>
  side?: 'top' | 'bottom' | 'left' | 'right'
  container?: HTMLElement | null
}) {
  const {
    spotlight,
    registerAnchor,
    markShown,
    dismiss,
    complete,
    report,
    labels,
    Link,
  } = usePromotions()
  const mine =
    spotlight && (spotlight.slot ?? 'default') === name ? spotlight : null

  // The ref object never changes, so read the element as a snapshot: React
  // re-checks it after each commit, so an anchor that mounts later (after
  // data loads) still registers.
  const present = React.useSyncExternalStore(
    noopSubscribe,
    () => anchor.current !== null,
    () => false,
  )
  React.useEffect(() => {
    if (!present) return
    return registerAnchor(name)
  }, [present, name, registerAnchor])

  React.useEffect(() => {
    const element = anchor.current
    if (!mine || !element) return
    markShown(mine)
    ensureRingStyle()
    element.setAttribute('data-promo-spotlit', '')
    // Using the feature is the best possible outcome of a spotlight.
    const onUse = () => {
      report('click', mine)
      complete(mine)
    }
    element.addEventListener('click', onUse)
    return () => {
      element.removeAttribute('data-promo-spotlit')
      element.removeEventListener('click', onUse)
    }
  }, [mine, anchor, markShown, report, complete])

  if (!mine) return null

  return (
    <Popover.Root
      open
      modal={false}
      onOpenChange={(open, details) => {
        if (open) return
        // Pressing the anchor itself is using the feature, which the click
        // handler above records as a conversion, not a dismissal.
        const target = details.event?.target
        if (
          details.reason === 'outside-press' &&
          target instanceof Node &&
          anchor.current?.contains(target)
        )
          return
        dismiss(mine)
      }}
    >
      <Popover.Portal container={container}>
        <Popover.Positioner
          anchor={anchor}
          side={side}
          sideOffset={12}
          collisionPadding={12}
          className="z-50"
        >
          <Popover.Popup
            initialFocus={false}
            finalFocus={false}
            data-slot="promo-spotlight"
            className="bg-foreground text-background w-[min(18rem,calc(100vw-1.5rem))] origin-[var(--transform-origin)] rounded-[var(--promo-radius,0.75rem)] p-3.5 text-sm shadow-xl transition-[scale,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.94] data-starting-style:opacity-0 motion-reduce:transition-opacity"
          >
            <Popover.Arrow className="data-[side=bottom]:-top-1.5 data-[side=left]:-right-1.5 data-[side=right]:-left-1.5 data-[side=top]:-bottom-1.5">
              <span className="bg-foreground block size-3 rotate-45 rounded-[2px]" />
            </Popover.Arrow>
            <div className="flex flex-col gap-1.5">
              {mine.eyebrow ? (
                <span className="text-background/65 text-xs font-medium">
                  {mine.eyebrow}
                </span>
              ) : null}
              <Popover.Title className="[font-family:var(--promo-display,inherit)] leading-snug font-medium text-balance">
                {mine.title}
              </Popover.Title>
              {mine.body ? (
                <Popover.Description className="text-background/75 text-pretty">
                  {mine.body}
                </Popover.Description>
              ) : null}
              <div className="mt-1.5 flex items-center justify-end gap-2">
                {mine.cta ? (
                  <Link
                    href={mine.cta.href}
                    onClick={() => {
                      report('click', mine)
                      complete(mine)
                    }}
                    className="text-background/80 hover:text-background text-xs font-medium underline-offset-4 hover:underline"
                  >
                    {mine.cta.label}
                  </Link>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="bg-background text-foreground hover:bg-background/90"
                  onClick={() => dismiss(mine)}
                >
                  {labels.gotIt}
                </Button>
              </div>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
