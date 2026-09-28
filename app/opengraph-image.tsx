import { ImageResponse } from 'next/og'
import { OG_SIZE, OgCard } from '@/lib/og-card'
import { SITE_NAME } from '@/lib/site'

export const alt = `${SITE_NAME}: shadcn components you install and own`
export const size = OG_SIZE
export const contentType = 'image/png'

/** The site's social card. */
export default function Image() {
  return new ImageResponse(
    <OgCard
      eyebrow="Kitsu Lab"
      title="shadcn components you install and own"
      description="Promotions and campaigns, an interactive book and PDF reader, and more."
    />,
    size,
  )
}
