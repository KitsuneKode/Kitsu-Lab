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
    slots: ['announcement', 'share'],
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
          presentation: 'split',
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
        whatsnew: record({
          id: 'whatsnew',
          placement: 'dialog',
          presentation: 'story',
          eyebrow: 'What’s new in 3.0',
          title: 'Three things that change how your team plans',
          gallery: images,
          cta: { label: 'Try workspaces', href: r.changelog },
          startsAt: startsAt - DAY,
          endsAt: startsAt + 30 * DAY,
          priority: 20,
          // A story only opens on request, so it never needs dismissing.
          dismiss: { mode: 'session', scope: 'tab' },
          campaign: 'whatsnew',
          translations: tr({
            fr: {
              eyebrow: 'Nouveautés 3.0',
              title: 'Trois changements pour mieux planifier',
              ctaLabel: 'Essayer',
            },
            de: {
              eyebrow: 'Neu in 3.0',
              title: 'Drei Dinge, die die Planung verändern',
              ctaLabel: 'Ausprobieren',
            },
            ja: {
              eyebrow: '3.0 の新機能',
              title: 'チームの計画を変える3つの新機能',
              ctaLabel: '試してみる',
            },
            hi: {
              eyebrow: '3.0 में नया',
              title: 'तीन बदलाव जो योजना बदल देंगे',
              ctaLabel: 'आज़माएँ',
            },
            ar: {
              eyebrow: 'الجديد في 3.0',
              title: 'ثلاثة أشياء تغيّر طريقة تخطيط فريقك',
              ctaLabel: 'جرّبها',
            },
          }),
        }),
        share: record({
          id: 'share',
          placement: 'spotlight',
          slot: 'share',
          eyebrow: 'New',
          title: 'Share a workspace with one link',
          body: 'Guests can view and comment without an account.',
          startsAt: startsAt - DAY,
          endsAt: startsAt + 21 * DAY,
          priority: 55,
          dismiss: { mode: 'never-again' },
          campaign: 'share',
          translations: tr({
            fr: {
              eyebrow: 'Nouveau',
              title: 'Partagez un espace avec un seul lien',
              body: 'Les invités peuvent lire et commenter sans compte.',
            },
            de: {
              eyebrow: 'Neu',
              title: 'Workspace mit einem Link teilen',
              body: 'Gäste können ohne Konto lesen und kommentieren.',
            },
            ja: {
              eyebrow: '新機能',
              title: 'リンク1つでワークスペースを共有',
              body: 'ゲストはアカウントなしで閲覧・コメントできます。',
            },
            hi: {
              eyebrow: 'नया',
              title: 'एक लिंक से वर्कस्पेस शेयर करें',
              body: 'मेहमान बिना खाते के देख और टिप्पणी कर सकते हैं।',
            },
            ar: {
              eyebrow: 'جديد',
              title: 'شارك مساحة عمل برابط واحد',
              body: 'يمكن للضيوف العرض والتعليق دون حساب.',
            },
          }),
        }),
        status: record({
          id: 'status',
          placement: 'side',
          tone: 'brand',
          eyebrow: 'Launch week · day 3 of 5',
          title: 'Today: workspaces for every plan',
          body: 'Tomorrow: reports. Friday: the keynote and a live Q&A.',
          cta: { label: 'Follow along', href: r.changelog },
          startsAt: startsAt - DAY,
          endsAt: startsAt + 4 * DAY,
          showCountdown: true,
          campaign: 'week',
          translations: tr({
            fr: {
              eyebrow: 'Semaine de lancement · jour 3 sur 5',
              title: 'Aujourd’hui : des espaces pour chaque forfait',
              ctaLabel: 'Suivre',
            },
            de: {
              eyebrow: 'Launch-Woche · Tag 3 von 5',
              title: 'Heute: Workspaces für jeden Tarif',
              ctaLabel: 'Mitverfolgen',
            },
            ja: {
              eyebrow: 'ローンチウィーク · 5日中3日目',
              title: '本日：全プランにワークスペース',
              ctaLabel: 'フォローする',
            },
            hi: {
              eyebrow: 'लॉन्च वीक · 5 में से दिन 3',
              title: 'आज: हर प्लान में वर्कस्पेस',
              ctaLabel: 'साथ चलें',
            },
            ar: {
              eyebrow: 'أسبوع الإطلاق · اليوم 3 من 5',
              title: 'اليوم: مساحات عمل لكل الخطط',
              ctaLabel: 'تابع',
            },
          }),
        }),
      },
      { id, overrides },
    ),
  }
}
