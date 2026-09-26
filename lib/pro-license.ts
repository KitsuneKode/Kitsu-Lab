import {
  createLicenseCache,
  createRateLimit,
  dodoEnvironment,
  validateLicense,
} from './dodo'
import { isAuthorized, readKeys } from './pro-registry'

/**
 * One place that answers "may this key install pro items?". Keys listed in
 * KITSU_PRO_KEYS (for you, testers and gifted licenses) always work; any
 * other key is checked with Dodo, whose answer follows the purchase or the
 * subscription it belongs to.
 */
const cache = createLicenseCache()
// Fresh lookups only; cached answers never count against it.
const lookups = createRateLimit({ limit: 60, windowMs: 60_000 })

/** `busy` when too many unknown keys were checked in the last minute. */
export async function isProKey(key: string): Promise<boolean | 'busy'> {
  if (isAuthorized(`Bearer ${key}`, readKeys(process.env.KITSU_PRO_KEYS)))
    return true
  const environment = dodoEnvironment(process.env.DODO_PAYMENTS_ENVIRONMENT)
  const now = Date.now()
  const known = cache.peek(key, now)
  if (known !== undefined) return known
  // A busy answer is never cached, so a real buyer is not refused later.
  if (!lookups.take(now)) return 'busy'
  return cache.check(key, now, () => validateLicense(key, { environment }))
}

/** After a cancellation or refund, forget cached answers straight away. */
export function forgetLicenses() {
  cache.clear()
}
