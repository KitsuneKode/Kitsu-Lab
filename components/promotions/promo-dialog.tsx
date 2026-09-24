'use client'

import * as React from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { Drawer } from '@base-ui/react/drawer'
import { IconX } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
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

function SheetTitle(props: { className?: string; children?: React.ReactNode }) {
  return (
    <Drawer.Title
      {...props}
      className="text-foreground text-lg leading-snug font-medium text-balance"
    />
  )
}

function SheetDescription(props: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Drawer.Description
      {...props}
      className="text-muted-foreground text-sm text-pretty"
    />
  )
}

function DialogTitle(props: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Dialog.Title
      {...props}
      className="text-foreground text-lg leading-snug font-medium text-balance"
    />
  )
}

function DialogDescription(props: {
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Dialog.Description
      {...props}
      className="text-muted-foreground text-sm text-pretty"
    />
  )
}

/**
 * A restrained modal for important, timed campaigns: a centred dialog on wide
 * screens and a bottom sheet on phones that can be swiped away. The provider
 * decides *whether* it may open (engagement, dismissal, once per visit, one
 * floating surface at a time).
 *
 * Closing by Not now, Escape, the backdrop or a swipe records a dismissal.
 * Following the button closes it too, but is reported as a click only, so
 * conversions are never counted as rejections.
 */
export function PromoDialog({
  layout = 'auto',
  container,
}: {
  /** `auto` picks the sheet below 768px. Force one for previews. */
  layout?: 'auto' | 'dialog' | 'sheet'
  /** Portal target, e.g. a device frame in a demo. Defaults to <body>. */
  container?: HTMLElement | null
}) {
  const { dialog, now, dismiss, complete, markShown, report, labels, Link } =
    usePromotions()
  const wideScreen = useWideScreen()
  const wide = layout === 'auto' ? wideScreen : layout === 'dialog'
  // The last promotion shown stays mounted so the surface animates out with
  // its content instead of emptying first.
  const [shown, setShown] = React.useState<Promotion | null>(null)
  if (dialog && dialog.id !== shown?.id) setShown(dialog)
  const open = Boolean(dialog && shown && dialog.id === shown.id)

  React.useEffect(() => {
    // A modal is seen the moment it opens; it cannot be scrolled past.
    if (dialog) markShown(dialog)
  }, [dialog, markShown])

  if (!shown) return null

  const onOpenChange = (next: boolean) => {
    if (!next && open) dismiss(shown)
  }
  const content = (
    Title?: typeof SheetTitle,
    Description?: typeof SheetDescription,
  ) => (
    <PromoDialogContentView
      promotion={shown}
      now={now}
      Link={Link}
      onClick={() => {
        report('click', shown)
        complete(shown)
      }}
      onCopy={() => report('copy', shown)}
      onDismiss={() => dismiss(shown)}
      Title={Title}
      Description={Description}
    />
  )

  if (wide) {
    return (
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal container={container}>
          <Dialog.Backdrop className="fixed inset-0 bg-black/20 transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-[2px] dark:bg-black/50" />
          <Dialog.Popup
            data-slot="promo-dialog"
            className="bg-popover text-popover-foreground ring-foreground/10 fixed top-1/2 left-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-5 text-sm shadow-2xl ring-1 transition-[opacity,scale] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none data-ending-style:scale-[0.97] data-ending-style:opacity-0 data-ending-style:duration-150 data-starting-style:scale-[0.96] data-starting-style:opacity-0 motion-reduce:transition-opacity motion-reduce:data-ending-style:scale-100 motion-reduce:data-starting-style:scale-100"
          >
            {content(DialogTitle, DialogDescription)}
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="bg-popover/80 absolute end-3 top-3 backdrop-blur-sm"
                />
              }
            >
              <IconX aria-hidden />
              <span className="sr-only">{labels.dismiss}</span>
            </Dialog.Close>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal container={container}>
        <Drawer.Backdrop className="fixed inset-0 bg-black opacity-[calc(0.2*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 dark:opacity-[calc(0.6*(1-var(--drawer-swipe-progress)))]" />
        <Drawer.Viewport className="fixed inset-0 flex items-end justify-center">
          <Drawer.Popup
            data-slot="promo-dialog"
            className="bg-popover text-popover-foreground ring-foreground/10 -mb-[3rem] max-h-[calc(85dvh+3rem)] w-full [transform:translateY(var(--drawer-swipe-movement-y))] overflow-y-auto overscroll-contain rounded-t-2xl px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px)+3rem)] text-sm ring-1 transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] outline-none data-ending-style:[transform:translateY(calc(100%-3rem+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateY(calc(100%-3rem+2px))] data-swiping:select-none motion-reduce:transition-opacity motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:opacity-0"
          >
            <div
              aria-hidden
              className="bg-muted-foreground/30 mx-auto mb-4 h-1 w-10 rounded-full"
            />
            <Drawer.Content className="mx-auto w-full max-w-lg">
              {content(SheetTitle, SheetDescription)}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
