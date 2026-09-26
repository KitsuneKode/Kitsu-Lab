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

type CourseRoutes = {
  home: string
  courses: string
  course: string
  scholarships: string
}

/**
 * Enrolment for a cohort-based course:
 *
 * - `pill`: "Applications are open" above the hero.
 * - `early-bird`: a toast with a code on course pages, with a countdown.
 * - `sticky`: the price and an Enrol button for `<PromoStickyCta>`, shown
 *   only after the pricing card has scrolled away.
 * - `scholarships`: a dialog two days in, with sample pages from the course.
 */
export function courseEnrolmentKit({
  startsAt = Date.now(),
  id = 'cohort',
  routes = {},
  overrides,
  images = SAMPLE_PAGES,
}: KitOptions<CourseRoutes> = {}): PromotionKit {
  const r: CourseRoutes = {
    home: '/',
    courses: '/courses',
    course: '/courses/design-systems',
    scholarships: '/scholarships',
    ...routes,
  }
  return {
    slots: ['announcement', 'sticky'],
    provider: {
      suppressOn: QUIET_CHECKOUT,
      dialogEngagement: { delayMs: 15_000, scrollDepth: 0.5 },
    },
    promotions: finish(
      {
        pill: record({
          id: 'pill',
          placement: 'card',
          slot: 'announcement',
          eyebrow: 'Autumn',
          title: 'Applications for the autumn cohort are open',
          cta: { label: 'Apply', href: r.course },
          startsAt: startsAt - DAY,
          endsAt: startsAt + 20 * DAY,
          campaign: 'autumn',
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
        'early-bird': record({
          id: 'early-bird',
          placement: 'toast',
          tone: 'brand',
          eyebrow: 'Early bird',
          title: '€80 off if you enrol by Friday',
          body: 'Seats are capped at 40 per cohort.',
          code: 'EARLYBIRD',
          cta: { label: 'Enrol', href: r.course },
          include: [`${r.courses}/**`],
          startsAt: startsAt - DAY,
          endsAt: startsAt + 4 * DAY,
          priority: 70,
          showCountdown: true,
          campaign: 'early-bird',
          translations: tr({
            fr: {
              eyebrow: 'Inscription anticipée',
              title: '80 € de réduction avant vendredi',
              body: 'Places limitées à 40 par cohorte.',
              ctaLabel: 'S’inscrire',
            },
            de: {
              eyebrow: 'Frühbucher',
              title: '80 € Rabatt bei Anmeldung bis Freitag',
              body: 'Maximal 40 Plätze pro Kurs.',
              ctaLabel: 'Anmelden',
            },
            ja: {
              eyebrow: '早期割引',
              title: '金曜までの申込で80ユーロ割引',
              body: '各コホート定員40名。',
              ctaLabel: '申し込む',
            },
            hi: {
              eyebrow: 'अर्ली बर्ड',
              title: 'शुक्रवार तक नामांकन पर €80 की छूट',
              body: 'हर कोहॉर्ट में 40 सीटें।',
              ctaLabel: 'नामांकन करें',
            },
            ar: {
              eyebrow: 'حجز مبكر',
              title: 'خصم 80 يورو عند التسجيل قبل الجمعة',
              body: 'المقاعد محدودة بـ 40 لكل دفعة.',
              ctaLabel: 'سجّل الآن',
            },
          }),
        }),
        sticky: record({
          id: 'sticky',
          placement: 'card',
          slot: 'sticky',
          title: 'Autumn cohort · €480',
          cta: { label: 'Enrol', href: r.course },
          include: [`${r.courses}/*`],
          startsAt: startsAt - DAY,
          endsAt: startsAt + 30 * DAY,
          translations: tr({
            fr: { title: 'Cohorte d’automne · 480 €', ctaLabel: 'S’inscrire' },
            de: { title: 'Herbstkurs · 480 €', ctaLabel: 'Anmelden' },
            ja: { title: '秋期コホート · €480', ctaLabel: '申し込む' },
            hi: { title: 'शरद कोहॉर्ट · €480', ctaLabel: 'नामांकन करें' },
            ar: { title: 'دفعة الخريف · 480 يورو', ctaLabel: 'سجّل' },
          }),
        }),
        scholarships: record({
          id: 'scholarships',
          placement: 'dialog',
          eyebrow: 'Closes Friday',
          title: 'Scholarship applications close this week',
          body: 'Full and partial places for people changing careers. It takes ten minutes to apply.',
          gallery: images,
          cta: { label: 'Apply for a place', href: r.scholarships },
          include: [`${r.courses}/**`],
          startsAt: startsAt + 2 * DAY,
          endsAt: startsAt + 6 * DAY,
          priority: 80,
          dismiss: { mode: 'never-again' },
          campaign: 'scholarships',
          translations: tr({
            fr: {
              title: 'Les candidatures aux bourses ferment cette semaine',
              body: 'Places complètes et partielles pour les reconversions.',
              ctaLabel: 'Postuler',
            },
            de: {
              title: 'Stipendienbewerbungen enden diese Woche',
              body: 'Volle und teilweise Plätze für Quereinsteiger.',
              ctaLabel: 'Bewerben',
            },
            ja: {
              title: '奨学金の申込は今週締め切り',
              body: 'キャリアチェンジの方に全額・一部の枠。',
              ctaLabel: '応募する',
            },
            hi: {
              title: 'छात्रवृत्ति आवेदन इस सप्ताह बंद',
              body: 'करियर बदलने वालों के लिए पूर्ण और आंशिक सीटें।',
              ctaLabel: 'आवेदन करें',
            },
            ar: {
              title: 'التقديم على المنح يغلق هذا الأسبوع',
              body: 'مقاعد كاملة وجزئية لمن يغيّرون مسارهم.',
              ctaLabel: 'قدّم الآن',
            },
          }),
        }),
        live: record({
          id: 'live',
          placement: 'side',
          tone: 'highlight',
          eyebrow: 'Open class tonight',
          title: 'Sit in on a live class, free',
          body: 'Tuesday 19:00. Watch a review session before you decide.',
          cta: { label: 'Save a seat', href: r.course },
          startsAt: startsAt - DAY,
          endsAt: startsAt + 3 * DAY,
          showCountdown: true,
          campaign: 'open-class',
          translations: tr({
            fr: {
              eyebrow: 'Cours ouvert ce soir',
              title: 'Assistez à un cours en direct, gratuitement',
              ctaLabel: 'Réserver',
            },
            de: {
              eyebrow: 'Offene Stunde heute',
              title: 'Kostenlos an einer Live-Stunde teilnehmen',
              ctaLabel: 'Platz sichern',
            },
            ja: {
              eyebrow: '今夜の公開授業',
              title: 'ライブ授業を無料で見学',
              ctaLabel: '席を予約',
            },
            hi: {
              eyebrow: 'आज रात खुली कक्षा',
              title: 'लाइव कक्षा में मुफ़्त बैठें',
              ctaLabel: 'सीट बुक करें',
            },
            ar: {
              eyebrow: 'حصة مفتوحة الليلة',
              title: 'احضر حصة مباشرة مجانًا',
              ctaLabel: 'احجز مقعدًا',
            },
          }),
        }),
      },
      { id, overrides },
    ),
  }
}
