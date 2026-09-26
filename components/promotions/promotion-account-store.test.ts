import { describe, expect, test } from 'bun:test'

import {
  accountDismissalStore,
  fetchAccountTransport,
  type AccountTransport,
} from './promotion-account-store'

/** A transport whose load resolves when the test says so. */
function fakeTransport(server: Record<string, number> = {}) {
  const saves: Record<string, number | null>[] = []
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => (release = resolve))
  let failNext = false
  const transport: AccountTransport = {
    load: async () => {
      await gate
      return { ...server }
    },
    save: async (changes) => {
      if (failNext) {
        failNext = false
        throw new Error('offline')
      }
      saves.push(changes)
    },
  }
  return {
    transport,
    saves,
    release: () => release?.(),
    failNextSave: () => (failNext = true),
  }
}

describe('accountDismissalStore', () => {
  test('first render reads the server-provided initial values', () => {
    const { transport } = fakeTransport()
    const store = accountDismissalStore({
      transport,
      initial: { 'promo:a': 100 },
    })
    expect(store.get('promo:a', 'account')).toBe(100)
    expect(store.get('promo:b', 'account')).toBeNull()
  })

  test('load replaces the local copy and notifies subscribers', async () => {
    const fake = fakeTransport({ 'promo:a': 200, 'promo:b': 50 })
    const store = accountDismissalStore({
      transport: fake.transport,
      initial: { 'promo:a': 100 },
    })
    let calls = 0
    store.subscribe?.(() => calls++)
    fake.release()
    await store.ready()
    expect(store.get('promo:a', 'account')).toBe(200)
    expect(store.get('promo:b', 'account')).toBe(50)
    expect(calls).toBeGreaterThan(0)
  })

  test('writes made before the load lands are not overwritten by it', async () => {
    const fake = fakeTransport({ 'promo:a': 1, 'promo:gone': 5 })
    const store = accountDismissalStore({ transport: fake.transport })
    store.subscribe?.(() => {})
    store.set('promo:a', 999, 'account')
    store.set('promo:gone', Number.POSITIVE_INFINITY, 'account')
    // Saved before the load returns: still must win.
    await store.flush()
    fake.release()
    await store.ready()
    expect(store.get('promo:a', 'account')).toBe(999)
    expect(store.get('promo:gone', 'account')).toBeNull()
  })

  test('writes are batched into one save, with null for a cleared key', async () => {
    const fake = fakeTransport()
    const store = accountDismissalStore({
      transport: fake.transport,
      debounceMs: 10_000,
    })
    store.set('promo:a', 10, 'account')
    store.set('promo:b', 20, 'account')
    store.set('promo:a', Number.NaN, 'account')
    await store.flush()
    expect(fake.saves).toEqual([{ 'promo:a': null, 'promo:b': 20 }])
    await store.flush()
    expect(fake.saves).toHaveLength(1)
  })

  test('a failed save is retried with the next flush', async () => {
    const fake = fakeTransport()
    const errors: unknown[] = []
    const store = accountDismissalStore({
      transport: fake.transport,
      debounceMs: 10_000,
      onError: (error) => errors.push(error),
    })
    fake.failNextSave()
    store.set('promo:a', 10, 'account')
    await store.flush()
    expect(fake.saves).toHaveLength(0)
    expect(errors).toHaveLength(1)
    store.set('promo:b', 20, 'account')
    await store.flush()
    expect(fake.saves).toEqual([{ 'promo:a': 10, 'promo:b': 20 }])
  })

  test('ignores malformed server payloads', async () => {
    const store = accountDismissalStore({
      transport: {
        load: async () =>
          ({ 'promo:ok': 1, 'promo:bad': 'x', 'promo:inf': Infinity }) as never,
        save: async () => {},
      },
    })
    await store.ready()
    expect(store.get('promo:ok', 'account')).toBe(1)
    expect(store.get('promo:bad', 'account')).toBeNull()
    expect(store.get('promo:inf', 'account')).toBeNull()
  })
})

describe('fetchAccountTransport', () => {
  test('GETs values and POSTs changes as JSON with keepalive', async () => {
    const calls: { url: string; init?: RequestInit }[] = []
    const request = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      return new Response(init?.method === 'POST' ? null : '{"promo:a":1}', {
        status: init?.method === 'POST' ? 204 : 200,
      })
    }) as typeof fetch
    const transport = fetchAccountTransport('/api/state', { fetch: request })
    expect(await transport.load()).toEqual({ 'promo:a': 1 })
    await transport.save({ 'promo:a': null })
    expect(calls[1]?.init?.method).toBe('POST')
    expect(calls[1]?.init?.keepalive).toBe(true)
    expect(calls[1]?.init?.body).toBe('{"changes":{"promo:a":null}}')
  })

  test('throws on a failed response so the store can retry', async () => {
    const request = (async () =>
      new Response(null, { status: 401 })) as unknown as typeof fetch
    const transport = fetchAccountTransport('/api/state', { fetch: request })
    await expect(transport.load()).rejects.toThrow('401')
  })
})
