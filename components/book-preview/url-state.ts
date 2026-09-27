/**
 * Shareable reader state in the query string. A link someone copies should
 * open on the same page, in the same mode, layout, and paper — and a refresh
 * must never throw any of that away.
 *
 * The pure helpers below are what the shell and engines share; they never
 * touch `window`, so bun tests them directly. The two browser wrappers at the
 * bottom are the only place history is written, always with replaceState —
 * turning pages must never spam the back stack.
 */

export type BookPreviewUrlKeys = {
  /** One-based page number, e.g. `?page=12`. */
  page?: string
  /** Reader mode id, e.g. `?mode=premier`. */
  mode?: string
  /** Paper appearance, e.g. `?theme=sepia`. */
  appearance?: string
  /** Engine-level layout (the premier reader's book/single/spread/scroll/text). */
  view?: string
}

export const DEFAULT_URL_KEYS: Required<BookPreviewUrlKeys> = {
  page: 'page',
  mode: 'mode',
  appearance: 'theme',
  view: 'view',
}

/**
 * `urlState` accepts `true` for the default keys, or an object that renames
 * or opts into individual keys. The legacy `pageParam` prop still works and
 * wins for the page key.
 */
export function resolveUrlKeys(
  urlState: boolean | BookPreviewUrlKeys | undefined,
  pageParam: string | undefined,
): BookPreviewUrlKeys {
  const keys: BookPreviewUrlKeys =
    urlState === true
      ? { ...DEFAULT_URL_KEYS }
      : urlState
        ? { ...urlState }
        : {}
  if (pageParam) keys.page = pageParam
  return keys
}

/** Reads one value, returning null for a missing or blank key. */
export function readParam(search: string, key: string | undefined) {
  if (!key) return null
  const value = new URLSearchParams(search).get(key)
  return value === null || value.trim() === '' ? null : value
}

/** Parses a one-based page param into a zero-based index, or null. */
export function parsePageParam(raw: string | null): number | null {
  if (raw === null) return null
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed - 1 : null
}

/** Narrows a param to one of the allowed values. */
export function pickAllowed<T extends string>(
  raw: string | null,
  allowed: readonly T[],
): T | null {
  return raw !== null && (allowed as readonly string[]).includes(raw)
    ? (raw as T)
    : null
}

/**
 * Applies a patch to a query string and returns the new one — or null when
 * nothing changed, so callers can skip a redundant replaceState. A null value
 * removes the key; undefined keys are ignored.
 */
export function patchSearch(
  search: string,
  patch: Record<string, string | null | undefined>,
): string | null {
  const params = new URLSearchParams(search)
  let changed = false
  for (const [key, value] of Object.entries(patch)) {
    if (!key || value === undefined) continue
    const current = params.get(key)
    if (value === null) {
      if (current !== null) {
        params.delete(key)
        changed = true
      }
      continue
    }
    if (current !== value) {
      params.set(key, value)
      changed = true
    }
  }
  if (!changed) return null
  const next = params.toString()
  return next ? `?${next}` : ''
}

export function readUrlParam(key: string | undefined): string | null {
  if (typeof window === 'undefined') return null
  try {
    return readParam(window.location.search, key)
  } catch {
    return null
  }
}

export function writeUrlParams(
  patch: Record<string, string | null | undefined>,
): void {
  if (typeof window === 'undefined') return
  try {
    const next = patchSearch(window.location.search, patch)
    if (next === null) return
    const url = `${window.location.pathname}${next}${window.location.hash}`
    // Keep whatever state the router stored — Next's app router keeps its
    // tree in history.state, and a null here would drop it.
    window.history.replaceState(window.history.state, '', url)
  } catch {
    // history may be unavailable (sandboxed iframe).
  }
}
