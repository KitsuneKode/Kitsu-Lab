import type { DismissalStore } from './promotion-stores'

/**
 * How the account store talks to your backend. `load` returns every value
 * saved for the account; `save` receives only what changed, with `null`
 * meaning "forget this key". Both receive the account the store was made
 * for, so the server can refuse a request whose account is not the one
 * signed in (for example after a switch in another tab).
 */
export type AccountTransport = {
  load: (accountId: string) => Promise<Record<string, number>>
  save: (
    changes: Record<string, number | null>,
    accountId: string,
  ) => Promise<void>
}

export type AccountStore = DismissalStore & {
  /** Sends pending writes now. Called for you when the tab is hidden. */
  flush: () => Promise<void>
  /** Resolves once a load has finished; a failed load is retried later. */
  ready: () => Promise<void>
  /**
   * Call on sign-out or account switch: drops local values and unsent
   * writes, and ignores anything written afterwards. Make a new store for
   * the next account.
   */
  close: () => void
}

const MAX_KEYS = 500
const SAVE_RETRIES = 5

/** Keeps only well-formed entries from a server payload. */
function cleanValues(raw: unknown): Map<string, number> {
  const values = new Map<string, number>()
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return values
  for (const [key, value] of Object.entries(raw)) {
    if (values.size >= MAX_KEYS) break
    if (key.length > 200 || typeof value !== 'number') continue
    if (Number.isFinite(value)) values.set(key, value)
  }
  return values
}

/**
 * Dismissals that follow the visitor across devices, for promotions with
 * `dismiss.scope: 'account'`. Route it with `composeStores`:
 *
 * ```ts
 * composeStores({ account: accountDismissalStore({ transport: fetchAccountTransport('/api/promotions/state'), initial }) })
 * ```
 *
 * Reads are synchronous from a local copy. It starts from `initial` (read
 * on the server, so the first render already knows), refreshes from `load`
 * when the provider subscribes, and applies writes immediately. Writes go to
 * the server in batches after `debounceMs`, and again when the tab is
 * hidden. A failed save keeps its changes and retries with backoff; a
 * failed load is retried on the next subscribe or `ready()`. A write made
 * before a load lands is never overwritten by it.
 *
 * One store belongs to one account. Create it per signed-in user
 * (`useMemo(() => accountDismissalStore({ accountId: user.id, … }), [user.id])`)
 * and `close()` the old one when the user changes.
 */
export function accountDismissalStore({
  accountId,
  transport,
  initial,
  debounceMs = 500,
  retryMs = 1000,
  onError,
}: {
  /** The signed-in account this store reads and writes for. */
  accountId: string
  transport: AccountTransport
  initial?: ReadonlyMap<string, number> | Record<string, number>
  debounceMs?: number
  /** First retry delay after a failed save; doubles each time, up to 30s. */
  retryMs?: number
  /** Load and save failures, for your logging. The store keeps working locally. */
  onError?: (error: unknown) => void
}): AccountStore {
  let values = cleanValues(
    initial instanceof Map ? Object.fromEntries(initial) : initial,
  )
  const pending = new Map<string, number | null>()
  // Every write made before the first load lands, saved or not: the load
  // may carry an older copy of the same keys.
  const beforeLoad = new Map<string, number | null>()
  let loaded = false
  const listeners = new Set<() => void>()
  let loading: Promise<void> | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let saving: Promise<void> = Promise.resolve()
  let failures = 0
  let closed = false

  const notify = () => listeners.forEach((listener) => listener())

  const load = () => {
    if (closed) return Promise.resolve()
    loading ??= transport
      .load(accountId)
      .then((raw) => {
        if (closed) return
        const next = cleanValues(raw)
        // Local intent wins over what the server knew before it.
        for (const [key, value] of [...beforeLoad, ...pending]) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        values = next
        loaded = true
        beforeLoad.clear()
        notify()
      })
      .catch((error: unknown) => {
        // Keep the pre-load writes and try again on the next subscribe.
        loading = null
        onError?.(error)
      })
    return loading
  }

  const schedule = (delay = debounceMs) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), delay)
  }

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    saving = saving.then(async () => {
      if (closed || pending.size === 0) return
      const batch = Object.fromEntries(pending)
      pending.clear()
      try {
        await transport.save(batch, accountId)
        failures = 0
      } catch (error) {
        if (closed) return
        // Put back whatever has not been overwritten since, and try again.
        for (const [key, value] of Object.entries(batch)) {
          if (!pending.has(key)) pending.set(key, value)
        }
        failures += 1
        if (failures <= SAVE_RETRIES)
          schedule(Math.min(30_000, retryMs * 2 ** (failures - 1)))
        onError?.(error)
      }
    })
    return saving
  }

  return {
    get: (key) => values.get(key) ?? null,
    set: (key, at) => {
      if (closed) return
      if (Number.isFinite(at)) values.set(key, at)
      else values.delete(key)
      const value = Number.isFinite(at) ? at : null
      pending.set(key, value)
      if (!loaded) beforeLoad.set(key, value)
      notify()
      schedule()
    },
    subscribe: (onChange) => {
      listeners.add(onChange)
      void load()
      const onHide = () => {
        if (document.visibilityState === 'hidden') void flush()
      }
      if (typeof document !== 'undefined')
        document.addEventListener('visibilitychange', onHide)
      return () => {
        listeners.delete(onChange)
        if (typeof document !== 'undefined')
          document.removeEventListener('visibilitychange', onHide)
      }
    },
    flush,
    ready: () => load(),
    close: () => {
      closed = true
      if (timer) clearTimeout(timer)
      timer = null
      pending.clear()
      beforeLoad.clear()
      values = new Map()
      notify()
    },
  }
}

/**
 * A JSON transport for `accountDismissalStore`: `GET url` returns the
 * saved values, `POST url` with `{ changes }` stores them. Cookies are
 * sent, so your route can read the session, and the store's account goes
 * in `x-promo-account`: answer 409 when it is not the signed-in user.
 * Saves use `keepalive`, so one made as the tab closes still arrives.
 */
export function fetchAccountTransport(
  url: string,
  { fetch: request = fetch }: { fetch?: typeof fetch } = {},
): AccountTransport {
  return {
    async load(accountId) {
      const response = await request(url, {
        credentials: 'same-origin',
        headers: { accept: 'application/json', 'x-promo-account': accountId },
      })
      if (!response.ok) throw new Error(`Load failed: ${response.status}`)
      return (await response.json()) as Record<string, number>
    },
    async save(changes, accountId) {
      const response = await request(url, {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: {
          'content-type': 'application/json',
          'x-promo-account': accountId,
        },
        body: JSON.stringify({ changes }),
      })
      if (!response.ok) throw new Error(`Save failed: ${response.status}`)
    },
  }
}
