import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'
import { registry } from '@/app/utils/registry'

/** Every public page: home, pricing and one page per exhibit. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/pro`, changeFrequency: 'monthly', priority: 0.9 },
    ...registry.list.map((exhibit) => ({
      url: `${SITE_URL}/exhibition/${exhibit.path}`,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
