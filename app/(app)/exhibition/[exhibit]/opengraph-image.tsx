import { ImageResponse } from 'next/og'
import { registry } from '@/app/utils/registry'
import { OG_SIZE, OgCard } from '@/lib/og-card'

export const alt = 'A Kitsu Lab exhibit'
export const size = OG_SIZE
export const contentType = 'image/png'

export function generateStaticParams() {
  return registry.list.map((exhibit) => ({ exhibit: exhibit.path }))
}

/** One social card per exhibit, from its registry name and description. */
export default async function Image({
  params,
}: {
  params: Promise<{ exhibit: string }>
}) {
  const { exhibit } = await params
  const entry = registry.list.find((item) => item.path === exhibit)
  return new ImageResponse(
    <OgCard
      eyebrow="Kitsu Lab · exhibit"
      title={entry?.name ?? 'Kitsu Lab'}
      description={entry?.description ?? 'A shadcn component exhibit.'}
    />,
    size,
  )
}
