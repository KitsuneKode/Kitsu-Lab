'use client'

import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet'
import { PromoOverlayContent } from './promotion-views'
import { usePromoOverlay, useWideScreen } from './use-promo-overlay'

/**
 * The loudest placement, for an important timed campaign: a centred dialog
 * on wide screens and a bottom sheet on phones. Closing it by any route
 * (Not now, Escape, the backdrop, the button) records a dismissal.
 */
export function PromoDialog({ locale }: { locale?: string }) {
  const { shown, open, now, Link, close, onClick, onCopy } =
    usePromoOverlay('dialog')
  const wide = useWideScreen()
  if (!shown) return null

  const onOpenChange = (next: boolean) => {
    if (!next) close()
  }
  const content = {
    promotion: shown,
    now,
    Link,
    onClick,
    onCopy,
    onDismiss: close,
    locale,
  }

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-slot="promo-dialog"
          showCloseButton={false}
          className="gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <PromoOverlayContent
            {...content}
            Title={DialogTitle}
            Description={DialogDescription}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        data-slot="promo-dialog"
        showCloseButton={false}
        className="max-h-[88dvh] gap-0 overflow-y-auto rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <PromoOverlayContent
          {...content}
          Title={SheetTitle}
          Description={SheetDescription}
        />
      </SheetContent>
    </Sheet>
  )
}
