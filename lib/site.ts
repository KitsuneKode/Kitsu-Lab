/** The public origin, for canonical URLs, sitemaps and checkout returns. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://kitsu-lab.vercel.app'
).replace(/\/+$/, '')

export const SITE_NAME = 'Kitsu Lab'
export const SITE_DESCRIPTION =
  'Production-ready shadcn components with live exhibits: a promotions and campaign system, an interactive book and PDF reader, and more. Install with the shadcn CLI.'
