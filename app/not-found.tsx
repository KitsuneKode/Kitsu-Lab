import Link from 'next/link'
import { registry } from '@/app/utils/registry'

export const metadata = { title: 'Not found' }

/** A wrong turn: say so plainly, then offer every exhibit as the way back. */
export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 sm:px-8">
      <header className="border-border flex items-baseline justify-between border-b py-6">
        <Link
          href="/"
          className="font-display text-sm font-bold tracking-[0.3em] uppercase"
        >
          Kitsu Lab
        </Link>
        <span className="text-muted-foreground font-mono text-xs">404</span>
      </header>
      <main className="flex flex-1 flex-col justify-center gap-10 py-16">
        <div className="flex flex-col gap-3">
          <h1 className="font-display text-2xl font-bold text-balance">
            Nothing lives at this address
          </h1>
          <p className="text-muted-foreground max-w-md text-sm text-pretty">
            The link may be old, or mistyped. Every exhibit is one step away.
          </p>
        </div>
        <ul className="border-border divide-border divide-y border-y">
          {registry.list.map((exhibit, index) => (
            <li key={exhibit.path}>
              <Link
                href={`/exhibition/${exhibit.path}`}
                className="group hover:bg-muted/40 focus-visible:ring-ring/50 flex items-baseline gap-5 px-2 py-4 transition-colors outline-none focus-visible:ring-3"
              >
                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-medium">{exhibit.name}</span>
              </Link>
            </li>
          ))}
        </ul>
        <Link
          href="/"
          className="text-foreground decoration-foreground/30 hover:decoration-foreground self-start text-sm underline underline-offset-4 transition-colors"
        >
          Back to the lab
        </Link>
      </main>
    </div>
  )
}
