'use client'

import * as React from 'react'
import Link from 'next/link'
import { io } from 'next/cache'
import { usePathname } from 'next/navigation'
import { track } from '@vercel/analytics/react'

import {
  PromoBar,
  PromotionProvider,
  vercelSink,
  type Promotion,
  type PromotionLinkProps,
  type PromotionMedia,
} from '@/components/promotions'
import { PromoSideCard } from '@/components/promotions/pro'

/**
 * Kitsu's own launch, run on Kitsu's own promotions: what a buyer installs
 * is what announces it here. Records are static, so there is nothing to
 * fetch; dismissals live in the browser, and events go to analytics.
 */
const DAY = 86_400_000
const LAUNCH = Date.UTC(2026, 8, 27)

const TURN: PromotionMedia = {
  src: '/promo-clips/turn.webp',
  alt: 'A page of a book turned by hand, curling as it lifts',
  width: 960,
  height: 600,
  video: {
    sources: [
      { src: '/promo-clips/turn.webm', type: 'video/webm' },
      { src: '/promo-clips/turn.mp4', type: 'video/mp4' },
    ],
  },
}

const RECORDS: Promotion[] = [
  {
    id: 'kitsu-clips',
    state: 'published',
    placement: 'bar',
    eyebrow: 'New in Pro',
    title: 'Silent clips and a feature showcase',
    body: 'Any promotion can play a short clip, paused off screen.',
    cta: { label: 'See them live', href: '/exhibition/promotions' },
    tone: 'neutral',
    include: ['/'],
    exclude: [],
    startsAt: LAUNCH,
    endsAt: LAUNCH + 45 * DAY,
    priority: 60,
    dismiss: { mode: 'days', days: 30 },
    campaign: 'kitsu-clips',
    dismissalVersion: 1,
    revision: 1,
  },
  {
    id: 'kitsu-reader',
    state: 'published',
    placement: 'side',
    eyebrow: 'Book reader',
    title: 'Pages that turn like paper',
    body: 'Curl, ink, search and paper modes, as one shadcn component.',
    media: TURN,
    cta: { label: 'Open the reader', href: '/exhibition/book-reader' },
    tone: 'neutral',
    include: ['/'],
    exclude: [],
    startsAt: LAUNCH,
    endsAt: LAUNCH + 45 * DAY,
    priority: 50,
    dismiss: { mode: 'days', days: 14 },
    campaign: 'kitsu-reader',
    dismissalVersion: 1,
    revision: 1,
  },
]

/** Next's Link, in the shape the promotion surfaces expect. */
function SiteLink({
  href,
  className,
  children,
  onClick,
  target,
  rel,
}: PromotionLinkProps) {
  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      target={target}
      rel={rel}
    >
      {children}
    </Link>
  )
}

/** Same names as before (`promo_click`), so the dashboards carry on. */
const onEvent = vercelSink(track, { prefix: 'promo_' })

/**
 * The site's promotion surfaces. The bar floats at the bottom so it never
 * shifts the page; the side card docks beside a `contentWidth` column.
 *
 * They depend on the clock and the visitor's dismissals, so they stay out
 * of the prerendered shell: `io()` suspends during prerender (Cache
 * Components) and the page itself stays fully static.
 */
export function SitePromotions({
  contentWidth = 768,
}: {
  contentWidth?: number
}) {
  return (
    <React.Suspense fallback={null}>
      <Surfaces contentWidth={contentWidth} />
    </React.Suspense>
  )
}

function Surfaces({ contentWidth }: { contentWidth: number }) {
  React.use(io())
  const pathname = usePathname()
  return (
    <PromotionProvider
      source={RECORDS}
      pathname={pathname}
      onEvent={onEvent}
      linkComponent={SiteLink}
      suppressOn={['/pro/thanks']}
    >
      <PromoBar variant="floating" />
      <PromoSideCard contentWidth={contentWidth} />
    </PromotionProvider>
  )
}
