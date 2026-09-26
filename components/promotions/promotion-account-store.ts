import type { DismissalStore } from './promotion-stores'

/**
 * How the account store talks to your backend. `load` returns every value
 * saved for the signed-in visitor; `save` receives only what changed, with
 * `null` meaning "forget this key".
 */
export type AccountTransport = {
  load: () => Promise<Record<string, number>>
  save: (changes: Record<string, number | null>) => Promise<void>
}

export type AccountStore = DismissalStore & {
  /** Sends pending writes now. Called for you when the tab is hidden. */
  flush: () => Promise<void>
  /** Resolves once the first load has finished (or failed). */
  ready: () => Promise<void>
}

const MAX_KEYS = 500

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
 * hidden. A failed save keeps its changes and retries with the next write
 * or flush; a write made while a load is in flight is never overwritten
 * by it.
 */
export function accountDismissalStore({
  transport,
  initial,
  debounceMs = 500,
  onError,
}: {
  transport: AccountTransport
  initial?: ReadonlyMap<string, number> | Record<string, number>
  debounceMs?: number
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

  const notify = () => listeners.forEach((listener) => listener())

  const load = () => {
    loading ??= transport
      .load()
      .then((raw) => {
        const next = cleanValues(raw)
        // Local intent wins over what the server knew before it.
        for (const [key, value] of [...beforeLoad, ...pending]) {
          if (value === null) next.delete(key)
          else next.set(key, value)
        }
        values = next
        notify()
      })
      .catch((error: unknown) => onError?.(error))
      .finally(() => {
        loaded = true
        beforeLoad.clear()
      })
    return loading
  }

  const flush = () => {
    if (timer) clearTimeout(timer)
    timer = null
    saving = saving.then(async () => {
      if (pending.size === 0) return
      const batch = Object.fromEntries(pending)
      pending.clear()
      try {
        await transport.save(batch)
      } catch (error) {
        // Put back whatever has not been overwritten since.
        for (const [key, value] of Object.entries(batch)) {
          if (!pending.has(key)) pending.set(key, value)
        }
        onError?.(error)
      }
    })
    return saving
  }

  const schedule = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), debounceMs)
  }

  return {
    get: (key) => values.get(key) ?? null,
    set: (key, at) => {
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
  }
}

/**
 * A JSON transport for `accountDismissalStore`: `GET url` returns the
 * saved values, `POST url` with `{ changes }` stores them. Cookies are
 * sent, so your route can read the session. Saves use `keepalive`, so one
 * made as the tab closes still arrives.
 */
export function fetchAccountTransport(
  url: string,
  { fetch: request = fetch }: { fetch?: typeof fetch } = {},
): AccountTransport {
  return {
    async load() {
      const response = await request(url, {
        credentials: 'same-origin',
        headers: { accept: 'application/json' },
      })
      if (!response.ok) throw new Error(`Load failed: ${response.status}`)
      return (await response.json()) as Record<string, number>
    },
    async save(changes) {
      const response = await request(url, {
        method: 'POST',
        credentials: 'same-origin',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ changes }),
      })
      if (!response.ok) throw new Error(`Save failed: ${response.status}`)
    },
  }
}
