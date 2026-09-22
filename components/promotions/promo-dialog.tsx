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
import type { Promotion } from './promotion'
import { usePromotions } from './promotion-provider'
import { PromoDialogContentView } from './promotion-views'

const WIDE = '(min-width: 768px)'

function subscribeWide(onChange: () => void) {
  const list = window.matchMedia(WIDE)
  list.addEventListener('change', onChange)
  return () => list.removeEventListener('change', onChange)
}

function useWideScreen() {
  return React.useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    () => true,
  )
}

/**
 * A restrained modal for important, timed campaigns: a centred dialog on wide
 * screens and a bottom sheet on phones. The provider decides *whether* it may
 * open (engagement, dismissal, one intrusive surface at a time); closing it by
 * any route (Not now, Escape, backdrop, the button) records a dismissal.
 */
export function PromoDialog() {
  const { dialog, now, dismiss, report, Link } = usePromotions()
  const wide = useWideScreen()
  // The last promotion shown stays mounted so the surface animates out with
  // its content instead of emptying first.
  const [shown, setShown] = React.useState<Promotion | null>(null)
  if (dialog && dialog.id !== shown?.id) setShown(dialog)
  const open = Boolean(dialog && shown && dialog.id === shown.id)

  const reported = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (!dialog || reported.current === dialog.id) return
    reported.current = dialog.id
    // A modal is seen the moment it opens; it cannot be scrolled past.
    report({
      type: 'impression',
      id: dialog.id,
      placement: dialog.placement,
      campaign: dialog.campaign,
    })
  }, [dialog, report])

  if (!shown) return null

  const close = () => dismiss(shown)
  const onOpenChange = (next: boolean) => {
    if (!next) close()
  }
  const onClick = () => {
    report({
      type: 'click',
      id: shown.id,
      placement: shown.placement,
      campaign: shown.campaign,
    })
    close()
  }

  if (wide) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent data-slot="promo-dialog" className="sm:max-w-md">
          <PromoDialogContentView
            promotion={shown}
            now={now}
            Link={Link}
            onClick={onClick}
            onDismiss={close}
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
        className="rounded-t-xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <PromoDialogContentView
          promotion={shown}
          now={now}
          Link={Link}
          onClick={onClick}
          onDismiss={close}
          Title={SheetTitle}
          Description={SheetDescription}
        />
      </SheetContent>
    </Sheet>
  )
}
