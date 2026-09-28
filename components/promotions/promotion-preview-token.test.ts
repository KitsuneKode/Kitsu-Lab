import { describe, expect, test } from 'bun:test'

import {
  createPreviewToken,
  verifyPreviewToken,
} from './promotion-preview-token'

const secret = 'a-preview-secret-that-is-long-enough-1234'
const T0 = Date.UTC(2026, 8, 28)

describe('preview tokens', () => {
  test('round-trips an id until it expires', async () => {
    const token = await createPreviewToken('spring-bar', {
      secret,
      ttlMs: 60_000,
      now: T0,
    })
    expect(await verifyPreviewToken(token, { secret, now: T0 + 1000 })).toEqual(
      {
        id: 'spring-bar',
        expiresAt: T0 + 60_000,
      },
    )
    expect(
      await verifyPreviewToken(token, { secret, now: T0 + 60_000 }),
    ).toBeNull()
  })

  test('rejects a wrong secret, a tampered payload and junk', async () => {
    const token = await createPreviewToken('spring-bar', { secret, now: T0 })
    const [payload, signature] = token.split('.')
    const forged = btoa(JSON.stringify({ id: 'other', exp: T0 + 1e9 }))
      .replace(/=+$/, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
    const other = 'another-secret-that-is-also-long-enough-xyz'
    for (const bad of [
      `${forged}.${signature}`,
      `${payload}.${signature}x`,
      `${payload}`,
      `${payload}.${signature}.extra`,
      'not a token',
      '',
      undefined,
      ['a', 'b'],
    ])
      expect(await verifyPreviewToken(bad, { secret, now: T0 })).toBeNull()
    expect(
      await verifyPreviewToken(token, { secret: other, now: T0 }),
    ).toBeNull()
  })

  test('refuses a short secret', async () => {
    await expect(createPreviewToken('x', { secret: 'short' })).rejects.toThrow()
  })
})
