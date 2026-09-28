/**
 * Signed preview links: `?promo-preview=<token>` shows one draft to whoever
 * holds the link, until it expires. Server only: the secret never reaches
 * the browser. Web Crypto (HMAC-SHA256), so it runs on Node, the edge and
 * serverless alike.
 *
 * ```ts
 * // an editor's "Copy preview link" route
 * const token = await createPreviewToken('spring-sale-bar', {
 *   secret: process.env.PROMO_PREVIEW_SECRET!,
 * })
 *
 * // the page that renders the provider
 * const claim = await verifyPreviewToken(searchParams[PREVIEW_PARAM], {
 *   secret: process.env.PROMO_PREVIEW_SECRET!,
 * })
 * const preview = claim ? await loadDraft(claim.id) : null
 * <PromotionProvider preview={preview} … />
 * ```
 */

export const PREVIEW_PARAM = 'promo-preview'

/** A day: long enough to pass a draft round a team, short enough to leak little. */
export const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000

export type PreviewClaim = { id: string; expiresAt: number }

const encoder = new TextEncoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) return null
  try {
    const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'))
    return Uint8Array.from(binary, (char) => char.charCodeAt(0))
  } catch {
    return null
  }
}

async function key(secret: string): Promise<CryptoKey> {
  if (secret.length < 32)
    throw new Error('A preview secret needs at least 32 characters.')
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** A token for one record id, valid for `ttlMs` (default a day). */
export async function createPreviewToken(
  id: string,
  {
    secret,
    ttlMs = PREVIEW_TTL_MS,
    now = Date.now(),
  }: { secret: string; ttlMs?: number; now?: number },
): Promise<string> {
  const payload = toBase64Url(
    encoder.encode(JSON.stringify({ id, exp: now + ttlMs })),
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    await key(secret),
    encoder.encode(payload),
  )
  return `${payload}.${toBase64Url(new Uint8Array(signature))}`
}

/**
 * The claim inside a valid, unexpired token; null for anything else. The
 * signature check is constant-time (crypto.subtle.verify).
 */
export async function verifyPreviewToken(
  token: string | string[] | null | undefined,
  { secret, now = Date.now() }: { secret: string; now?: number },
): Promise<PreviewClaim | null> {
  if (typeof token !== 'string' || token.length > 1024) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  const signatureBytes = fromBase64Url(signature)
  const payloadBytes = fromBase64Url(payload)
  if (!signatureBytes || !payloadBytes) return null
  const valid = await crypto.subtle.verify(
    'HMAC',
    await key(secret),
    signatureBytes,
    encoder.encode(payload),
  )
  if (!valid) return null
  try {
    const claim: unknown = JSON.parse(new TextDecoder().decode(payloadBytes))
    if (
      typeof claim !== 'object' ||
      claim === null ||
      typeof (claim as { id?: unknown }).id !== 'string' ||
      typeof (claim as { exp?: unknown }).exp !== 'number'
    )
      return null
    const { id, exp } = claim as { id: string; exp: number }
    return exp > now ? { id, expiresAt: exp } : null
  } catch {
    return null
  }
}
