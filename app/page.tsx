import Link from 'next/link'
import ShowcaseList from '@/components/showcase-list'
import { NavTransition } from '@/components/nav-transition'
import { registry } from '@/app/utils/registry'
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site'

const LINK =
  'text-foreground decoration-foreground/30 hover:decoration-foreground underline underline-offset-4 transition-colors'

export default function Home() {
  const count = registry.list.length
  const structured = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
        description: SITE_DESCRIPTION,
      },
      {
        '@type': 'ItemList',
        name: 'Kitsu Lab exhibits',
        itemListElement: registry.list.map((exhibit, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: exhibit.name,
          description: exhibit.description,
          url: `${SITE_URL}/exhibition/${exhibit.path}`,
        })),
      },
    ],
  }

  return (
    <NavTransition>
      <script
        type="application/ld+json"
        // Structured data for search engines; content is our own constants.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structured).replace(/</g, '\\u003c'),
        }}
      />
      <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-6 sm:px-8">
        <header className="border-border flex items-baseline justify-between border-b py-6">
          <span className="font-display text-sm font-bold tracking-[0.3em] uppercase">
            Kitsu Lab
          </span>
          <nav
            aria-label="Site"
            className="text-muted-foreground flex items-baseline gap-5 font-mono text-xs"
          >
            <span>{String(count).padStart(2, '0')} exhibits</span>
            <Link
              href="/pro"
              className="hover:text-foreground transition-colors"
            >
              Pro
            </Link>
          </nav>
        </header>

        <main className="flex flex-1 flex-col justify-center py-16">
          <h1 className="sr-only">
            {SITE_NAME}: shadcn components you install and own
          </h1>
          <p className="text-muted-foreground mb-12 max-w-md font-mono text-xs leading-relaxed">
            Production components with live exhibits by{' '}
            <Link href="https://x.com/kitsunekode" className={LINK}>
              @kitsunekode
            </Link>
            . Every exhibit installs through the shadcn registry; the pro set
            lives in{' '}
            <Link href="/pro" className={LINK}>
              Kitsu Pro
            </Link>
            .
          </p>

          <ShowcaseList />
        </main>

        <footer className="border-border text-muted-foreground flex flex-wrap items-center justify-between gap-3 border-t py-6 font-mono text-xs">
          <span>npx shadcn add @kitsu/…</span>
          <span className="flex gap-4">
            <Link
              href="/pro"
              className="hover:text-foreground transition-colors"
            >
              Pro
            </Link>
            <Link
              href="https://github.com/KitsuneKode/Kitsu-Lab"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </Link>
            <Link
              href="https://x.com/kitsunekode"
              className="hover:text-foreground transition-colors"
            >
              X
            </Link>
          </span>
        </footer>
      </div>
    </NavTransition>
  )
}
