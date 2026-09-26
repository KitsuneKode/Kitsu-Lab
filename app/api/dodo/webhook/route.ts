import { verifyWebhook } from '@/lib/dodo'
import { forgetLicenses } from '@/lib/pro-license'

/**
 * Dodo Payments events. The license key itself reaches the buyer from
 * Dodo (receipt and customer portal), so nothing has to be stored here.
 * This route only keeps cached license answers honest and, when
 * KITSU_SALES_WEBHOOK_URL is set, posts a one-line sale notice to your
 * Discord or Slack channel.
 */
const seen = new Set<string>()

const ENDS_ACCESS = new Set([
  'subscription.cancelled',
  'subscription.expired',
  'subscription.failed',
  'subscription.on_hold',
  'subscription.paused',
  'refund.succeeded',
  'dispute.opened',
  'dispute.lost',
])

export async function POST(request: Request) {
  const body = await request.text()
  const id = request.headers.get('webhook-id')
  const ok = verifyWebhook({
    id,
    timestamp: request.headers.get('webhook-timestamp'),
    signature: request.headers.get('webhook-signature'),
    body,
    secret: process.env.DODO_PAYMENTS_WEBHOOK_KEY ?? '',
    nowSeconds: Math.floor(Date.now() / 1000),
  })
  if (!ok) return new Response('Invalid signature', { status: 401 })
  // Dodo retries until it sees a 2xx; the id makes a retry harmless.
  if (id && seen.has(id)) return new Response(null, { status: 204 })
  if (id) {
    if (seen.size > 5000) seen.clear()
    seen.add(id)
  }

  let event: { type?: unknown; data?: Record<string, unknown> } = {}
  try {
    event = JSON.parse(body)
  } catch {
    return new Response('Invalid JSON', { status: 400 })
  }
  const type = typeof event.type === 'string' ? event.type : ''

  if (ENDS_ACCESS.has(type)) forgetLicenses()

  const notify = process.env.KITSU_SALES_WEBHOOK_URL
  if (
    notify &&
    (type === 'payment.succeeded' || type === 'subscription.active')
  ) {
    const amount = event.data?.total_amount
    const currency = event.data?.currency
    const line =
      type === 'payment.succeeded'
        ? `New Kitsu Pro payment${typeof amount === 'number' && typeof currency === 'string' ? `: ${(amount / 100).toFixed(2)} ${currency}` : ''}`
        : 'New Kitsu Pro subscription'
    // Discord reads `content`, Slack reads `text`.
    await fetch(notify, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ content: line, text: line }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {})
  }

  return new Response(null, { status: 204 })
}
