import Link from 'next/link'
import { Suspense } from 'react'
import Intro from '@/components/intro'
import { registry } from '@/app/utils/registry'
import { ExhibitStage } from '@/components/exhibit-stage'
import { NavTransition } from '@/components/nav-transition'

type Props = {
  params: Promise<{ exhibit: string }>
}

export function generateStaticParams() {
  return registry.list.map((component) => ({ exhibit: component.path }))
}

function BackToLab() {
  return (
    <div
      className="fixed top-5 left-5 z-50"
      style={{ viewTransitionName: 'exhibit-back' }}
    >
      <Link
        href="/"
        prefetch
        transitionTypes={['nav-back']}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs font-medium text-neutral-300 backdrop-blur-xl transition-[background-color,color,scale] hover:scale-105 hover:bg-neutral-800 hover:text-white"
      >
        <span>←</span>
        <span>Back to Lab</span>
      </Link>
    </div>
  )
}

async function ExhibitionBody({ params }: Props) {
  const { exhibit } = await params

  const componentExists = registry.list.find(
    (component) => component.path === exhibit,
  )

  if (!componentExists) {
    return (
      <div className="relative flex min-h-dvh w-full flex-col items-center">
        <BackToLab />
        <div>Not Found</div>
      </div>
    )
  }

  const Exhibit = componentExists.component

  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center">
      <BackToLab />
      {exhibit !== 'book-reader' && <Intro name={componentExists.name} />}
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
