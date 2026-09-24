# Promotions v3: a generic, sellable system

**Date:** 24 September 2026
**Builds on:** `2026-09-22-promotions-design.md`, `2026-09-24-promotions-review.md`

## Principle

Kitsu ships a generic system. No client's links, copy, routes, zone or
language belong here. A client project installs `@kitsu/promotions` and keeps
one add-on file of its own:

```ts
// in the client repo, e.g. lib/promotions.ts
export const clientPromotions = {
  targets: [...],          // its CTA destinations, including messaging links
  labels: myLabels,        // its languages, built with createPromotionLabels
  timeZone: 'Asia/Kolkata',
  plugins: [excludeCampaigns(() => purchasedCampaigns())],
}
```

## Decisions

| Question               | Decision                                                                                                                                                                                                                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Toast and bar together | Allowed when the floating surface outranks the bar; `allowBarWithFloating={false}` turns it off                                                                                                                                     |
| Client-specific needs  | Never in Kitsu. One add-on file in the client repo                                                                                                                                                                                  |
| "Once per visit"       | Replaced. Each toast or dialog shows at most once per `frequency.hours` (default 24), and the provider spends at most one floating surface per `floatingBudgetHours` (default 24) across every campaign                             |
| Exit intent            | `exitIntent()` plugin, opt-in, desktop pointers only, after a minimum dwell; frequency and budget still apply                                                                                                                       |
| Where dismissals live  | Per promotion: `dismiss.scope` is `tab`, `browser`, `cookie` or `account`. `composeStores` routes each scope to a store; `cookieDismissalStore` and `readPromotionCookies` let a server render an inline bar without a layout shift |
| Languages              | `promotionLabels` packs for en, fr, de, ja, hi and ar (right to left), built on `Intl.RelativeTimeFormat`; `translations` on records; `locale` on the provider                                                                      |

## Pieces

- **Core** (`promotion.ts`): rules, parse, `frequencyAllows`, `dismissScope`,
  `localizePromotion`, a `sheet` placement, `revealCode`.
- **Provider**: `plugins`, `floatingBudgetHours`, `allowBarWithFloating`,
  `locale`, a `reveal` event.
- **Stores** (`promotion-stores.ts`): browser, cookie, memory, compose.
- **Plugins** (`promotion-plugins.ts`): `exitIntent`, `idle`,
  `excludeCampaigns`. A plugin is `{ name, allow?, setup?, onEvent? }`.
- **Labels** (`promotion-labels.ts`): six packs, `createPromotionLabels`,
  `isRightToLeft`.
- **Surfaces**: bar, card, toast, dialog, badge, plus `PromoPill`
  (announcement pill), `PromoSheet` (edge tab and offer sheet),
  `PromoProgress` (progress to a reward), `PromoStickyCta` (appears after
  the pricing card scrolls away), and a revealable `PromoCode`.

## Free and pro

Everything above is in the public registry for now. The planned split: core
and the five original surfaces stay free; the newer surfaces, plugins, cookie
and account stores, and scenario kits move to an authenticated `@kitsu-pro`
namespace (shadcn registry `headers` with a bearer token).
