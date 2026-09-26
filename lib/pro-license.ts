import { createLicenseCache, dodoEnvironment, validateLicense } from './dodo'
import { isAuthorized, readKeys } from './pro-registry'

/**
 * One place that answers "may this key install pro items?". Keys listed in
 * KITSU_PRO_KEYS (for you, testers and gifted licenses) always work; any
 * other key is checked with Dodo, whose answer follows the purchase or the
 * subscription it belongs to.
 */
const cache = createLicenseCache()

export async function isProKey(key: string): Promise<boolean> {
  if (isAuthorized(`Bearer ${key}`, readKeys(process.env.KITSU_PRO_KEYS)))
    return true
  const environment = dodoEnvironment(process.env.DODO_PAYMENTS_ENVIRONMENT)
  return cache.check(key, Date.now(), () =>
    validateLicense(key, { environment }),
  )
}

/** After a cancellation or refund, forget cached answers straight away. */
export function forgetLicenses() {
  cache.clear()
}
