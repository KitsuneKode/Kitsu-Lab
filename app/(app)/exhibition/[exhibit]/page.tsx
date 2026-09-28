import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import Intro from '@/components/intro'
import { registry } from '@/app/utils/registry'
import { ExhibitStage } from '@/components/exhibit-stage'
import { NavTransition } from '@/components/nav-transition'
import { BackToLab } from '@/components/exhibit-chrome'

type Props = {
  params: Promise<{ exhibit: string }>
}

export function generateStaticParams() {
  return registry.list.map((component) => ({ exhibit: component.path }))
}

async function ExhibitionBody({ params }: Props) {
  const { exhibit } = await params

  const componentExists = registry.list.find(
    (component) => component.path === exhibit,
  )

  // The site's 404 page, marked noindex. The status stays 200: the shell
  // has already streamed by the time params resolve.
  if (!componentExists) notFound()

  const Exhibit = componentExists.component

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center">
      <BackToLab />
      {exhibit !== 'book-reader' && (
        <Intro name={componentExists.name} slug={componentExists.path} />
      )}
      <ExhibitStage hasIntro={exhibit !== 'book-reader'}>
        <Exhibit />
      </ExhibitStage>
    </div>
  )
}

const ExhibitionPage = ({ params }: Props) => {
  return (
    <NavTransition>
      <Suspense
        fallback={
          <div className="relative min-h-dvh w-full">
            <BackToLab />
          </div>
        }
      >
        <ExhibitionBody params={params} />
      </Suspense>
    </NavTransition>
  )
}

export default ExhibitionPage
