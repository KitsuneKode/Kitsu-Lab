import { registry } from '@/app/utils/registry'
import type { Metadata, ResolvingMetadata } from 'next'

type Props = {
  params: Promise<{ exhibit: string }>
  // searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { exhibit } = await params

  // fetch datan
  const componentDetails = registry.list.find(
    (component) => component.path === exhibit,
  )
  const component = componentDetails?.name || 'Your goto component exhibition'
  // optionally access and extend (rather than replace) parent metadata
  const previousImages = (await parent).openGraph?.images || []

  const image =
    registry.list.find((component) => component.path === exhibit)?.image ||
    '/opengraph-image.png'

  return {
    title: `Kitsu-Lab -- ${component}`,
    openGraph: {
      images: [image, ...previousImages],
    },
    twitter: {
      title: `Kitsu-Lab -- ${component}`,
      card: 'summary_large_image',
      description:
        componentDetails?.description ||
        'Component exhibition library of Kitsunekode',
      images: [image, ...previousImages],
    },
  }
}

export default function ExhibitionLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen w-screen items-center justify-center">
      {children}
    </div>
  )
}
