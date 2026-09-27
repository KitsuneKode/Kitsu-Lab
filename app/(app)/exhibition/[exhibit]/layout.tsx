import type { Metadata } from 'next'
import { registry } from '@/app/utils/registry'

type Props = {
  params: Promise<{ exhibit: string }>
}

/**
 * Each exhibit's title, description and canonical URL. The social image
 * comes from the sibling opengraph-image, so it is never empty.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { exhibit } = await params
  const entry = registry.list.find((item) => item.path === exhibit)
  if (!entry) return { title: 'Not found', robots: { index: false } }
  const title = `${entry.name} for shadcn`
  return {
    title,
    description: entry.description,
    alternates: { canonical: `/exhibition/${entry.path}` },
    openGraph: { title, description: entry.description, type: 'article' },
    twitter: {
      card: 'summary_large_image',
      title,
      description: entry.description,
    },
  }
}

export default function ExhibitionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh w-full [align-items:safe_center] justify-center overflow-x-clip">
      {children}
    </div>
  )
}
