import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { isAuthorized, parseItemName, readKeys } from '@/lib/pro-registry'

/**
 * The `@kitsu-pro` shadcn registry. Buyers add it to components.json:
 *
 * "@kitsu-pro": {
 *   "url": "https://kitsu-lab.vercel.app/pro/r/{name}.json",
 *   "headers": { "Authorization": "Bearer ${KITSU_PRO_KEY}" }
 * }
 *
 * Keys live in the `KITSU_PRO_KEYS` environment variable (comma separated).
 * Without it the registry is closed.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ name: string }> },
) {
  const name = parseItemName((await ctx.params).name)
  if (!name) return error(404, 'No such item.')

  const keys = readKeys(process.env.KITSU_PRO_KEYS)
  if (keys.length === 0)
    return error(503, 'The pro registry is not configured yet.')
  if (!isAuthorized(request.headers.get('authorization'), keys))
    return error(
      401,
      'Add your key to components.json: "headers": { "Authorization": "Bearer ${KITSU_PRO_KEY}" }.',
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
