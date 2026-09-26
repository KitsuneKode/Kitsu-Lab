import { describe, expect, test } from 'bun:test'

import {
  accountDismissalStore,
  fetchAccountTransport,
  type AccountTransport,
} from './promotion-account-store'

/** A transport whose load resolves when the test says so. */
function fakeTransport(server: Record<string, number> = {}) {
  const saves: Record<string, number | null>[] = []
  const accounts: string[] = []
  let release: (() => void) | undefined
  const gate = new Promise<void>((resolve) => (release = resolve))
  let failNext = false
  const transport: AccountTransport = {
    load: async (accountId) => {
      accounts.push(accountId)
      await gate
      return { ...server }
    },
    save: async (changes, accountId) => {
      accounts.push(accountId)
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
    accounts,
    release: () => release?.(),
    failNextSave: () => (failNext = true),
  }
}

describe('accountDismissalStore', () => {
  test('first render reads the server-provided initial values', () => {
    const { transport } = fakeTransport()
    const store = accountDismissalStore({
      accountId: 'u1',
      transport,
      initial: { 'promo:a': 100 },
    })
    expect(store.get('promo:a', 'account')).toBe(100)
    expect(store.get('promo:b', 'account')).toBeNull()
  })

  test('load replaces the local copy and notifies subscribers', async () => {
    const fake = fakeTransport({ 'promo:a': 200, 'promo:b': 50 })
    const store = accountDismissalStore({
      accountId: 'u1',
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
    const store = accountDismissalStore({
      accountId: 'u1',
      transport: fake.transport,
    })
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
      accountId: 'u1',
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
      accountId: 'u1',
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
      accountId: 'u1',
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

describe('account safety', () => {
  test('every load and save names the store account', async () => {
    const fake = fakeTransport()
    const store = accountDismissalStore({
      accountId: 'u1',
      transport: fake.transport,
    })
    fake.release()
    await store.ready()
    store.set('promo:a', 1, 'account')
    await store.flush()
    expect(fake.accounts).toEqual(['u1', 'u1'])
  })

  test('close drops local values and unsent writes, and ignores later ones', async () => {
    const fake = fakeTransport()
    const store = accountDismissalStore({
      accountId: 'u1',
      transport: fake.transport,
      initial: { 'promo:a': 5 },
      debounceMs: 10_000,
    })
    store.set('promo:b', 7, 'account')
    store.close()
    store.set('promo:c', 9, 'account')
    await store.flush()
    expect(store.get('promo:a', 'account')).toBeNull()
    expect(store.get('promo:c', 'account')).toBeNull()
    expect(fake.saves).toHaveLength(0)
  })

  test('a failed save retries on its own with backoff', async () => {
    const fake = fakeTransport()
    const store = accountDismissalStore({
      accountId: 'u1',
      transport: fake.transport,
      debounceMs: 10_000,
      retryMs: 5,
    })
    fake.failNextSave()
    store.set('promo:a', 10, 'account')
    await store.flush()
    expect(fake.saves).toHaveLength(0)
    await new Promise((resolve) => setTimeout(resolve, 30))
    await store.flush()
    expect(fake.saves).toEqual([{ 'promo:a': 10 }])
  })

  test('a failed load is retried and keeps writes made before it', async () => {
    let calls = 0
    const store = accountDismissalStore({
      accountId: 'u1',
      transport: {
        load: async () => {
          calls += 1
          if (calls === 1) throw new Error('offline')
          return { 'promo:a': 1, 'promo:b': 2 }
        },
        save: async () => {},
      },
      onError: () => {},
    })
    store.set('promo:a', 50, 'account')
    await store.ready()
    await store.ready()
    expect(calls).toBe(2)
    expect(store.get('promo:a', 'account')).toBe(50)
    expect(store.get('promo:b', 'account')).toBe(2)
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
    expect(await transport.load('u1')).toEqual({ 'promo:a': 1 })
    await transport.save({ 'promo:a': null }, 'u1')
    const headers = (calls[1]?.init?.headers ?? {}) as Record<string, string>
    expect(headers['x-promo-account']).toBe('u1')
    expect(calls[1]?.init?.method).toBe('POST')
    expect(calls[1]?.init?.keepalive).toBe(true)
    expect(calls[1]?.init?.body).toBe('{"changes":{"promo:a":null}}')
  })

  test('throws on a failed response so the store can retry', async () => {
    const request = (async () =>
      new Response(null, { status: 401 })) as unknown as typeof fetch
    const transport = fetchAccountTransport('/api/state', { fetch: request })
    await expect(transport.load('u1')).rejects.toThrow('401')
  })
})
