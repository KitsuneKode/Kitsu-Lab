import type { PromotionLabels } from './promotion-provider'

type Words = {
  announcement: string
  dismiss: string
  dismissNamed: (title: string) => string
  notNow: string
  opensInNewTab: string
  /** Wraps a relative time from Intl, e.g. "in 3 days" → "Ends in 3 days". */
  ends: (relative: string) => string
  copyCode: (code: string) => string
  copied: string
  minimize: string
  restore: (title: string) => string
  reveal: string
  openOffer: string
  hideOffer: string
  inboxCount: (count: number) => string
  inboxHidden: string
  gotIt: string
  whatsOn: string
  previous: string
  next: string
}

/**
 * Builds a label pack whose countdown comes from `Intl.RelativeTimeFormat`,
 * so plurals, numerals and word order are right ("tomorrow", "3 日後").
 */
export function createPromotionLabels(
  locale: string,
  words: Words,
): PromotionLabels {
  let format: Intl.RelativeTimeFormat | null = null
  try {
    format = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  } catch {
    format = null
  }
  const { ends, ...rest } = words
  return {
    ...rest,
    endsIn: ({ unit, value }) =>
      ends(format ? format.format(value, unit) : `${value} ${unit}`),
  }
}

export const promotionLabels = {
  en: createPromotionLabels('en', {
    announcement: 'Announcement',
    dismiss: 'Dismiss announcement',
    dismissNamed: (title) => `Dismiss ${title}`,
    notNow: 'Not now',
    opensInNewTab: '(opens in a new tab)',
    ends: (relative) => `Ends ${relative}`,
    copyCode: (code) => `Copy code ${code}`,
    copied: 'Copied',
    minimize: 'Minimise',
    restore: (title) => `Show offer: ${title}`,
    reveal: 'Reveal code',
    openOffer: 'Open offer',
    hideOffer: 'Hide this offer',
    inboxCount: (n) => `${n} offer${n === 1 ? '' : 's'}`,
    inboxHidden: 'Hidden',
    gotIt: 'Got it',
    whatsOn: 'What’s on',
    previous: 'Previous',
    next: 'Next',
  }),
  fr: createPromotionLabels('fr', {
    announcement: 'Annonce',
    dismiss: 'Fermer l’annonce',
    dismissNamed: (title) => `Fermer ${title}`,
    notNow: 'Plus tard',
    opensInNewTab: '(s’ouvre dans un nouvel onglet)',
    ends: (relative) => `Se termine ${relative}`,
    copyCode: (code) => `Copier le code ${code}`,
    copied: 'Copié',
    minimize: 'Réduire',
    restore: (title) => `Voir l’offre : ${title}`,
    reveal: 'Afficher le code',
    openOffer: 'Voir l’offre',
    hideOffer: 'Masquer cette offre',
    inboxCount: (n) => `${n} offre${n > 1 ? 's' : ''}`,
    inboxHidden: 'Masquée',
    gotIt: 'Compris',
    whatsOn: 'En ce moment',
    previous: 'Précédent',
    next: 'Suivant',
  }),
  de: createPromotionLabels('de', {
    announcement: 'Ankündigung',
    dismiss: 'Ankündigung schließen',
    dismissNamed: (title) => `${title} schließen`,
    notNow: 'Später',
    opensInNewTab: '(öffnet in neuem Tab)',
    ends: (relative) => `Endet ${relative}`,
    copyCode: (code) => `Code ${code} kopieren`,
    copied: 'Kopiert',
    minimize: 'Minimieren',
    restore: (title) => `Angebot zeigen: ${title}`,
    reveal: 'Code anzeigen',
    openOffer: 'Angebot öffnen',
    hideOffer: 'Angebot ausblenden',
    inboxCount: (n) => `${n} Angebot${n === 1 ? '' : 'e'}`,
    inboxHidden: 'Ausgeblendet',
    gotIt: 'Verstanden',
    whatsOn: 'Aktuell',
    previous: 'Zurück',
    next: 'Weiter',
  }),
  ja: createPromotionLabels('ja', {
    announcement: 'お知らせ',
    dismiss: 'お知らせを閉じる',
    dismissNamed: (title) => `${title}を閉じる`,
    notNow: '後で',
    opensInNewTab: '（新しいタブで開きます）',
    ends: (relative) => `${relative}に終了`,
    copyCode: (code) => `コード ${code} をコピー`,
    copied: 'コピーしました',
    minimize: '最小化',
    restore: (title) => `オファーを表示: ${title}`,
    reveal: 'コードを表示',
    openOffer: 'オファーを開く',
    hideOffer: 'このオファーを非表示',
    inboxCount: (n) => `${n}件のオファー`,
    inboxHidden: '非表示',
    gotIt: '了解',
    whatsOn: '開催中',
    previous: '前へ',
    next: '次へ',
  }),
  hi: createPromotionLabels('hi', {
    announcement: 'घोषणा',
    dismiss: 'घोषणा बंद करें',
    dismissNamed: (title) => `${title} बंद करें`,
    notNow: 'अभी नहीं',
    opensInNewTab: '(नए टैब में खुलता है)',
    ends: (relative) => `${relative} समाप्त`,
    copyCode: (code) => `कोड ${code} कॉपी करें`,
    copied: 'कॉपी हो गया',
    minimize: 'छोटा करें',
    restore: (title) => `ऑफ़र देखें: ${title}`,
    reveal: 'कोड दिखाएँ',
    openOffer: 'ऑफ़र खोलें',
    hideOffer: 'यह ऑफ़र छिपाएँ',
    inboxCount: (n) => `${n} ऑफ़र`,
    inboxHidden: 'छिपाया गया',
    gotIt: 'समझ गया',
    whatsOn: 'अभी चल रहा है',
    previous: 'पिछला',
    next: 'अगला',
  }),
  ar: createPromotionLabels('ar', {
    announcement: 'إعلان',
    dismiss: 'إغلاق الإعلان',
    dismissNamed: (title) => `إغلاق ${title}`,
    notNow: 'ليس الآن',
    opensInNewTab: '(يفتح في علامة تبويب جديدة)',
    ends: (relative) => `ينتهي ${relative}`,
    copyCode: (code) => `نسخ الرمز ${code}`,
    copied: 'تم النسخ',
    minimize: 'تصغير',
    restore: (title) => `عرض العرض: ${title}`,
    reveal: 'إظهار الرمز',
    openOffer: 'فتح العرض',
    hideOffer: 'إخفاء هذا العرض',
    inboxCount: (n) => (n === 1 ? 'عرض واحد' : n === 2 ? 'عرضان' : `${n} عروض`),
    inboxHidden: 'مخفي',
    gotIt: 'فهمت',
    whatsOn: 'يحدث الآن',
    previous: 'السابق',
    next: 'التالي',
  }),
} satisfies Record<string, PromotionLabels>

export type PromotionLabelLocale = keyof typeof promotionLabels

/** Locales written right to left, so a host can set `dir` on its root. */
export function isRightToLeft(locale: string): boolean {
  return /^(ar|he|fa|ur|ps|yi|dv|ckb)(-|$)/.test(locale)
}
