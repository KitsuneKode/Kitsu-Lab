import type { Promotion, PromotionCopy } from '@/components/promotions'

/**
 * Three generic storefronts for one fictional brand. Every string here is
 * sample copy; nothing refers to a real company or client.
 */

const HOUR = 3_600_000
const DAY = 24 * HOUR

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

type Langs = 'fr' | 'de' | 'ja' | 'hi' | 'ar'
const tr = (copy: Record<Langs, PromotionCopy>) => copy

function record(
  base: Pick<Promotion, 'id' | 'placement' | 'title'> & Partial<Promotion>,
): Promotion {
  return {
    state: 'published',
    tone: 'neutral',
    include: [],
    exclude: [],
    startsAt: 0,
    endsAt: 0,
    priority: 50,
    dismiss: { mode: 'days', days: 3 },
    dismissalVersion: 1,
    revision: 1,
    ...base,
  }
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
      record({
        id: 'workspaces-pill',
        placement: 'card',
        slot: 'announcement',
        eyebrow: 'New',
        title: 'Team workspaces are here',
        cta: { label: 'Read the changelog', href: '/changelog' },
        startsAt: base - DAY,
        endsAt: base + 14 * DAY,
        translations: tr({
          fr: { eyebrow: 'Nouveau', title: 'Les espaces d’équipe sont là' },
          de: { eyebrow: 'Neu', title: 'Team-Workspaces sind da' },
          ja: { eyebrow: '新機能', title: 'チームワークスペースが登場' },
          hi: { eyebrow: 'नया', title: 'टीम वर्कस्पेस आ गए हैं' },
          ar: { eyebrow: 'جديد', title: 'مساحات عمل الفرق متاحة الآن' },
        }),
      }),
      record({
        id: 'launch-week',
        placement: 'bar',
        tone: 'brand',
        eyebrow: 'Launch week',
        title: 'Day 3: workspaces for every plan',
        body: 'A new release every day until Friday.',
        cta: { label: 'See what shipped', href: '/changelog' },
        exclude: ['/checkout'],
        startsAt: base - DAY,
        endsAt: base + 4 * DAY,
        priority: 60,
        showCountdown: true,
        campaign: 'launch-week',
        translations: tr({
          fr: {
            eyebrow: 'Semaine de lancement',
            title: 'Jour 3 : des espaces pour chaque forfait',
            ctaLabel: 'Voir les nouveautés',
          },
          de: {
            eyebrow: 'Launch-Woche',
            title: 'Tag 3: Workspaces für jeden Tarif',
            ctaLabel: 'Neuigkeiten ansehen',
          },
          ja: {
            eyebrow: 'ローンチウィーク',
            title: '3日目：全プランにワークスペース',
            ctaLabel: '新機能を見る',
          },
          hi: {
            eyebrow: 'लॉन्च वीक',
            title: 'दिन 3: हर प्लान में वर्कस्पेस',
            ctaLabel: 'क्या नया है देखें',
          },
          ar: {
            eyebrow: 'أسبوع الإطلاق',
            title: 'اليوم 3: مساحات عمل لكل الخطط',
            ctaLabel: 'شاهد الجديد',
          },
        }),
      }),
      record({
        id: 'annual-toast',
        placement: 'toast',
        tone: 'brand',
        eyebrow: 'Launch offer',
        title: '20% off annual plans this week',
        body: 'Applies to every seat, renewals included.',
        code: 'ANNUAL20',
        cta: { label: 'Upgrade', href: '/pricing' },
        include: ['/pricing', '/docs'],
        startsAt: base - DAY,
        endsAt: base + 4 * DAY,
        priority: 70,
        showCountdown: true,
        campaign: 'annual-20',
        translations: tr({
          fr: {
            eyebrow: 'Offre de lancement',
            title: '20 % sur les forfaits annuels',
            ctaLabel: 'Passer à l’annuel',
          },
          de: {
            eyebrow: 'Launch-Angebot',
            title: '20 % auf Jahrestarife',
            ctaLabel: 'Upgraden',
          },
          ja: {
            eyebrow: 'ローンチ特典',
            title: '年間プランが20%オフ',
            ctaLabel: 'アップグレード',
          },
          hi: {
            eyebrow: 'लॉन्च ऑफ़र',
            title: 'सालाना प्लान पर 20% छूट',
            ctaLabel: 'अपग्रेड करें',
          },
          ar: {
            eyebrow: 'عرض الإطلاق',
            title: 'خصم 20٪ على الخطط السنوية',
            ctaLabel: 'ترقية',
          },
        }),
      }),
      record({
        id: 'keynote-dialog',
        placement: 'dialog',
        eyebrow: 'Thursday, 17:00',
        title: 'Watch the Northwind 3.0 keynote live',
        body: 'Forty minutes, three launches, and a live Q&A with the team.',
        media: {
          src: '/sample-pages/page-2.svg',
          alt: 'A page of keynote notes',
          width: 1600,
          height: 900,
        },
        cta: {
          label: 'Save my seat',
          href: 'https://example.com/keynote',
          external: true,
        },
        include: ['/pricing', '/changelog'],
        startsAt: base + 2 * DAY,
        endsAt: base + 5 * DAY,
        priority: 80,
        dismiss: { mode: 'never-again' },
        translations: tr({
          fr: {
            title: 'Suivez la keynote Northwind 3.0 en direct',
            ctaLabel: 'Réserver ma place',
          },
          de: {
            title: 'Die Northwind-3.0-Keynote live ansehen',
            ctaLabel: 'Platz sichern',
          },
          ja: {
            title: 'Northwind 3.0 基調講演をライブで',
            ctaLabel: '席を確保',
          },
          hi: {
            title: 'Northwind 3.0 कीनोट लाइव देखें',
            ctaLabel: 'मेरी सीट बुक करें',
          },
          ar: {
            title: 'شاهد مؤتمر Northwind 3.0 مباشرة',
            ctaLabel: 'احجز مقعدي',
          },
        }),
      }),
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
    seed: (base) => [
      record({
        id: 'spring-sale',
        placement: 'bar',
        tone: 'brand',
        eyebrow: 'Spring sale',
        title: 'Up to 30% off linen until Sunday',
        cta: { label: 'Shop linen', href: '/shop/linen' },
        exclude: ['/checkout'],
        startsAt: base - DAY,
        endsAt: base + 3 * DAY,
        priority: 60,
        showCountdown: true,
        campaign: 'spring-sale',
        translations: tr({
          fr: {
            eyebrow: 'Soldes de printemps',
            title: 'Jusqu’à −30 % sur le lin jusqu’à dimanche',
            ctaLabel: 'Voir le lin',
          },
          de: {
            eyebrow: 'Frühlingssale',
            title: 'Bis zu 30 % auf Leinen bis Sonntag',
            ctaLabel: 'Leinen ansehen',
          },
          ja: {
            eyebrow: '春のセール',
            title: '日曜までリネンが最大30%オフ',
            ctaLabel: 'リネンを見る',
          },
          hi: {
            eyebrow: 'वसंत सेल',
            title: 'रविवार तक लिनन पर 30% तक छूट',
            ctaLabel: 'लिनन देखें',
          },
          ar: {
            eyebrow: 'تخفيضات الربيع',
            title: 'خصم حتى 30٪ على الكتان حتى الأحد',
            ctaLabel: 'تسوق الكتان',
          },
        }),
      }),
      record({
        id: 'welcome-sheet',
        placement: 'sheet',
        tone: 'brand',
        eyebrow: '15% off',
        title: 'Your first order, 15% lighter',
        body: 'Applies to everything except gift cards. One use per customer.',
        code: 'WELCOME15',
        revealCode: true,
        cta: { label: 'Apply to my cart', href: '/cart?coupon=WELCOME15' },
        exclude: ['/checkout'],
        startsAt: base - DAY,
        endsAt: base + 30 * DAY,
        dismiss: { mode: 'days', days: 14 },
        campaign: 'welcome-15',
        translations: tr({
          fr: {
            eyebrow: '−15 %',
            title: 'Votre première commande, 15 % plus légère',
            ctaLabel: 'Appliquer au panier',
          },
          de: {
            eyebrow: '15 % Rabatt',
            title: 'Ihre erste Bestellung, 15 % günstiger',
            ctaLabel: 'Im Warenkorb anwenden',
          },
          ja: {
            eyebrow: '15%オフ',
            title: '初回注文が15%オフ',
            ctaLabel: 'カートに適用',
          },
          hi: {
            eyebrow: '15% छूट',
            title: 'आपका पहला ऑर्डर, 15% सस्ता',
            ctaLabel: 'कार्ट पर लागू करें',
          },
          ar: {
            eyebrow: 'خصم 15٪',
            title: 'طلبك الأول بخصم 15٪',
            ctaLabel: 'طبّق على سلتي',
          },
        }),
      }),
      record({
        id: 'repair-card',
        placement: 'card',
        slot: 'hero',
        tone: 'highlight',
        eyebrow: 'Repair week',
        title: 'Bring any Northwind piece in for a free repair',
        body: 'Buttons, seams and elbows, fixed while you wait at every store.',
        cta: { label: 'Find a store', href: '/shop' },
        include: ['/', '/shop'],
        startsAt: base - 2 * DAY,
        endsAt: base + 12 * DAY,
        dismiss: { mode: 'session' },
        translations: tr({
          fr: { title: 'Réparation gratuite de toute pièce Northwind' },
          de: { title: 'Kostenlose Reparatur für jedes Northwind-Teil' },
          ja: { title: 'Northwind製品の修理が無料' },
          hi: { title: 'किसी भी Northwind पीस की मुफ़्त मरम्मत' },
          ar: { title: 'إصلاح مجاني لأي قطعة من Northwind' },
        }),
      }),
    ],
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
    seed: (base) => [
      record({
        id: 'cohort-pill',
        placement: 'card',
        slot: 'announcement',
        eyebrow: 'Autumn',
        title: 'Applications for the autumn cohort are open',
        cta: { label: 'Apply', href: '/courses/design-systems' },
        startsAt: base - DAY,
        endsAt: base + 20 * DAY,
        translations: tr({
          fr: {
            eyebrow: 'Automne',
            title: 'Les candidatures pour l’automne sont ouvertes',
          },
          de: {
            eyebrow: 'Herbst',
            title: 'Bewerbungen für den Herbstkurs sind offen',
          },
          ja: { eyebrow: '秋期', title: '秋期コホートの募集を開始しました' },
          hi: { eyebrow: 'शरद', title: 'शरद कोहॉर्ट के लिए आवेदन खुले हैं' },
          ar: { eyebrow: 'الخريف', title: 'التقديم لدفعة الخريف مفتوح الآن' },
        }),
      }),
      record({
        id: 'early-bird',
        placement: 'toast',
        tone: 'brand',
        eyebrow: 'Early bird',
        title: '€80 off if you enrol by Friday',
        body: 'Seats are capped at 40 per cohort.',
        code: 'EARLYBIRD',
        cta: { label: 'Enrol', href: '/courses/design-systems' },
        include: ['/courses/**'],
        startsAt: base - DAY,
        endsAt: base + 4 * DAY,
        priority: 70,
        showCountdown: true,
        campaign: 'early-bird',
        translations: tr({
          fr: {
            eyebrow: 'Inscription anticipée',
            title: '80 € de réduction avant vendredi',
            ctaLabel: 'S’inscrire',
          },
          de: {
            eyebrow: 'Frühbucher',
            title: '80 € Rabatt bei Anmeldung bis Freitag',
            ctaLabel: 'Anmelden',
          },
          ja: {
            eyebrow: '早期割引',
            title: '金曜までの申込で80ユーロ割引',
            ctaLabel: '申し込む',
          },
          hi: {
            eyebrow: 'अर्ली बर्ड',
            title: 'शुक्रवार तक नामांकन पर €80 की छूट',
            ctaLabel: 'नामांकन करें',
          },
          ar: {
            eyebrow: 'حجز مبكر',
            title: 'خصم 80 يورو عند التسجيل قبل الجمعة',
            ctaLabel: 'سجّل الآن',
          },
        }),
      }),
      record({
        id: 'sticky-enrol',
        placement: 'card',
        slot: 'sticky',
        title: 'Autumn cohort · €480',
        cta: { label: 'Enrol', href: '/courses/design-systems' },
        include: ['/courses/*'],
        startsAt: base - DAY,
        endsAt: base + 30 * DAY,
        translations: tr({
          fr: { title: 'Cohorte d’automne · 480 €', ctaLabel: 'S’inscrire' },
          de: { title: 'Herbstkurs · 480 €', ctaLabel: 'Anmelden' },
          ja: { title: '秋期コホート · €480', ctaLabel: '申し込む' },
          hi: { title: 'शरद कोहॉर्ट · €480', ctaLabel: 'नामांकन करें' },
          ar: { title: 'دفعة الخريف · 480 يورو', ctaLabel: 'سجّل' },
        }),
      }),
      record({
        id: 'scholarship-dialog',
        placement: 'dialog',
        eyebrow: 'Closes Friday',
        title: 'Scholarship applications close this week',
        body: 'Full and partial places for people changing careers. It takes ten minutes to apply.',
        cta: { label: 'Apply for a place', href: '/scholarships' },
        include: ['/courses/**'],
        startsAt: base + 2 * DAY,
        endsAt: base + 6 * DAY,
        priority: 80,
        dismiss: { mode: 'never-again' },
        translations: tr({
          fr: {
            title: 'Les candidatures aux bourses ferment cette semaine',
            ctaLabel: 'Postuler',
          },
          de: {
            title: 'Stipendienbewerbungen enden diese Woche',
            ctaLabel: 'Bewerben',
          },
          ja: { title: '奨学金の申込は今週締め切り', ctaLabel: '応募する' },
          hi: { title: 'छात्रवृत्ति आवेदन इस सप्ताह बंद', ctaLabel: 'आवेदन करें' },
          ar: {
            title: 'التقديم على المنح يغلق هذا الأسبوع',
            ctaLabel: 'قدّم الآن',
          },
        }),
      }),
    ],
  },
} satisfies Record<string, Scenario>

export type ScenarioId = keyof typeof SCENARIOS
