import type { Promotion, PromotionMedia } from '@/components/promotions'
import {
  courseEnrolmentKit,
  productLaunchKit,
  storeSaleKit,
} from '@/components/promotions/pro'

const HOUR = 3_600_000

/**
 * Clips recorded from the real reader by scripts/record-promo-clips.mjs:
 * a still (also the poster) plus WebM and MP4, 16:10.
 */
function clip(name: string, alt: string, caption?: string): PromotionMedia {
  return {
    src: `/promo-clips/${name}.webp`,
    alt,
    width: 960,
    height: 600,
    ...(caption ? { caption } : {}),
    video: {
      sources: [
        { src: `/promo-clips/${name}.webm`, type: 'video/webm' },
        { src: `/promo-clips/${name}.mp4`, type: 'video/mp4' },
      ],
    },
  }
}

const TURN = clip(
  'turn',
  'Two pages of a book turned by hand, each curling as it lifts',
  'Pages turn under your hand, like paper.',
)
const INK = clip(
  'ink',
  'A yellow marker line, a red underline and a blue loop drawn on a book page',
  'Mark any page with a pen or a marker.',
)
const PAPER = clip(
  'paper',
  'The same page moving from sepia to dusk to night',
  'Paper that suits the light.',
)

const SEARCH = clip(
  'search',
  'A search for “owl” narrowing a book to two pages, then opening one',
  'Type a word; the book narrows to its pages.',
)

/** The still alone, for places where a clip would compete with the page. */
const still = ({ video: _video, ...media }: PromotionMedia): PromotionMedia =>
  media

/** A chapter of the launch's showcase, in the `showcase` card slot. */
function chapter(
  base: number,
  /** Chapters show highest priority first. */
  priority: number,
  id: string,
  label: string,
  title: string,
  body: string,
  media: PromotionMedia,
): Promotion {
  return {
    id: `showcase-${id}`,
    state: 'published',
    placement: 'card',
    slot: 'showcase',
    eyebrow: label,
    title,
    body,
    media,
    cta: { label: 'Read the changelog', href: '/changelog' },
    tone: 'neutral',
    include: ['/', '/pricing', '/changelog'],
    exclude: [],
    startsAt: base - 24 * HOUR,
    endsAt: base + 30 * 24 * HOUR,
    priority,
    dismiss: { mode: 'session', scope: 'tab' },
    campaign: 'launch-week',
    dismissalVersion: 1,
    revision: 1,
  }
}

