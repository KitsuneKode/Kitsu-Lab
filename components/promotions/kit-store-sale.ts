import {
  DAY,
  QUIET_CHECKOUT,
  SAMPLE_SWATCHES,
  finish,
  record,
  tr,
  type KitOptions,
  type PromotionKit,
} from './promotion-kit'

type StoreRoutes = {
  home: string
  shop: string
  product: string
  cart: string
}

/**
 * A store sale that stays polite while several campaigns run at once:
 *
 * - `bar`: the sale itself, with a truthful countdown to its end.
 * - `last-day`: a toast in the same campaign. It never repeats the bar; it
 *   can only appear once the visitor has dismissed the bar.
 * - `welcome`: a first-order code behind an edge tab, revealed on request.
 * - `arrivals` and `repairs`: two cards sharing the `hero` slot, shown as a
 *   carousel, the first with an image gallery.
 * - Free shipping progress is a component, not a record: `<PromoProgress>`.
 */
export function storeSaleKit({
  startsAt = Date.now(),
  id = 'store-sale',
  routes = {},
  overrides,
  images = SAMPLE_SWATCHES,
}: KitOptions<StoreRoutes> = {}): PromotionKit {
  const r: StoreRoutes = {
    home: '/',
    shop: '/shop',
    product: '/shop/linen',
    cart: '/cart',
    ...routes,
  }
  const saleEnds = startsAt + 4 * DAY

  return {
    slots: ['hero'],
    provider: {
      suppressOn: QUIET_CHECKOUT,
      toastEngagement: { delayMs: 6000, scrollDepth: 0.25 },
    },
    promotions: finish(
      {
        bar: record({
          id: 'bar',
          placement: 'bar',
          tone: 'brand',
          eyebrow: 'Spring sale',
          title: 'Up to 30% off linen until Sunday',
          cta: { label: 'Shop linen', href: r.product },
          startsAt: startsAt - DAY,
          endsAt: saleEnds,
          priority: 60,
          showCountdown: true,
          campaign: 'sale',
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
        'last-day': record({
          id: 'last-day',
          placement: 'toast',
          tone: 'brand',
          eyebrow: 'Spring sale',
          title: 'Linen is still 30% off',
          body: 'The sale ends Sunday at midnight. Sizes are going fast in sand.',
          media: images[0],
          cta: { label: 'Shop linen', href: r.product },
          include: [r.shop, `${r.shop}/**`],
          startsAt: startsAt - DAY,
          endsAt: saleEnds,
          priority: 70,
          showCountdown: true,
          campaign: 'sale',
          translations: tr({
            fr: {
              title: 'Le lin est toujours à −30 %',
              ctaLabel: 'Voir le lin',
            },
            de: {
              title: 'Leinen weiterhin 30 % günstiger',
              ctaLabel: 'Leinen ansehen',
            },
            ja: { title: 'リネンはまだ30%オフ', ctaLabel: 'リネンを見る' },
            hi: { title: 'लिनन पर अब भी 30% छूट', ctaLabel: 'लिनन देखें' },
            ar: { title: 'الكتان ما زال بخصم 30٪', ctaLabel: 'تسوق الكتان' },
          }),
        }),
        welcome: record({
          id: 'welcome',
          placement: 'sheet',
          tone: 'brand',
          eyebrow: '15% off',
          title: 'Your first order, 15% lighter',
          body: 'Applies to everything except gift cards. One use per customer.',
          code: 'WELCOME15',
          revealCode: true,
          cta: {
            label: 'Apply to my cart',
            href: `${r.cart}?coupon=WELCOME15`,
          },
          startsAt: startsAt - DAY,
          endsAt: startsAt + 30 * DAY,
          dismiss: { mode: 'days', days: 14 },
          campaign: 'welcome',
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
        arrivals: record({
          id: 'arrivals',
          placement: 'card',
          slot: 'hero',
          eyebrow: 'New in',
          title: 'The linen overshirt, now in four colours',
          body: 'Washed for softness, cut a little longer, finished with horn buttons.',
          gallery: images,
          cta: { label: 'See all colours', href: r.product },
          include: [r.home, r.shop],
          startsAt: startsAt - 2 * DAY,
          endsAt: startsAt + 21 * DAY,
          priority: 60,
          dismiss: { mode: 'session' },
          campaign: 'arrivals',
          translations: tr({
            fr: {
              eyebrow: 'Nouveau',
              title: 'La surchemise en lin, en quatre couleurs',
              ctaLabel: 'Voir les couleurs',
            },
            de: {
              eyebrow: 'Neu',
              title: 'Das Leinen-Overshirt, jetzt in vier Farben',
              ctaLabel: 'Alle Farben',
            },
            ja: {
              eyebrow: '新着',
              title: 'リネンのオーバーシャツに4色が登場',
              ctaLabel: '全色を見る',
            },
            hi: {
              eyebrow: 'नया',
              title: 'लिनन ओवरशर्ट, अब चार रंगों में',
              ctaLabel: 'सभी रंग देखें',
            },
            ar: {
              eyebrow: 'جديد',
              title: 'قميص الكتان الخارجي الآن بأربعة ألوان',
              ctaLabel: 'شاهد كل الألوان',
            },
          }),
        }),
        repairs: record({
          id: 'repairs',
          placement: 'card',
          slot: 'hero',
          tone: 'highlight',
          eyebrow: 'Repair week',
          title: 'Bring any piece in for a free repair',
          body: 'Buttons, seams and elbows, fixed while you wait at every store.',
          cta: { label: 'Find a store', href: r.shop },
          include: [r.home, r.shop],
          startsAt: startsAt - 2 * DAY,
          endsAt: startsAt + 12 * DAY,
          priority: 40,
          dismiss: { mode: 'session' },
          campaign: 'repairs',
          translations: tr({
            fr: {
              eyebrow: 'Semaine réparation',
              title: 'Réparation gratuite de toute pièce',
            },
            de: {
              eyebrow: 'Reparaturwoche',
              title: 'Kostenlose Reparatur für jedes Teil',
            },
            ja: { eyebrow: '修理ウィーク', title: 'どのアイテムも無料で修理' },
            hi: { eyebrow: 'मरम्मत सप्ताह', title: 'किसी भी पीस की मुफ़्त मरम्मत' },
            ar: { eyebrow: 'أسبوع الإصلاح', title: 'إصلاح مجاني لأي قطعة' },
          }),
        }),
        members: record({
          id: 'members',
          placement: 'side',
          eyebrow: 'Members',
          title: 'Free repairs and returns, for life',
          body: 'Join free with your email. Members also get early access to every sale.',
          media: images[2],
          cta: { label: 'Join free', href: r.shop },
          startsAt: startsAt - DAY,
          endsAt: startsAt + 60 * DAY,
          priority: 40,
          dismiss: { mode: 'days', days: 30 },
          // An invitation to join is noise for someone who already has.
          audience: { exclude: ['member'] },
          campaign: 'members',
          translations: tr({
            fr: {
              eyebrow: 'Membres',
              title: 'Réparations et retours gratuits, à vie',
              ctaLabel: 'Rejoindre',
            },
            de: {
              eyebrow: 'Mitglieder',
              title: 'Reparaturen und Rücksendungen, lebenslang gratis',
              ctaLabel: 'Kostenlos beitreten',
            },
            ja: {
              eyebrow: 'メンバー',
              title: '修理と返品がずっと無料',
              ctaLabel: '無料で参加',
            },
            hi: {
              eyebrow: 'सदस्य',
              title: 'जीवन भर मुफ़्त मरम्मत और वापसी',
              ctaLabel: 'मुफ़्त जुड़ें',
            },
            ar: {
              eyebrow: 'الأعضاء',
              title: 'إصلاح وإرجاع مجانيان مدى الحياة',
              ctaLabel: 'انضم مجانًا',
            },
          }),
        }),
      },
      { id, overrides },
    ),
  }
}
