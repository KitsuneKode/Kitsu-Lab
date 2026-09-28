'use client'

import * as React from 'react'
import { IconEye, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { usePromotions } from './promotion-provider'

/**
 * Tells a reviewer they are looking at a draft: shown only while the
 * provider has a `preview`. It sits in the bottom start corner, the one no
 * surface uses (bars run along the top or bottom centre, toasts and side
 * cards take the end), so it never covers what is under review.
 *
 * `onExit` should drop the preview, e.g. remove `?promo-preview` from the
 * URL. The draft's own close button only hides it for this look.
 */
export function PromoPreviewNotice({
  onExit,
  className,
}: {
  onExit?: () => void
  className?: string
}) {
  const { previewing } = usePromotions()
  if (!previewing) return null
  return (
    <div
      role="status"
      data-slot="promo-preview-notice"
      className={cn(
        'pointer-events-none fixed start-0 bottom-0 z-[60] flex max-w-full p-3 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--promo-bottom-inset,0px))] print:hidden',
        className,
      )}
    >
      <div className="bg-foreground text-background pointer-events-auto flex max-w-full items-center gap-2 rounded-full py-1 ps-3 pe-1 text-xs shadow-lg">
        <IconEye aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">
          <span className="font-medium">Preview</span>
          <span className="opacity-70"> · {previewing.title}</span>
        </span>
        <span className="hidden shrink-0 opacity-70 sm:inline">
          Not live, not counted
        </span>
        {onExit ? (
          <button
            type="button"
            onClick={onExit}
            className="hover:bg-background/15 focus-visible:ring-background/60 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 font-medium transition-[background-color] duration-150 outline-none focus-visible:ring-2"
          >
            <IconX aria-hidden className="size-3.5" />
            Exit preview
          </button>
        ) : null}
      </div>
    </div>
  )
}
