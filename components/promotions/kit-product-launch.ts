import {
  DAY,
  QUIET_CHECKOUT,
  SAMPLE_PAGES,
  finish,
  record,
  tr,
  type KitOptions,
  type PromotionKit,
} from './promotion-kit'

type LaunchRoutes = {
  home: string
  pricing: string
  docs: string
  changelog: string
  event: string
}

/**
 * A launch week for a software product:
 *
 * - `pill`: "New: team workspaces" above the hero (`announcement` slot).
 * - `bar`: one line per day of the launch, with a countdown to Friday.
 * - `offer`: a toast with a code on pricing and docs, a separate campaign.
 * - `keynote`: a dialog scheduled two days in, with a gallery of the agenda.
 *   It waits for engagement, and the daily budget keeps it from stacking on
 *   the toast.
 */
export function productLaunchKit({
  startsAt = Date.now(),
  id = 'launch',
  routes = {},
  overrides,
  images = SAMPLE_PAGES,
}: KitOptions<LaunchRoutes> = {}): PromotionKit {
  const r: LaunchRoutes = {
    home: '/',
    pricing: '/pricing',
    docs: '/docs',
    changelog: '/changelog',
    event: 'https://example.com/keynote',
    ...routes,
  }
  return {
    slots: ['announcement'],
    provider: {
      suppressOn: QUIET_CHECKOUT,
      dialogEngagement: { delayMs: 12_000, scrollDepth: 0.4 },
    },
    promotions: finish(
      {
        pill: record({
          id: 'pill',
          placement: 'card',
          slot: 'announcement',
          eyebrow: 'New',
          title: 'Team workspaces are here',
          cta: { label: 'Read the changelog', href: r.changelog },
          startsAt: startsAt - DAY,
          endsAt: startsAt + 14 * DAY,
          campaign: 'week',
          translations: tr({
            fr: { eyebrow: 'Nouveau', title: 'Les espaces d’équipe sont là' },
            de: { eyebrow: 'Neu', title: 'Team-Workspaces sind da' },
            ja: { eyebrow: '新機能', title: 'チームワークスペースが登場' },
            hi: { eyebrow: 'नया', title: 'टीम वर्कस्पेस आ गए हैं' },
            ar: { eyebrow: 'جديد', title: 'مساحات عمل الفرق متاحة الآن' },
          }),
        }),
        bar: record({
          id: 'bar',
          placement: 'bar',
          tone: 'brand',
          eyebrow: 'Launch week',
          title: 'Day 3: workspaces for every plan',
          body: 'A new release every day until Friday.',
          cta: { label: 'See what shipped', href: r.changelog },
          startsAt: startsAt - DAY,
          endsAt: startsAt + 4 * DAY,
          priority: 60,
          showCountdown: true,
          campaign: 'week',
          translations: tr({
            fr: {
              eyebrow: 'Semaine de lancement',
              title: 'Jour 3 : des espaces pour chaque forfait',
              body: 'Une nouveauté chaque jour jusqu’à vendredi.',
              ctaLabel: 'Voir les nouveautés',
            },
            de: {
              eyebrow: 'Launch-Woche',
              title: 'Tag 3: Workspaces für jeden Tarif',
              body: 'Jeden Tag ein neues Release bis Freitag.',
              ctaLabel: 'Neuigkeiten ansehen',
            },
            ja: {
              eyebrow: 'ローンチウィーク',
              title: '3日目：全プランにワークスペース',
              body: '金曜まで毎日新しいリリース。',
              ctaLabel: '新機能を見る',
            },
            hi: {
              eyebrow: 'लॉन्च वीक',
              title: 'दिन 3: हर प्लान में वर्कस्पेस',
              body: 'शुक्रवार तक हर दिन एक नई रिलीज़।',
              ctaLabel: 'क्या नया है देखें',
            },
            ar: {
              eyebrow: 'أسبوع الإطلاق',
              title: 'اليوم 3: مساحات عمل لكل الخطط',
              body: 'إصدار جديد كل يوم حتى الجمعة.',
              ctaLabel: 'شاهد الجديد',
            },
          }),
        }),
        offer: record({
          id: 'offer',
          placement: 'toast',
          tone: 'brand',
          eyebrow: 'Launch offer',
          title: '20% off annual plans this week',
          body: 'Applies to every seat, renewals included.',
          code: 'ANNUAL20',
          cta: { label: 'Upgrade', href: r.pricing },
          include: [r.pricing, r.docs],
          startsAt: startsAt - DAY,
          endsAt: startsAt + 4 * DAY,
          priority: 70,
          showCountdown: true,
          campaign: 'annual',
          translations: tr({
            fr: {
              eyebrow: 'Offre de lancement',
              title: '20 % sur les forfaits annuels',
              body: 'Sur chaque siège, renouvellements compris.',
              ctaLabel: 'Passer à l’annuel',
            },
            de: {
              eyebrow: 'Launch-Angebot',
              title: '20 % auf Jahrestarife',
              body: 'Für jeden Platz, Verlängerungen inklusive.',
              ctaLabel: 'Upgraden',
            },
            ja: {
              eyebrow: 'ローンチ特典',
              title: '年間プランが20%オフ',
              body: '全シート対象、更新も含みます。',
              ctaLabel: 'アップグレード',
            },
            hi: {
              eyebrow: 'लॉन्च ऑफ़र',
              title: 'सालाना प्लान पर 20% छूट',
              body: 'हर सीट पर, नवीनीकरण सहित।',
              ctaLabel: 'अपग्रेड करें',
            },
            ar: {
              eyebrow: 'عرض الإطلاق',
              title: 'خصم 20٪ على الخطط السنوية',
              body: 'على كل مقعد، بما في ذلك التجديد.',
              ctaLabel: 'ترقية',
            },
          }),
        }),
        keynote: record({
          id: 'keynote',
          placement: 'dialog',
          eyebrow: 'Thursday, 17:00',
          title: 'Watch the 3.0 keynote live',
          body: 'Forty minutes, three launches, and a live Q&A with the team.',
          gallery: images,
          cta: {
            label: 'Save my seat',
            href: r.event,
            external: r.event.startsWith('https:'),
          },
          include: [r.pricing, r.changelog],
          startsAt: startsAt + 2 * DAY,
          endsAt: startsAt + 5 * DAY,
          priority: 80,
          dismiss: { mode: 'never-again' },
          campaign: 'keynote',
          translations: tr({
            fr: {
              title: 'Suivez la keynote 3.0 en direct',
              body: 'Quarante minutes, trois lancements et un Q&R en direct.',
              ctaLabel: 'Réserver ma place',
            },
            de: {
              title: 'Die 3.0-Keynote live ansehen',
              body: 'Vierzig Minuten, drei Launches und ein Live-Q&A.',
              ctaLabel: 'Platz sichern',
            },
            ja: {
              title: '3.0 基調講演をライブで',
              body: '40分、3つの発表、ライブQ&A。',
              ctaLabel: '席を確保',
            },
            hi: {
              title: '3.0 कीनोट लाइव देखें',
              body: 'चालीस मिनट, तीन लॉन्च और लाइव प्रश्नोत्तर।',
              ctaLabel: 'मेरी सीट बुक करें',
            },
            ar: {
              title: 'شاهد مؤتمر 3.0 مباشرة',
              body: 'أربعون دقيقة وثلاثة إطلاقات وجلسة أسئلة مباشرة.',
              ctaLabel: 'احجز مقعدي',
            },
          }),
        }),
      },
      { id, overrides },
    ),
  }
}
