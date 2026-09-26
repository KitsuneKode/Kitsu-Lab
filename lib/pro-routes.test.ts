import { afterEach, describe, expect, test } from 'bun:test'

import { GET } from '../app/pro/r/[name]/route'
import { POST } from '../app/api/checkout/route'

const KEY = 'kp_live_0123456789abcdef'
/** Fails looksLikeLicenseKey, so these tests never reach the network. */
const BAD_KEY = 'not a license key'
const ORIGINAL_KEYS = process.env.KITSU_PRO_KEYS

afterEach(() => {
  if (ORIGINAL_KEYS === undefined) delete process.env.KITSU_PRO_KEYS
  else process.env.KITSU_PRO_KEYS = ORIGINAL_KEYS
})

function getItem(name: string, bearer?: string) {
  return GET(
    new Request(`https://lab.kitsunelabs.xyz/pro/r/${name}`, {
      headers: bearer ? { authorization: `Bearer ${bearer}` } : {},
    }),
    { params: Promise.resolve({ name }) },
  )
}

describe('pro registry route', () => {
  test('refuses names that could leave the folder before checking keys', async () => {
    process.env.KITSU_PRO_KEYS = KEY
    for (const bad of ['..%2Fsecret', 'a%2Fb', 'x'.repeat(80)])
      expect((await getItem(bad)).status).toBe(404)
  })

  test('a malformed key is a 401, never a Dodo lookup', async () => {
    process.env.KITSU_PRO_KEYS = KEY
    const res = await getItem('promo-pill', BAD_KEY)
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('Bearer')
  })

  test('no key at all is also a 401', async () => {
    process.env.KITSU_PRO_KEYS = KEY
    expect((await getItem('promo-pill')).status).toBe(401)
  })

  test('serves a built item privately to a listed key', async () => {
    process.env.KITSU_PRO_KEYS = KEY
    const res = await getItem('promo-pill', KEY)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    const body = (await res.json()) as { name?: string }
    expect(body.name).toBe('promo-pill')
  })

  test('returns 404 for a real-but-unbuilt item name', async () => {
    process.env.KITSU_PRO_KEYS = KEY
    const res = await getItem('not-an-item', KEY)
    expect(res.status).toBe(404)
  })
})

function checkout(body?: Record<string, string>) {
  return POST(
    new Request('https://lab.kitsunelabs.xyz/api/checkout', {
      method: 'POST',
      body: body ? new URLSearchParams(body) : undefined,
    }),
  )
}

describe('checkout route', () => {
  test('an unknown plan bounces back to /pro, never upstream', async () => {
    const res = await checkout({ plan: 'everything-free' })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(
      'https://lab.kitsunelabs.xyz/pro?checkout=unavailable',
    )
  })

  test('a real plan with no configured product also bounces, not errors', async () => {
    delete process.env.DODO_PRODUCT_PERSONAL
    const res = await checkout({ plan: 'personal' })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('checkout=unavailable')
  })

  test('a bodyless post still answers instead of throwing', async () => {
    const res = await checkout()
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/pro?checkout=unavailable')
  })
})
