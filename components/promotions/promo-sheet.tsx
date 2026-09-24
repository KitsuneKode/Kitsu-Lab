'use client'

import * as React from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { usePromotions } from './promotion-provider'
import { PromoCode } from './promotion-views'

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
 * The offer that waits to be asked for. A small tab sits on the edge of the
 * screen while a `sheet` promotion is live; tapping it slides the offer in
 * from that edge (from the bottom on phones). Nothing opens on its own, so
 * it spends none of the interruption budget.
 *
 * Inside: the message, an optional image, a code (revealable), the button
 * and a quiet "Hide this offer" that records a dismissal.
 */
export function PromoSheet({
  side = 'end',
  layout = 'auto',
  container,
  dir,
  tabClassName,
}: {
  /** Reading direction for `side`. Defaults to the document's. */
  dir?: 'ltr' | 'rtl'
  /** Which edge on wide screens, following reading direction. */
  side?: 'start' | 'end'
  /** `auto` becomes a bottom sheet below 768px. */
  layout?: 'auto' | 'side' | 'bottom'
  /** Portal target, e.g. a device frame in a demo. */
  container?: HTMLElement | null
  tabClassName?: string
}) {
  const {
    sheet,
    sheetOpen,
    closeSheet,
    openPromotion,
    markShown,
    dismiss,
    complete,
    report,
    labels,
    Link,
  } = usePromotions()
  const wideScreen = useWideScreen()
  const bottom = layout === 'bottom' || (layout === 'auto' && !wideScreen)

  React.useEffect(() => {
    if (sheet && sheetOpen) markShown(sheet)
  }, [sheet, sheetOpen, markShown])

  if (!sheet) return null
  const rtl =
    dir === 'rtl' ||
    (dir === undefined &&
      typeof document !== 'undefined' &&
      getComputedStyle(document.documentElement).direction === 'rtl')
  // Physical edge, because the drawer's swipe direction is physical.
  const physical =
    (side === 'end') !== rtl ? ('right' as const) : ('left' as const)
  const swipeDirection = bottom ? 'down' : physical

  return (
    <>
      <button
        type="button"
        data-slot="promo-sheet-tab"
        aria-haspopup="dialog"
        aria-expanded={sheetOpen}
        onClick={() => openPromotion(sheet.id)}
        className={cn(
          'bg-primary text-primary-foreground fixed top-1/2 z-40 -translate-y-1/2 px-1.5 py-3 text-xs font-semibold tracking-wide shadow-lg transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [writing-mode:vertical-rl] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 motion-reduce:transition-none print:hidden',
          physical === 'right'
            ? 'right-0 rounded-l-lg hover:-translate-x-0.5'
            : 'left-0 rotate-180 rounded-l-lg hover:translate-x-0.5',
          // Tuck the tab away while its own sheet is open.
          sheetOpen && 'pointer-events-none opacity-0',
          tabClassName,
        )}
      >
        {sheet.eyebrow ?? labels.openOffer}
      </button>

      <Drawer.Root
        open={sheetOpen}
        onOpenChange={(open) => {
          if (!open) closeSheet()
        }}
        swipeDirection={swipeDirection}
      >
        <Drawer.Portal container={container}>
          <Drawer.Backdrop className="fixed inset-0 bg-black opacity-[calc(0.2*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*350ms)] data-starting-style:opacity-0 data-swiping:duration-0 dark:opacity-[calc(0.55*(1-var(--drawer-swipe-progress)))]" />
          <Drawer.Viewport
            className={cn(
              'fixed inset-0 flex',
              bottom
                ? 'items-end justify-center'
                : physical === 'right'
                  ? 'justify-end'
                  : 'justify-start',
            )}
          >
            <Drawer.Popup
              data-slot="promo-sheet"
              className={cn(
                'bg-popover text-popover-foreground ring-foreground/10 flex flex-col gap-4 overflow-y-auto overscroll-contain p-5 text-sm ring-1 outline-none transition-transform duration-[400ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*350ms)] data-swiping:select-none motion-reduce:transition-opacity motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:opacity-0',
                bottom
                  ? 'max-h-[85dvh] w-full rounded-t-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] [transform:translateY(var(--drawer-swipe-movement-y))] data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]'
                  : physical === 'right'
                    ? 'h-full w-[min(24rem,90vw)] [transform:translateX(var(--drawer-swipe-movement-x))] data-ending-style:[transform:translateX(100%)] data-starting-style:[transform:translateX(100%)]'
                    : 'h-full w-[min(24rem,90vw)] [transform:translateX(var(--drawer-swipe-movement-x))] data-ending-style:[transform:translateX(-100%)] data-starting-style:[transform:translateX(-100%)]',
              )}
            >
              {bottom ? (
                <div
                  aria-hidden
                  className="bg-muted-foreground/30 mx-auto -mt-2 h-1 w-10 shrink-0 rounded-full"
                />
              ) : null}
              <Drawer.Content className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    {sheet.eyebrow ? (
                      <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                        {sheet.eyebrow}
                      </span>
                    ) : null}
                    <Drawer.Title className="text-lg leading-snug font-medium text-balance">
                      {sheet.title}
                    </Drawer.Title>
                  </div>
                  <Drawer.Close
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="-me-2 -mt-1"
                      />
                    }
                  >
                    <IconX aria-hidden />
                    <span className="sr-only">{labels.dismiss}</span>
                  </Drawer.Close>
                </div>
                {sheet.media ? (
                  // oxlint-disable-next-line nextjs/no-img-element
                  <img
                    src={sheet.media.src}
                    alt={sheet.media.alt}
                    width={sheet.media.width}
                    height={sheet.media.height}
                    decoding="async"
                    className="aspect-[16/9] w-full rounded-lg object-cover"
                  />
                ) : null}
                {sheet.body ? (
                  <Drawer.Description className="text-muted-foreground text-pretty">
                    {sheet.body}
                  </Drawer.Description>
                ) : null}
                {sheet.code ? (
                  <PromoCode
                    code={sheet.code}
                    reveal={sheet.revealCode}
                    onReveal={() => report('reveal', sheet)}
                    onCopy={() => report('copy', sheet)}
                    className="self-start"
                  />
                ) : null}
                <div className="mt-2 flex flex-col gap-2">
                  {sheet.cta ? (
                    <Button
                      nativeButton={false}
                      size="lg"
                      render={
                        <Link
                          href={sheet.cta.href}
                          onClick={() => {
                            report('click', sheet)
                            complete(sheet)
                          }}
                          {...(sheet.cta.external
                            ? { target: '_blank', rel: 'noopener noreferrer' }
                            : {})}
                        >
                          {sheet.cta.label}
                        </Link>
                      }
                    />
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground self-center"
                    onClick={() => dismiss(sheet)}
                  >
                    {labels.hideOffer}
                  </Button>
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
