import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { isProKey } from '@/lib/pro-license'
import { bearerToken, parseItemName } from '@/lib/pro-registry'

/**
 * The `@kitsu-pro` shadcn registry. Buyers add it to components.json:
 *
 * "@kitsu-pro": {
 *   "url": "https://kitsu-lab.vercel.app/pro/r/{name}.json",
 *   "headers": { "Authorization": "Bearer ${KITSU_PRO_KEY}" }
 * }
 *
 * A key is a Dodo Payments license key from a purchase or an active
 * subscription, or one listed in `KITSU_PRO_KEYS` (comma separated).
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const name = parseItemName((await ctx.params).name)
  if (!name) return error(404, 'No such item.')

  const key = bearerToken(request.headers.get('authorization'))
  if (!key || !(await isProKey(key)))
    return error(
      401,
      'This needs an active Kitsu Pro license. Add it to components.json: "headers": { "Authorization": "Bearer ${KITSU_PRO_KEY}" }, and get one at /pro.',
      { 'www-authenticate': 'Bearer realm="kitsu-pro"' },
    )

  try {
    const body = await readFile(
      path.join(process.cwd(), 'registry-pro', 'r', `${name}.json`),
      'utf8',
    )
    return new Response(body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'private, no-store',
      },
    })
  } catch {
    return error(404, `No pro item named "${name}".`)
  }
}

/** A JSON error the shadcn CLI prints as-is. */
function error(status: number, message: string, headers?: HeadersInit) {
  return Response.json(
    { error: message },
    { status, headers: { 'cache-control': 'no-store', ...headers } },
  )
}
