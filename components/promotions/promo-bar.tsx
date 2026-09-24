'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

import type { Promotion } from './promotion'
import { useImpression, usePromotions } from './promotion-provider'
import { PromoBarView } from './promotion-views'

/**
 * The announcement bar. Renders nothing until a live, undismissed promotion
 * exists for this route, then opens with a height transition (an opacity fade
 * under reduced motion) so it never shoves content on first paint.
 */
export function PromoBar({
  className,
  dismissible = true,
}: {
  className?: string
  dismissible?: boolean
}) {
  const { bar, now, dismiss, report, Link } = usePromotions()
  const [shown, setShown] = React.useState<Promotion | null>(null)

  // Keep the last promotion mounted while the bar closes, so it animates out
  // with its content rather than collapsing empty.
  if (bar && bar !== shown) setShown(bar)

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
  const ref = useImpression(bar, onImpression)
  const open = Boolean(bar)

  return (
    <div
      ref={ref as React.RefObject<HTMLDivElement>}
      data-slot="promo-bar"
      data-state={open ? 'open' : 'closed'}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-opacity',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
    >
      <div className="overflow-hidden">
        {shown ? (
          <PromoBarView
            promotion={shown}
            now={now}
            Link={Link}
            onClick={() =>
              report({
                type: 'click',
                id: shown.id,
                placement: shown.placement,
                campaign: shown.campaign,
              })
            }
            onDismiss={dismissible ? () => dismiss(shown) : undefined}
          />
        ) : null}
      </div>
    </div>
  )
}
