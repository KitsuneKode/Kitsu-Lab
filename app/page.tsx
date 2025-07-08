import Link from 'next/link'
import ShowcaseList from '@/components/showcase-list'

export default function Home() {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-16 p-8 pb-20 sm:p-20">
      <div className="text-center text-2xl font-bold">
        All of the components and design elements created by{' '}
        <Link href="https://x.com/kitsunekode">Kitsunekode</Link>
      </div>

      <ShowcaseList />
    </div>
  )
}
