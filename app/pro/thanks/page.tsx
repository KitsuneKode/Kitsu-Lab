import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Thanks for getting Kitsu Pro',
  robots: { index: false },
}

const SETUP = `// components.json
"registries": {
  "@kitsu": "${SITE_URL}/r/{name}.json",
  "@kitsu-pro": {
    "url": "${SITE_URL}/pro/r/{name}.json",
    "headers": { "Authorization": "Bearer \${KITSU_PRO_KEY}" }
  }
}

// .env.local (never commit it)
KITSU_PRO_KEY=your-license-key

npx shadcn@latest add @kitsu-pro/promotions-pro`

/** Where Dodo returns the buyer after checkout. */
export default function ThanksPage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-6 py-16 sm:px-8">
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Thank you
      </h1>
      <p className="text-muted-foreground text-pretty">
        Your license key is in the receipt email from Dodo Payments, and in your
        Dodo customer portal. It can take a minute to arrive. Then:
      </p>
      <pre className="bg-muted/50 overflow-x-auto rounded-lg p-4 font-mono text-xs leading-relaxed">
        {SETUP}
      </pre>
      <p className="text-muted-foreground text-sm">
        Stuck? Write to{' '}
        <Link
          href="https://x.com/kitsunekode"
          className="text-foreground underline underline-offset-4"
        >
          @kitsunekode
        </Link>{' '}
        with your order number.
      </p>
      <Link
        href="/exhibition/promotions"
        className="text-sm underline underline-offset-4"
      >
        Back to the promotions exhibit
      </Link>
    </div>
  )
}
