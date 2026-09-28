/**
 * Pro add-ons (`@kitsu-pro/promotions-pro`). Each one builds on the free core
 * in `./index` and nothing else, so they can be installed one at a time.
 */
export { PromoPill } from './promo-pill'
export { PromoProgress } from './promo-progress'
export { PromoSheet } from './promo-sheet'
export { PromoStickyCta } from './promo-sticky-cta'
export { PromoCarousel } from './promo-carousel'
export { PromoShowcase, Showcase, type ShowcaseChapter } from './promo-showcase'
export { PromoInbox } from './promo-inbox'
export { PromoChangelog } from './promo-changelog'
export { PromoSideCard } from './promo-side-card'
export { PromoSpotlight } from './promo-spotlight'
export { PromoStory, type PromoStoryProps } from './promo-story'
export { CampaignTimeline } from './campaign-timeline'
export * from './promotion-kit'
export { courseEnrolmentKit } from './kit-course-enrolment'
export { productLaunchKit } from './kit-product-launch'
export { storeSaleKit } from './kit-store-sale'
export {
  accountDismissalStore,
  fetchAccountTransport,
  type AccountStore,
  type AccountTransport,
} from './promotion-account-store'
export { PromoPreviewNotice } from './promo-preview-notice'
export {
  PREVIEW_PARAM,
  PREVIEW_TTL_MS,
  createPreviewToken,
  verifyPreviewToken,
  type PreviewClaim,
} from './promotion-preview-token'
export { CampaignResults } from './campaign-results'
export {
  campaignStats,
  compare,
  wilson,
  type ArmStats,
  type Comparison,
  type Metric,
  type RecordStats,
  type Verdict,
} from './campaign-stats'
