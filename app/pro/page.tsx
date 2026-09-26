import Link from 'next/link'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import { cn } from '@/lib/utils'
import { SITE_NAME, SITE_URL } from '@/lib/site'
import { PRO_PLANS } from '@/lib/pro-plans'
import { buttonVariants } from '@/components/ui/button-variants'
import { CheckoutNotice } from '@/components/pro/checkout-notice'

export const metadata: Metadata = {
  title: 'Kitsu Pro',
  description:
    'Pro shadcn components: a promotions and campaign system with spotlights, side cards, stories, A/B tests and kits. Monthly or lifetime.',
  alternates: { canonical: '/pro' },
}

const INCLUDED = [
  [
    'Surfaces',
    'Pill, offer sheet, progress, sticky CTA, carousel, inbox, spotlight, side card, full-screen story',
  ],
  ['Kits', 'Store sale, product launch and course enrolment, ready to fill in'],
  ['Tools', 'The promotion editor and the account dismissal store'],
  [
    'Growth',
    'Event triggers, audiences, A/B variants with holdout, one-tap apply, conversions',
  ],
] as const

const FAQ = [
  [
    'How do I install pro components?',
    'After checkout you get a license key by email. Add the @kitsu-pro registry to components.json with that key, then install with the shadcn CLI like any other item.',
  ],
  [
    'What happens when a monthly plan ends?',
    'The key stops installing new pro items. Code already in your project stays yours.',
  ],
  [
    'Which currencies and taxes?',
    'Checkout is handled by Dodo Payments, the merchant of record. It shows local prices where it can and handles sales tax and GST for you.',
  ],
  [
    'Is there a free tier?',
    'Yes. The promotions core (provider, rules, bar, card, badge, toast, dialog) and the other exhibits are free under @kitsu.',
  ],
] as const

/** Kitsu Pro plans and checkout. Each plan posts to /api/checkout. */
export default function ProPage() {
  // A plan is buyable once its Dodo product id is configured.
  const plans = PRO_PLANS.map((plan) =>
    Object.assign({}, plan, {
      available: Boolean(process.env[plan.productEnv]),
    }),
  )
  const offers = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: 'Kitsu Pro',
    description: metadata.description,
    brand: { '@type': 'Brand', name: SITE_NAME },
    url: `${SITE_URL}/pro`,
    offers: plans.map((plan) => ({
      '@type': 'Offer',
      name: plan.name,
      price: plan.price.replace(/[^0-9.]/g, ''),
      priceCurrency: 'USD',
      availability: plan.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/PreOrder',
      url: `${SITE_URL}/pro`,
    })),
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-6 sm:px-8">
      <script
        type="application/ld+json"
        // Structured data for search engines; content is our own constants.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(offers).replace(/</g, '\\u003c'),
        }}
      />
      <header className="border-border flex items-baseline justify-between border-b py-6">
        <Link
          href="/"
          className="font-display text-sm font-bold tracking-[0.3em] uppercase"
        >
          Kitsu Lab
        </Link>
        <span className="text-muted-foreground font-mono text-xs">Pro</span>
      </header>

      <main className="flex flex-col gap-14 py-16">
        <section className="flex max-w-2xl flex-col gap-4">
          <h1 className="font-display text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Kitsu Pro
          </h1>
          <p className="text-muted-foreground text-pretty">
            Promotions that ask once, politely, and convert: spotlights, side
            cards, stories, kits, audiences and A/B tests, as shadcn components
            you own. Install with the CLI, keep the code.
          </p>
          <Suspense fallback={null}>
            <CheckoutNotice />
          </Suspense>
        </section>

        <section aria-label="Plans" className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                'border-border flex flex-col gap-5 rounded-xl border p-6',
                plan.highlight && 'border-foreground/40 bg-muted/30',
              )}
            >
              <div className="flex flex-col gap-1">
                <h2 className="font-medium">{plan.name}</h2>
                <p className="flex items-baseline gap-2">
                  <span className="text-3xl font-semibold tabular-nums">
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {plan.cadence}
                  </span>
                </p>
                <p className="text-muted-foreground text-sm text-pretty">
                  {plan.summary}
                </p>
              </div>
              <ul className="flex flex-1 flex-col gap-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span aria-hidden className="text-muted-foreground">
                      —
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <form action="/api/checkout" method="post">
                <input type="hidden" name="plan" value={plan.id} />
                <button
                  type="submit"
                  disabled={!plan.available}
                  className={cn(
                    buttonVariants({
                      variant: plan.highlight ? 'default' : 'outline',
                      size: 'lg',
                    }),
                    'w-full',
                  )}
                >
                  {plan.available ? `Get ${plan.name}` : 'Opening soon'}
                </button>
              </form>
            </article>
          ))}
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-medium">What is included</h2>
          <dl className="border-border divide-border divide-y border-y text-sm">
            {INCLUDED.map(([term, detail]) => (
              <div
                key={term}
                className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr]"
              >
                <dt className="font-medium">{term}</dt>
                <dd className="text-muted-foreground">{detail}</dd>
              </div>
            ))}
          </dl>
          <p className="text-muted-foreground text-sm">
            See every surface working in the{' '}
            <Link
              href="/exhibition/promotions"
              className="text-foreground underline underline-offset-4"
            >
              promotions exhibit
            </Link>
            .
          </p>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="font-medium">Questions</h2>
          <div className="border-border divide-border divide-y border-y">
            {FAQ.map(([question, answer]) => (
              <details key={question} className="group py-3">
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-medium marker:content-none">
                  {question}
                  <span
                    aria-hidden
                    className="text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground mt-2 text-sm text-pretty">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
