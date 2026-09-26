import type { Promotion } from '@/components/promotions'
import {
  courseEnrolmentKit,
  productLaunchKit,
  storeSaleKit,
} from '@/components/promotions/pro'

const HOUR = 3_600_000

/**
 * Three generic storefronts for one fictional brand, each driven by a kit.
 * Every string is sample copy; nothing refers to a real company or client.
 */

export type ScenarioPage = {
  value: string
  label: string
  heading: string
  lede: string
  kind?: 'cart' | 'product'
  priceTitle?: string
  priceNote?: string
  price?: string
}

export type Scenario = {
  label: string
  brand: string
  startPath: string
  nav: { label: string; href: string; dot?: boolean }[]
  pages: ScenarioPage[]
  tiles: { title: string; body: string }[]
  targets: { value: string; label: string }[]
  cartStart?: number
  seed: (base: number) => Promotion[]
}

export const SCENARIOS = {
  launch: {
    label: 'Software launch',
    brand: 'Northwind',
    startPath: '/pricing',
    nav: [
      { label: 'Pricing', href: '/pricing' },
      { label: 'Docs', href: '/docs' },
      { label: 'Changelog', href: '/changelog', dot: true },
    ],
    pages: [
      {
        value: '/',
        label: 'Home',
        heading: 'Plan the week your team actually has.',
        lede: 'Northwind turns scattered requests into one calm queue.',
      },
      {
        value: '/pricing',
        label: 'Pricing',
        heading: 'Simple plans that grow with you.',
        lede: 'Start free, upgrade when your team does.',
      },
      {
        value: '/docs',
        label: 'Docs',
        heading: 'Documentation',
        lede: 'Guides, API reference and recipes.',
      },
      {
        value: '/changelog',
        label: 'Changelog',
        heading: 'What’s new',
        lede: 'Every release, in plain words.',
      },
      {
        value: '/checkout',
        label: 'Checkout',
        heading: 'Checkout stays quiet.',
        lede: 'Suppressed routes never show a bar, toast or dialog.',
      },
    ],
    tiles: [
      { title: 'Queues', body: 'One place for every request.' },
      { title: 'Workspaces', body: 'Separate teams, shared context.' },
      { title: 'Reports', body: 'Weekly summaries, no setup.' },
    ],
    targets: [
      { value: '/pricing', label: 'Pricing' },
      { value: '/changelog', label: 'Changelog' },
      { value: 'https://example.com/keynote', label: 'Keynote (external)' },
    ],
    seed: (base) => [
      ...productLaunchKit({ startsAt: base }).promotions,
      // Opens only when the visitor clicks Upgrade: an offer for that moment.
      {
        id: 'launch-upgrade',
        state: 'published',
        placement: 'dialog',
        eyebrow: 'Before you upgrade',
        title: 'Take 20% off your first year of Team',
        body: 'Launch-week pricing applies to every seat you add this year.',
        code: 'TEAM20',
        cta: { label: 'Upgrade with 20% off', href: '/checkout' },
        tone: 'brand',
        include: ['/pricing'],
        exclude: [],
        startsAt: base - HOUR,
        endsAt: base + 7 * 24 * HOUR,
        priority: 70,
        dismiss: { mode: 'days', days: 3 },
        frequency: { hours: 24 },
        triggers: ['upgrade-intent'],
        campaign: 'launch-week',
        dismissalVersion: 1,
        revision: 1,
      },
    ],
  },

  store: {
    label: 'Store sale',
    brand: 'Northwind Goods',
    startPath: '/shop',
    cartStart: 34,
    nav: [
      { label: 'Shop', href: '/shop' },
      { label: 'Linen', href: '/shop/linen' },
      { label: 'Cart', href: '/cart' },
    ],
    pages: [
      {
        value: '/',
        label: 'Home',
        heading: 'Clothes that outlast the season.',
        lede: 'Natural fibres, repaired for free.',
      },
      {
        value: '/shop',
        label: 'Shop',
        heading: 'The spring edit',
        lede: 'Linen, cotton and wool, made to be worn often.',
      },
      {
        value: '/shop/linen',
        label: 'Product',
        heading: 'Linen overshirt',
        lede: 'Washed linen, horn buttons, three colours.',
      },
      {
        value: '/cart',
        label: 'Cart',
        heading: 'Your cart',
        lede: 'Free shipping from €50.',
        kind: 'cart',
      },
      {
        value: '/checkout',
        label: 'Checkout',
        heading: 'Checkout stays quiet.',
        lede: 'No bar, toast or dialog here.',
      },
    ],
    tiles: [
      { title: 'Linen', body: 'Cool in summer, soft by autumn.' },
      { title: 'Repairs', body: 'Free for as long as you own it.' },
      { title: 'Returns', body: '60 days, no questions.' },
    ],
    targets: [
      { value: '/shop', label: 'Shop' },
      { value: '/shop/linen', label: 'Linen overshirt' },
      { value: '/cart?coupon=WELCOME15', label: 'Cart with WELCOME15 applied' },
    ],
    seed: (base) =>
      storeSaleKit({ startsAt: base, routes: { product: '/shop/linen' } })
        .promotions,
  },

  course: {
    label: 'Course cohort',
    brand: 'Northwind Academy',
    startPath: '/courses/design-systems',
    nav: [
      { label: 'Courses', href: '/courses' },
      { label: 'Design systems', href: '/courses/design-systems' },
      { label: 'Scholarships', href: '/scholarships', dot: true },
    ],
    pages: [
      {
        value: '/',
        label: 'Home',
        heading: 'Learn with a cohort, not alone.',
        lede: 'Live classes, weekly reviews and a group that keeps you going.',
      },
      {
        value: '/courses',
        label: 'Courses',
        heading: 'All courses',
        lede: 'Twelve weeks each, evenings and weekends.',
      },
      {
        value: '/courses/design-systems',
        label: 'A course',
        heading: 'Design systems, in practice',
        lede: 'Build and ship a real system with a team of eight.',
        kind: 'product',
        priceTitle: 'Autumn cohort',
        priceNote: '12 weeks · Tuesdays and Thursdays, 19:00',
        price: '€480',
      },
      {
        value: '/scholarships',
        label: 'Scholarships',
        heading: 'Scholarships',
        lede: 'Full and partial places for every cohort.',
      },
      {
        value: '/checkout',
        label: 'Checkout',
        heading: 'Checkout stays quiet.',
        lede: 'No bar, toast or dialog here.',
      },
    ],
    tiles: [
      { title: 'Live classes', body: 'Two evenings a week.' },
      { title: 'Reviews', body: 'Mentors read every submission.' },
      { title: 'Community', body: 'Alumni channel for life.' },
    ],
    targets: [
      { value: '/courses/design-systems', label: 'Design systems course' },
      { value: '/scholarships', label: 'Scholarships' },
    ],
    seed: (base) => courseEnrolmentKit({ startsAt: base }).promotions,
  },
} satisfies Record<string, Scenario>

export type ScenarioId = keyof typeof SCENARIOS
