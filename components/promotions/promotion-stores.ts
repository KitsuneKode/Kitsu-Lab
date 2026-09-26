import type { DismissScope } from './promotion'

/**
 * Where visitor state lives: dismissals, when a surface was last shown, a
 * minimised toast. Values are epoch ms; `null` means never written.
 *
 * Every promotion names a scope (see `dismissScope`), and the provider asks
 * the store for that scope. Compose one store per scope with `composeStores`.
 */
export type DismissalStore = {
  get: (key: string, scope: DismissScope) => number | null
  set: (key: string, at: number, scope: DismissScope) => void
  /** Optional: call `onChange` when another tab or device writes. */
  subscribe?: (onChange: () => void) => () => void
}

/** Web Storage, or null where touching it throws (private windows, sandboxed frames). */
function safeStorage(kind: 'local' | 'session'): Storage | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

/** Parses a stored epoch; anything non-finite reads as never written. */
function readNumber(raw: string | null | undefined): number | null {
  const value = raw ? Number(raw) : Number.NaN
  return Number.isFinite(value) ? value : null
}

/**
 * sessionStorage for `tab`, localStorage for everything else. Storage can
 * throw in private windows; reads then return null and writes are dropped,
 * while the provider still honours the dismissal for the current page.
 */
export const browserDismissalStore: DismissalStore = {
  get(key, scope) {
    try {
      return readNumber(
        safeStorage(scope === 'tab' ? 'session' : 'local')?.getItem(key),
      )
    } catch {
      return null
    }
  },
  set(key, at, scope) {
    try {
      const storage = safeStorage(scope === 'tab' ? 'session' : 'local')
      if (Number.isFinite(at)) storage?.setItem(key, String(at))
      else storage?.removeItem(key)
    } catch {
      // Private window or quota: the provider keeps it in memory.
    }
  },
  subscribe(onChange) {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith('promo:')) onChange()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  },
}

/** Cookie names allow a narrower alphabet than storage keys. */
const cookieName = (key: string) => key.replace(/[^\w-]/g, '_')

/**
 * Parses a `Cookie` header (or `document.cookie`) into promotion values, so
 * a server component can pass them down and render an inline bar with no
 * layout shift: `readPromotionCookies((await cookies()).toString())`.
 */
export function readPromotionCookies(header: string): Map<string, number> {
  const values = new Map<string, number>()
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=')
    if (!rawName?.startsWith('promo_')) continue
    let decoded: string
    try {
      decoded = decodeURIComponent(rest.join('='))
    } catch {
      // One malformed cookie must not break rendering; skip just that one.
      continue
    }
    const value = readNumber(decoded)
    if (value !== null) values.set(rawName, value)
  }
  return values
}

/**
 * First-party cookies, readable by the server. Only epoch numbers are
 * stored, never anything about the visitor. Whether this needs consent
 * depends on your region and use; a dismissal the visitor asked for is
 * usually treated as strictly necessary.
 */
export function cookieDismissalStore({
  maxAgeDays = 365,
  path = '/',
  initial,
}: {
  maxAgeDays?: number
  path?: string
  /** Values read on the server with `readPromotionCookies`, for the first render. */
  initial?: ReadonlyMap<string, number>
} = {}): DismissalStore {
  return {
    get(key) {
      const name = cookieName(key)
      if (typeof document === 'undefined') return initial?.get(name) ?? null
      return readPromotionCookies(document.cookie).get(name) ?? null
    },
    set(key, at) {
      if (typeof document === 'undefined') return
      const name = cookieName(key)
      const age = Number.isFinite(at) ? maxAgeDays * 86_400 : 0
      document.cookie = `${name}=${Number.isFinite(at) ? at : ''}; Max-Age=${age}; Path=${path}; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`
    },
  }
}

/** In memory only. For previews, tests and demos. */
export function memoryDismissalStore(): DismissalStore & { clear: () => void } {
  const map = new Map<string, number>()
  const id = (key: string, scope: DismissScope) => `${scope}|${key}`
  return {
    get: (key, scope) => map.get(id(key, scope)) ?? null,
    set: (key, at, scope) => {
      if (Number.isFinite(at)) map.set(id(key, scope), at)
      else map.delete(id(key, scope))
    },
    clear: () => map.clear(),
  }
}

/**
 * One store per scope. Scopes without a store fall back to `browser` (and
 * `browser` to the default), so a site can add `account` later without
 * touching its promotions.
 *
 * ```ts
 * composeStores({ cookie: cookieDismissalStore(), account: myApiStore })
 * ```
 */
export function composeStores(
  stores: Partial<Record<DismissScope, DismissalStore>>,
): DismissalStore {
  const browser = stores.browser ?? browserDismissalStore
  const pick = (scope: DismissScope) =>
    stores[scope] ?? (scope === 'tab' ? browserDismissalStore : browser)
  const unique = [...new Set(Object.values(stores))]
  return {
    get: (key, scope) => pick(scope).get(key, scope),
    set: (key, at, scope) => pick(scope).set(key, at, scope),
    subscribe: (onChange) => {
      const offs = [browserDismissalStore, ...unique].map((store) =>
        store.subscribe?.(onChange),
      )
      return () => offs.forEach((off) => off?.())
    },
  }
}
