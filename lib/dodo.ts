import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * The small slice of Dodo Payments that Kitsu Pro needs, over plain
 * `fetch` so buyers never install an SDK. Dodo is the merchant of record:
 * it charges in local currencies, handles tax and pays out to India.
 *
 * - Checkout: `POST /checkouts` with a product, answered with a hosted URL.
 * - Licenses: `POST /licenses/validate` is public (no API key). A key tied
 *   to a subscription stops validating when the subscription lapses.
 * - Webhooks follow the Standard Webhooks signature scheme.
 */

export type DodoEnvironment = 'test_mode' | 'live_mode'

const BASE: Record<DodoEnvironment, string> = {
  test_mode: 'https://test.dodopayments.com',
  live_mode: 'https://live.dodopayments.com',
}

/** `test_mode` only when asked for; anything else is live. */
export function dodoEnvironment(raw: string | undefined): DodoEnvironment {
  return raw === 'test_mode' ? 'test_mode' : 'live_mode'
}

export function dodoBaseUrl(environment: DodoEnvironment): string {
  return BASE[environment]
}

/** License keys are opaque; this only keeps obvious junk away from Dodo. */
export function looksLikeLicenseKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value)
}

/** Asks Dodo whether a license key is active. Network errors count as "not now". */
export async function validateLicense(
  key: string,
  {
    environment,
    fetch: request = fetch,
    timeoutMs = 5000,
  }: {
    environment: DodoEnvironment
    fetch?: typeof fetch
    timeoutMs?: number
  },
): Promise<boolean> {
  if (!looksLikeLicenseKey(key)) return false
  try {
    const response = await request(`${BASE[environment]}/licenses/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ license_key: key }),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return false
    const body = (await response.json()) as { valid?: unknown }
    return body.valid === true
  } catch {
    return false
  }
}

/**
 * Remembers recent answers so one `shadcn add` (which fetches every item
 * of a bundle) costs one validation, not fifteen. Valid answers live
 * longer than invalid ones, so a fresh purchase works within a minute.
 */
export function createLicenseCache({
  validFor = 10 * 60_000,
  invalidFor = 60_000,
  max = 1000,
}: { validFor?: number; invalidFor?: number; max?: number } = {}) {
  const entries = new Map<string, { valid: boolean; until: number }>()
  const pending = new Map<string, Promise<boolean>>()
  return {
    async check(
      key: string,
      now: number,
      validate: () => Promise<boolean>,
    ): Promise<boolean> {
      const hit = entries.get(key)
      if (hit && hit.until > now) return hit.valid
      const inFlight = pending.get(key)
      if (inFlight) return inFlight
      const run = validate()
        .catch(() => false)
        .then((valid) => {
          if (entries.size >= max) entries.clear()
          entries.set(key, {
            valid,
            until: now + (valid ? validFor : invalidFor),
          })
          pending.delete(key)
          return valid
        })
      pending.set(key, run)
      return run
    },
    /** A fresh cached answer, or undefined when a lookup is needed. */
    peek(key: string, now: number): boolean | undefined {
      const hit = entries.get(key)
      return hit && hit.until > now ? hit.valid : undefined
    },
    /** Drop everything, e.g. after a subscription is cancelled. */
    clear: () => entries.clear(),
    size: () => entries.size,
  }
}

/**
 * A sliding-window limit on outgoing validations, so a script spraying
 * random keys cannot get this server rate-limited by Dodo and lock out
 * real buyers. `take(now)` is false once `limit` calls happened within
 * `windowMs`.
 */
export function createRateLimit({
  limit = 60,
  windowMs = 60_000,
}: { limit?: number; windowMs?: number } = {}) {
  const stamps: number[] = []
  return {
    take(now: number): boolean {
      while (stamps.length && stamps[0]! <= now - windowMs) stamps.shift()
      if (stamps.length >= limit) return false
      stamps.push(now)
      return true
    },
  }
}

/** Creates a hosted checkout for one product and returns its URL. */
export async function createCheckout({
  productId,
  apiKey,
  environment,
  returnUrl,
  metadata,
  fetch: request = fetch,
}: {
  productId: string
  apiKey: string
  environment: DodoEnvironment
  returnUrl: string
  metadata?: Record<string, string>
  fetch?: typeof fetch
}): Promise<string> {
  const response = await request(`${BASE[environment]}/checkouts`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: returnUrl,
      ...(metadata ? { metadata } : {}),
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Checkout failed: ${response.status}`)
  const body = (await response.json()) as { checkout_url?: unknown }
  if (
    typeof body.checkout_url !== 'string' ||
    !body.checkout_url.startsWith('https://')
  )
    throw new Error('Checkout returned no URL')
  return body.checkout_url
}

/**
 * Verifies a Standard Webhooks signature: HMAC-SHA256 over
 * `${id}.${timestamp}.${body}` with the base64 secret after `whsec_`,
 * sent as space-separated `v1,<base64>` entries. Rejects timestamps more
 * than `toleranceSeconds` away, so an old delivery cannot be replayed.
 */
export function verifyWebhook({
  id,
  timestamp,
  signature,
  body,
  secret,
  nowSeconds,
  toleranceSeconds = 300,
}: {
  id: string | null
  timestamp: string | null
  signature: string | null
  body: string
  secret: string
  nowSeconds: number
  toleranceSeconds?: number
}): boolean {
  if (!id || !timestamp || !signature || !secret) return false
  const sent = Number(timestamp)
  if (!Number.isFinite(sent) || Math.abs(nowSeconds - sent) > toleranceSeconds)
    return false
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64')
  if (key.length === 0) return false
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${body}`)
    .digest()
  return signature.split(' ').some((entry) => {
    const [version, value] = entry.split(',')
    if (version !== 'v1' || !value) return false
    const given = Buffer.from(value, 'base64')
    return given.length === expected.length && timingSafeEqual(given, expected)
  })
}
