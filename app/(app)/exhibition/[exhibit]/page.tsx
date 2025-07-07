import React from 'react'
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
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-700">
      <Exhibit />
    </div>
  )
}

export default ExhibitionPage
