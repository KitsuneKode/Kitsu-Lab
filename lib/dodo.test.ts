import { createHmac } from 'node:crypto'
import { describe, expect, test } from 'bun:test'

import {
  createCheckout,
  createLicenseCache,
  createRateLimit,
  dodoEnvironment,
  validateLicense,
  verifyWebhook,
} from './dodo'

const KEY = '2b1f8e2d-c41e-4e8f-b2d3-d9fd61c38f43'

/** A fetch stub that records calls and answers with `reply`. */
function stub(reply: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = []
  const request = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    return reply(url, init)
  }) as typeof fetch
  return { calls, request }
}

describe('environment', () => {
  test('test mode only when asked for', () => {
    expect(dodoEnvironment('test_mode')).toBe('test_mode')
    expect(dodoEnvironment(undefined)).toBe('live_mode')
    expect(dodoEnvironment('TEST')).toBe('live_mode')
  })
})

describe('validateLicense', () => {
  test('posts the key to the right environment and reads valid', async () => {
    const { calls, request } = stub(() => Response.json({ valid: true }))
    expect(
      await validateLicense(KEY, { environment: 'test_mode', fetch: request }),
    ).toBe(true)
    expect(calls[0]?.url).toBe(
      'https://test.dodopayments.com/licenses/validate',
    )
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ license_key: KEY }))
  })

  test('anything but valid: true is a no, and junk never leaves', async () => {
    const no = stub(() => Response.json({ valid: false }))
    expect(
      await validateLicense(KEY, {
        environment: 'live_mode',
        fetch: no.request,
      }),
    ).toBe(false)
    const down = stub(() => new Response('oops', { status: 500 }))
    expect(
      await validateLicense(KEY, {
        environment: 'live_mode',
        fetch: down.request,
      }),
    ).toBe(false)
    const junk = stub(() => Response.json({ valid: true }))
    expect(
      await validateLicense('../x', {
        environment: 'live_mode',
        fetch: junk.request,
      }),
    ).toBe(false)
    expect(junk.calls).toHaveLength(0)
  })
})

describe('license cache', () => {
  test('one validation per key while fresh, even for parallel requests', async () => {
    const cache = createLicenseCache()
    let calls = 0
    const validate = async () => {
      calls += 1
      return true
    }
    const results = await Promise.all(
      Array.from({ length: 15 }, () => cache.check(KEY, 0, validate)),
    )
    expect(results.every(Boolean)).toBe(true)
    expect(calls).toBe(1)
    await cache.check(KEY, 60_000, validate)
    expect(calls).toBe(1)
  })

  test('a no is remembered briefly, so a fresh purchase works soon', async () => {
    const cache = createLicenseCache({ invalidFor: 60_000 })
    let answer = false
    const validate = async () => answer
    expect(await cache.check(KEY, 0, validate)).toBe(false)
    answer = true
    expect(await cache.check(KEY, 30_000, validate)).toBe(false)
    expect(await cache.check(KEY, 61_000, validate)).toBe(true)
  })

  test('a throwing validator counts as no and does not stick', async () => {
    const cache = createLicenseCache({ invalidFor: 1 })
    expect(
      await cache.check(KEY, 0, async () => {
        throw new Error('x')
      }),
    ).toBe(false)
    expect(await cache.check(KEY, 10, async () => true)).toBe(true)
  })
})

describe('createCheckout', () => {
  test('sends one product with the API key and returns the hosted URL', async () => {
    const { calls, request } = stub(() =>
      Response.json({
        session_id: 's',
        checkout_url: 'https://checkout.dodopayments.com/s',
      }),
    )
    const url = await createCheckout({
      productId: 'pdt_1',
      apiKey: 'sk_test',
      environment: 'test_mode',
      returnUrl: 'https://kitsu.dev/pro/thanks',
      fetch: request,
    })
    expect(url).toBe('https://checkout.dodopayments.com/s')
    expect(calls[0]?.url).toBe('https://test.dodopayments.com/checkouts')
    const headers = (calls[0]?.init?.headers ?? {}) as Record<string, string>
    expect(headers.authorization).toBe('Bearer sk_test')
    expect(JSON.parse(String(calls[0]?.init?.body)).product_cart).toEqual([
      { product_id: 'pdt_1', quantity: 1 },
    ])
  })

  test('fails loudly without a safe URL', async () => {
    const { request } = stub(() =>
      Response.json({ checkout_url: 'javascript:alert(1)' }),
    )
    await expect(
      createCheckout({
        productId: 'p',
        apiKey: 'k',
        environment: 'live_mode',
        returnUrl: 'https://x',
        fetch: request,
      }),
    ).rejects.toThrow()
  })
})

describe('verifyWebhook', () => {
  const secretBytes = Buffer.from('kitsu-test-secret-kitsu-test-secret')
  const secret = `whsec_${secretBytes.toString('base64')}`
  const body = '{"type":"payment.succeeded"}'
  const sign = (id: string, ts: string, payload = body) =>
    `v1,${createHmac('sha256', secretBytes).update(`${id}.${ts}.${payload}`).digest('base64')}`

  test('accepts a correct signature within the time window', () => {
    expect(
      verifyWebhook({
        id: 'msg_1',
        timestamp: '1000',
        signature: sign('msg_1', '1000'),
        body,
        secret,
        nowSeconds: 1100,
      }),
    ).toBe(true)
  })

  test('accepts when any of several signatures matches', () => {
    const signature = `v1,AAAA ${sign('msg_1', '1000')}`
    expect(
      verifyWebhook({
        id: 'msg_1',
        timestamp: '1000',
        signature,
        body,
        secret,
        nowSeconds: 1000,
      }),
    ).toBe(true)
  })

  test('rejects a changed body, a wrong secret, a replay and missing headers', () => {
    const signature = sign('msg_1', '1000')
    const base = {
      id: 'msg_1',
      timestamp: '1000',
      signature,
      body,
      secret,
      nowSeconds: 1000,
    }
    expect(verifyWebhook({ ...base, body: body + ' ' })).toBe(false)
    expect(verifyWebhook({ ...base, secret: 'whsec_b3RoZXI=' })).toBe(false)
    expect(verifyWebhook({ ...base, nowSeconds: 1000 + 301 })).toBe(false)
    expect(verifyWebhook({ ...base, id: null })).toBe(false)
    expect(verifyWebhook({ ...base, secret: '' })).toBe(false)
  })
})

describe('createRateLimit', () => {
  test('allows the limit within the window, then frees up as it slides', () => {
    const limit = createRateLimit({ limit: 2, windowMs: 1000 })
    expect(limit.take(0)).toBe(true)
    expect(limit.take(10)).toBe(true)
    expect(limit.take(20)).toBe(false)
    expect(limit.take(1001)).toBe(true)
  })
})

describe('license cache peek', () => {
  test('answers only while an entry is fresh', async () => {
    const cache = createLicenseCache({ validFor: 100 })
    expect(cache.peek(KEY, 0)).toBeUndefined()
    await cache.check(KEY, 0, async () => true)
    expect(cache.peek(KEY, 50)).toBe(true)
    expect(cache.peek(KEY, 150)).toBeUndefined()
  })
})
