import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Pure checks for the `@kitsu-pro` registry route, kept apart from Next so
 * bun can test them. The route serves `registry-pro/r/{name}.json` only to
 * requests carrying one of the keys in `KITSU_PRO_KEYS`.
 */

/** `promo-pill.json` → `promo-pill`; anything that could leave the folder → null. */
export function parseItemName(param: string): string | null {
  const name = param.endsWith('.json') ? param.slice(0, -5) : param
  return /^[a-z0-9][a-z0-9-]{0,63}$/.test(name) ? name : null
}

/** Comma- or newline-separated keys; blanks and short keys are ignored. */
export function readKeys(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[,\n]/)
    .map((key) => key.trim())
    .filter((key) => key.length >= 16)
}

const digest = (value: string) => createHash('sha256').update(value).digest()

/**
 * True when `Authorization: Bearer <key>` matches a configured key. Keys are
 * hashed first so the comparison is constant-time whatever their length.
 */
export function isAuthorized(header: string | null, keys: readonly string[]) {
  const match = header?.match(/^Bearer\s+(\S+)\s*$/i)
  if (!match?.[1] || keys.length === 0) return false
  const given = digest(match[1])
  let ok = false
  for (const key of keys) ok = timingSafeEqual(given, digest(key)) || ok
  return ok
}
