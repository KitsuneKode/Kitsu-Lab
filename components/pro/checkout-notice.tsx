'use client'

import { useSearchParams } from 'next/navigation'

const MESSAGES: Record<string, string> = {
  unavailable:
    'Checkout opens soon. Follow @kitsunekode on X to hear the moment it does.',
  error:
    'The checkout could not start. Nothing was charged; please try again in a moment.',
}

/** Explains why the visitor came back from /api/checkout without paying. */
export function CheckoutNotice() {
  const reason = useSearchParams().get('checkout')
  const message = reason ? MESSAGES[reason] : null
  if (!message) return null
  return (
    <p
      role="status"
      className="border-border bg-muted/40 rounded-lg border px-4 py-3 text-sm"
    >
      {message}
    </p>
  )
}