/** Product shots for the store; the kit itself ships no images. */
const SWATCHES: PromotionMedia[] = (
  [
    ['sand', 'Sand'],
    ['sage', 'Sage'],
    ['ink', 'Ink'],
    ['clay', 'Clay'],
  ] as const
).map(([file, colour]) => ({
  src: `/promo-samples/linen-${file}.svg`,
  alt: `${colour} linen overshirt`,
  width: 1600,
  height: 900,
}))

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
  /** The page's own product visual, beside the hero copy. */
  hero: PromotionMedia
  /** Features; the first leads with its picture. */
  tiles: { title: string; body: string; media?: PromotionMedia }[]
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
        heading: 'A library your whole team reads from.',
        lede: 'Northwind keeps your team’s books and PDFs, with notes everyone can see.',
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
      {
        title: 'Shelves',
        body: 'Books and PDFs, one shelf per team, in the reading mode each person likes.',
        media: still(PAPER),
      },
      { title: 'Notes', body: 'Highlights and ink everyone can see.' },
      { title: 'Reading modes', body: 'Curl, spread or scroll, as you like.' },
    ],
    // A still: the showcase below carries the motion, one focal point at a time.
    hero: still(TURN),
    targets: [
      { value: '/pricing', label: 'Pricing' },
      { value: '/changelog', label: 'Changelog' },
      { value: 'https://example.com/keynote', label: 'Keynote (external)' },
    ],
    seed: (base) => [
      ...productLaunchKit({
        startsAt: base,
        images: [TURN, INK, PAPER],
        overrides: {
          pill: {
            title: 'Ink on any page is here',
            translations: {
              fr: {
                eyebrow: 'Nouveau',
                title: 'L’encre arrive sur chaque page',
              },
              de: { eyebrow: 'Neu', title: 'Tinte auf jeder Seite ist da' },
              ja: { eyebrow: '新機能', title: 'どのページにも書き込めます' },
              hi: { eyebrow: 'नया', title: 'अब हर पन्ने पर स्याही' },
              ar: { eyebrow: 'جديد', title: 'الحبر متاح الآن على كل صفحة' },
            },
          },
          bar: {
            title: 'Day 3: ink on any page',
            translations: {
              fr: {
                eyebrow: 'Semaine de lancement',
                title: 'Jour 3 : l’encre sur chaque page',
                body: 'Une nouveauté chaque jour jusqu’à vendredi.',
              },
              de: {
                eyebrow: 'Launch-Woche',
                title: 'Tag 3: Tinte auf jeder Seite',
                body: 'Jeden Tag ein neues Release bis Freitag.',
              },
              ja: {
                eyebrow: 'ローンチウィーク',
                title: '3日目：どのページにも書き込み',
                body: '金曜まで毎日新しいリリース。',
              },
              hi: {
                eyebrow: 'लॉन्च वीक',
                title: 'दिन 3: हर पन्ने पर स्याही',
                body: 'शुक्रवार तक हर दिन एक नई रिलीज़।',
              },
              ar: {
                eyebrow: 'أسبوع الإطلاق',
                title: 'اليوم 3: الحبر على كل صفحة',
                body: 'إصدار جديد كل يوم حتى الجمعة.',
              },
            },
          },
          keynote: { gallery: [TURN] },
          whatsnew: {
            title: 'Three things that change how your team reads',
            translations: {
              fr: {
                eyebrow: 'Nouveautés 3.0',
                title: 'Trois nouveautés qui changent votre façon de lire',
              },
              de: {
                eyebrow: 'Neu in 3.0',
                title: 'Drei Dinge, die das Lesen im Team verändern',
              },
              ja: {
                eyebrow: '3.0 の新機能',
                title: 'チームの読み方を変える3つの新機能',
              },
              hi: {
                eyebrow: '3.0 में नया',
                title: 'तीन बदलाव जो आपकी टीम के पढ़ने का तरीका बदल दें',
              },
              ar: {
                eyebrow: 'الجديد في 3.0',
                title: 'ثلاثة أشياء تغيّر طريقة قراءة فريقك',
              },
            },
          },
          status: {
            title: 'Today: ink on any page',
            body: 'Tomorrow: paper modes. Friday: the keynote and a live Q&A.',
            media: INK,
            translations: {
              fr: {
                eyebrow: 'Semaine de lancement · jour 3 sur 5',
                title: 'Aujourd’hui : l’encre sur chaque page',
                ctaLabel: 'Suivre',
              },
              de: {
                eyebrow: 'Launch-Woche · Tag 3 von 5',
                title: 'Heute: Tinte auf jeder Seite',
                ctaLabel: 'Mitverfolgen',
              },
              ja: {
                eyebrow: 'ローンチウィーク · 5日中3日目',
                title: '本日：どのページにも書き込み',
                ctaLabel: 'フォローする',
              },
              hi: {
                eyebrow: 'लॉन्च वीक · 5 में से दिन 3',
                title: 'आज: हर पन्ने पर स्याही',
                ctaLabel: 'साथ चलें',
              },
              ar: {
                eyebrow: 'أسبوع الإطلاق · اليوم 3 من 5',
                title: 'اليوم: الحبر على كل صفحة',
                ctaLabel: 'تابع',
              },
            },
          },
          // An A/B test: the event log shows which arm this visitor got.
          offer: {
            variants: [
              { id: 'control' },
              {
                id: 'urgency',
                title: 'Annual plans: 20% off, ends Sunday',
                ctaLabel: 'Lock in 20%',
              },
            ],
          },
        },
      }).promotions,
      chapter(
        base,
        42,
        'search',
        'Search',
        'Find any word, in any book',
        'Type a word and the book narrows to the pages that have it, one tap away.',
        SEARCH,
      ),
      chapter(
        base,
        41,
        'paper',
        'Paper',
        'Paper that suits the light',
        'Sepia by day, dusk and night after dark, for every book.',
        PAPER,
      ),
      chapter(
        base,
        40,
        'ink',
        'Ink',
        'Write on any page',
        'Pen and marker in five inks, kept with the page on every device.',
        INK,
      ),
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
      {
        title: 'Linen',
        body: 'Cool in summer, soft by autumn, and better with every wash.',
        media: SWATCHES[1],
      },
      { title: 'Repairs', body: 'Free for as long as you own it.' },
      { title: 'Returns', body: '60 days, no questions.' },
    ],
    hero: SWATCHES[0]!,
    targets: [
      { value: '/shop', label: 'Shop' },
      { value: '/shop/linen', label: 'Linen overshirt' },
      { value: '/cart?coupon=WELCOME15', label: 'Cart with WELCOME15 applied' },
    ],
    seed: (base) =>
      storeSaleKit({
        startsAt: base,
        routes: { product: '/shop/linen' },
        images: SWATCHES,
      }).promotions,
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
      {
        title: 'Reviews',
        body: 'Mentors mark up every submission, line by line, within two days.',
        media: still(INK),
      },
      { title: 'Live classes', body: 'Two evenings a week.' },
      { title: 'Community', body: 'Alumni channel for life.' },
    ],
    hero: { ...INK, caption: undefined },
    targets: [
      { value: '/courses/design-systems', label: 'Design systems course' },
      { value: '/scholarships', label: 'Scholarships' },
    ],
    seed: (base) =>
      courseEnrolmentKit({
        startsAt: base,
        images: [{ ...INK, caption: 'Mentors mark up every submission.' }],
      }).promotions,
  },
} satisfies Record<string, Scenario>

export type ScenarioId = keyof typeof SCENARIOS
