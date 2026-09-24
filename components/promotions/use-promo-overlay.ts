'use client'

import * as React from 'react'

import type { Promotion, PromotionOverlayPlacement } from './promotion'
import { usePromotions } from './promotion-provider'

const WIDE = '(min-width: 768px)'

function subscribeWide(onChange: () => void) {
  const list = window.matchMedia(WIDE)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

/** Whether the viewport is tablet-wide or more. Server renders assume wide. */
export function useWideScreen() {
  return React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => true,
  )
}

/**
 * Shared behaviour for the corner, sheet and dialog renderers.
 *
 * - The provider decides whether an overlay may open; this only follows it.
 * - The last promotion stays mounted after it closes, so the surface animates
 *   out with its content instead of emptying first.
 * - An overlay is seen the moment it opens, so the impression fires then.
 * - Every way of closing records a dismissal; following the button counts as
 *   one too, so a visitor who acted is not asked again.
 */
export function usePromoOverlay(placement: PromotionOverlayPlacement) {
  const { overlay, now, dismiss, report, Link } = usePromotions()
  const current = overlay?.placement === placement ? overlay : null

  const [shown, setShown] = React.useState<Promotion | null>(null)
  if (current && current.id !== shown?.id) setShown(current)
  const open = Boolean(current && shown && current.id === shown.id)

  const reported = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!current || reported.current === current.id) return
    reported.current = current.id
    report({
      type: 'impression',
      id: current.id,
      placement: current.placement,
      campaign: current.campaign,
    })
  }, [current, report])

  const event = (type: 'click' | 'copy') =>
    shown &&
    report({
      type,
      id: shown.id,
      placement: shown.placement,
      campaign: shown.campaign,
    })

  return {
    shown,
    open,
    now,
    Link,
    close: () => {
      if (shown) dismiss(shown)
    },
    onClick: () => {
      event('click')
      if (shown) dismiss(shown)
    },
    onCopy: () => event('copy'),
  }
}
