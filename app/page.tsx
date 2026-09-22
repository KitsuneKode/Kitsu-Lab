import Link from 'next/link'
import ShowcaseList from '@/components/showcase-list'
import { NavTransition } from '@/components/nav-transition'
import { registry } from '@/app/utils/registry'

export default function Home() {
  const count = registry.list.length
  return (
    <NavTransition>
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 sm:px-8">
        <header className="border-border flex items-baseline justify-between border-b py-6">
          <span className="font-display text-sm font-bold tracking-[0.3em] uppercase">
            Kitsu Lab
          </span>
          <span className="text-muted-foreground font-mono text-xs">
            {String(count).padStart(2, '0')} exhibits
          </span>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16">
          <p className="text-muted-foreground mb-12 max-w-md font-mono text-xs leading-relaxed">
            Components and design elements by{' '}
            <Link
              href="https://x.com/kitsunekode"
              className="text-foreground decoration-foreground/30 hover:decoration-foreground underline underline-offset-4 transition-colors"
            >
              @kitsunekode
            </Link>
            . Every exhibit is installable through the shadcn registry.
          </p>

          <ShowcaseList />
        </main>

        <footer className="border-border text-muted-foreground flex items-center justify-between border-t py-6 font-mono text-xs">
          <span>kitsulab.vercel.app</span>
          <span>npx shadcn add …</span>
        </footer>
      </div>
    </NavTransition>
  )
}
