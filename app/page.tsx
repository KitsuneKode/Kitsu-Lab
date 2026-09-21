import Link from 'next/link'
import ShowcaseList from '@/components/showcase-list'
import { NavTransition } from '@/components/nav-transition'

export default function Home() {
  return (
    <NavTransition>
      <div className="flex h-dvh w-full flex-col items-center justify-center gap-16 p-8 pb-20 sm:p-20">
        <div className="text-center text-2xl font-bold">
          All of the components and design elements created by{' '}
          <Link href="https://x.com/kitsunekode">Kitsunekode</Link>
        </div>

        <ShowcaseList />
      </div>
    </NavTransition>
  )
}
