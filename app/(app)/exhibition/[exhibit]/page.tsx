import { Suspense } from 'react'
import Link from 'next/link'
import Intro from '@/components/intro'
import { registry } from '@/app/utils/registry'
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
        className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs font-medium text-neutral-300 backdrop-blur-xl transition-[background-color,color,scale] hover:bg-neutral-800 hover:text-white hover:scale-105"
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
      <div className="relative min-h-dvh w-full flex flex-col items-center">
        <BackToLab />
        <div>Not Found</div>
      </div>
    )
  }

  const Exhibit = componentExists.component

  return (
    <div className="relative min-h-dvh w-full flex flex-col items-center">
      <BackToLab />
      {exhibit !== 'book-reader' && <Intro name={componentExists.name} />}
      <div className="w-full flex-1 flex flex-col items-center justify-start">
        <Exhibit />
      </div>
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
