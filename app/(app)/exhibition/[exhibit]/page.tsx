import React from 'react'
import Link from 'next/link'
import Intro from '@/app/components/intro'
import { registry } from '@/app/utils/registry'

type Props = {
  params: Promise<{ exhibit: string }>
}

const ExhibitionPage = async ({ params }: Props) => {
  const { exhibit } = await params

  const componentExists = registry.list.find(
    (component) => component.path === exhibit,
  )

  if (!componentExists) {
    return <div>Not Found</div>
  }

  const Exhibit = componentExists.component

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center">
      <Link href="/" className="absolute top-12 left-12 text-xl">
        Home
      </Link>
      <Intro name={componentExists.name} />

      <Exhibit />
    </div>
  )
}

export default ExhibitionPage
