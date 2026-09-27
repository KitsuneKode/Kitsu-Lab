'use client'

import { track } from '@vercel/analytics/react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button-variants'

/** Plan checkout form — posts to /api/checkout and records the attempt. */
export function CheckoutForm({
  id,
  name,
  available,
  highlight,
}: {
  id: string
  name: string
  available: boolean
  highlight?: boolean
}) {
  return (
    <form
      action="/api/checkout"
      method="post"
      onSubmit={() => track('checkout_start', { plan: id })}
    >
      <input type="hidden" name="plan" value={id} />
      <button
        type="submit"
        disabled={!available}
        className={cn(
          buttonVariants({
            variant: highlight ? 'default' : 'outline',
            size: 'lg',
          }),
          'w-full',
        )}
      >
        {available ? `Get ${name}` : 'Opening soon'}
      </button>
    </form>
  )
}
