'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

import { PromoCornerView } from './promotion-views'
import { usePromoOverlay } from './use-promo-overlay'

/**
 * A floating card in a bottom corner. It does not take focus or dim the page,
 * so it can sit beside an announcement bar; Escape still dismisses it.
 *
 * Pass `className` to lift it above anything already pinned to the bottom of
 * the page, such as a mobile action bar (`bottom-20 md:bottom-6`).
 */
export function PromoCorner({
  side = 'right',
  locale,
  className,
}: {
  side?: 'left' | 'right'
  locale?: string
  className?: string
}) {
  const { shown, open, now, Link, close, onClick, onCopy } =
    usePromoOverlay('corner')

  React.useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!shown) return null

  return (
    <div
      data-slot="promo-corner"
      data-state={open ? 'open' : 'closed'}
      aria-hidden={!open}
      inert={!open}
      className={cn(
        'fixed bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 transition-[opacity,translate] duration-300 ease-out motion-reduce:transition-opacity',
        side === 'right' ? 'right-4' : 'left-4',
        open
          ? 'translate-y-0 opacity-100'
          : 'pointer-events-none translate-y-3 opacity-0',
        className,
      )}
    >
      <PromoCornerView
        promotion={shown}
        now={now}
        Link={Link}
        onClick={onClick}
        onCopy={onCopy}
        onDismiss={close}
        locale={locale}
      />
    </div>
  )
}
