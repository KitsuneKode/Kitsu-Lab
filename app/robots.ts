import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

/** Crawl the pages; keep APIs, the paid registry and receipts out of search. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/pro/r/', '/pro/thanks'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
