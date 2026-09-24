'use client'

import * as React from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { PromoOverlayContent } from './promotion-views'
import { usePromoOverlay, useWideScreen } from './use-promo-overlay'

/**
 * A side panel for a campaign that needs room: a course launch with what it
 * includes, a book with its price and a code. It slides in from the side on
 * wide screens and rises from the bottom on phones, and its button stays
 * pinned in reach however long the details run.
 */
export function PromoSheet({
  side = 'right',
  locale,
}: {
  side?: 'left' | 'right'
  locale?: string
}) {
  const { shown, open, now, Link, close, onClick, onCopy } =
    usePromoOverlay('sheet')
  const wide = useWideScreen()
  if (!shown) return null

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) close()
      }}
    >
      <SheetContent
        side={wide ? side : 'bottom'}
        data-slot="promo-sheet"
        showCloseButton={false}
        className={
          wide
            ? 'gap-0 p-0 data-[side=left]:sm:max-w-md data-[side=right]:sm:max-w-md'
            : 'max-h-[90dvh] gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]'
        }
      >
        <PromoOverlayContent
          promotion={shown}
          now={now}
          Link={Link}
          onClick={onClick}
          onCopy={onCopy}
          onDismiss={close}
          locale={locale}
          layout="panel"
          Title={SheetTitle}
          Description={SheetDescription}
        />
      </SheetContent>
    </Sheet>
  )
}
