'use client'

import * as React from 'react'

import type { Promotion } from './promotion'
import { useImpression, usePromotions } from './promotion-provider'
import { PromoCardView } from './promotion-views'

/**
 * An inline promotion for a named slot, e.g. `<PromoCard slot="hero" />`.
 * Renders `fallback` (nothing by default) when no promotion fills the slot, so
 * the surrounding layout decides what an empty slot looks like.
 */
export function PromoCard({
  slot = 'default',
  fallback = null,
  dismissible = false,
  className,
}: {
  slot?: string
  fallback?: React.ReactNode
  dismissible?: boolean
  className?: string
}) {
  const { card, now, dismiss, report, Link } = usePromotions()
  const promotion = card(slot)

  const onImpression = React.useCallback(
    (p: Promotion) =>
      report({
        type: 'impression',
        id: p.id,
        placement: p.placement,
        campaign: p.campaign,
      }),
    [report],
  )
  const ref = useImpression(promotion, onImpression)

  if (!promotion) return <>{fallback}</>

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-slot="promo-card"
      data-promo-slot={slot}
    >
      <PromoCardView
        promotion={promotion}
        now={now}
        Link={Link}
        className={className}
        onClick={() =>
          report({
            type: 'click',
            id: promotion.id,
            placement: promotion.placement,
            campaign: promotion.campaign,
          })
        }
        onCopy={() =>
          report({
            type: 'copy',
            id: promotion.id,
            placement: promotion.placement,
            campaign: promotion.campaign,
          })
        }
        onDismiss={dismissible ? () => dismiss(promotion) : undefined}
      />
    </div>
  )
}
