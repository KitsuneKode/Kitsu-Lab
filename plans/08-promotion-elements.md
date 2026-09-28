# Promotion Elements

Promotions become a kit of parts, the way shadcn's chat components (June 2026) and AI Elements are: behaviour in a headless core, styled parts you
install one at a time and compose freely, ready-made patterns for real
situations, and a gallery that sells by showing. The look is Coachwork: dark,
automotive blues with a real clear coat.

Tickets continue the roadmap in `07-premium-roadmap.md` (KL-70 onward).

## Principles

1. **Behaviour is not UI.** Like `@shadcn/react`'s `MessageScroller`, the core
   owns scheduling, audiences, arbitration, budgets, A/B, dismissal, previews
   and events, and owns none of the markup.
2. **Every part installs alone** (`npx shadcn add @kitsu/promo-countdown`) and
   works inside any placement, or in your own layout.
3. **Build on shadcn, never beside it.** Parts compose shadcn primitives
   (`button`, `badge`, `item`, `empty`, `field`, `input-group`, `kbd`,
   `progress`, `marker`, `questionnaire`) and depend on proven community items
   through `registryDependencies` (full URLs) instead of copying them.
4. **Two tiers, both good.** Free is a complete kit a team can ship with. Pro
   adds the situations that drive revenue, the tooling, and the finishes.
5. **Honest attention.** Every pattern states its attention level, respects
   the daily budget, reduced motion and keyboard, and never fakes scarcity.

## Layers

### 1. Core (headless, free)

`promotions-core`: `PromotionProvider`, `usePromotion(slot)`, `usePromoState`
(seen, dismissed, snoozed, converted), `Promo.Root` context (binds a record,
reports impression, click, dismiss, convert), stores, analytics sinks, schema.
Today's provider, split so no UI ships with it.

### 2. Parts (styled)

| Part                             | Does                                                    | Tier |
| -------------------------------- | ------------------------------------------------------- | ---- |
| `Promo`                          | Root: binds a campaign, tone, finish, reports events    | Free |
| `PromoMedia`                     | Still or silent clip, the current rules                 | Free |
| `PromoLabel`                     | Eyebrow or "New" badge                                  | Free |
| `PromoTitle`, `PromoDescription` | Typographic slots, balanced and pretty                  | Free |
| `PromoActions`, `PromoAction`    | CTA row; primary, secondary, link                       | Free |
| `PromoDismiss`, `PromoSnooze`    | Close; "remind me tomorrow"                             | Free |
| `PromoCode`                      | Coupon with copy and applied state                      | Free |
| `PromoCountdown`                 | Rolling timer; "ends in 4 days" when far                | Free |
| `PromoMarker`                    | "New since your last visit" divider (shadcn `marker`)   | Free |
| `PromoBeacon`                    | A pulsing dot on a real control, then rests             | Free |
| `PromoPrice`                     | Was, now, per period, savings, currency-aware           | Pro  |
| `PromoMeter`                     | Usage or seats left (honest data only)                  | Pro  |
| `PromoProof`                     | Avatars, rating, a quote, a live count                  | Pro  |
| `PromoFeatures`                  | Checked list, compare row                               | Pro  |
| `PromoCapture`                   | Email or waitlist field with states                     | Pro  |
| `PromoSurvey`                    | One question, via shadcn `questionnaire`                | Pro  |
| `PromoCelebrate`                 | Milestone burst (magicui confetti), reduced-motion safe | Pro  |

### 3. Placements (the attention ladder)

Quiet → loud. Each is a thin composition of parts with a `children` escape hatch.

| Level        | Placements                                  | Tier                     |
| ------------ | ------------------------------------------- | ------------------------ |
| Ambient      | badge dot, `PromoMarker`, pill              | Free                     |
| Inline       | bar, card, inline banner, empty-state promo | Free                     |
| Peripheral   | toast, side card, beacon                    | Free (beacon Pro)        |
| Guided       | tour, spotlight, checklist                  | Pro                      |
| Interruptive | dialog, offer sheet, sticky CTA             | Free (sheet, sticky Pro) |
| Immersive    | story, showcase, carousel, changelog, inbox | Pro                      |

### 4. Patterns (situations)

Blocks you install and fill in. Each names its placement, attention level,
events and a recommended cadence.

Free starter (8): launch announcement, feature spotlight, coupon reveal,
maintenance notice, new version available (reload), cookie-free newsletter
capture, changelog "what's new", event reminder.

Pro (24): flash sale with countdown, trial ending, usage limit upgrade (meter),
plan upgrade with price anchor, annual switch, win-back, cart recovery,
checkout upsell, shipping cutoff, seasonal campaign, referral invite, waitlist,
early access, webinar registration, onboarding checklist, feature discovery
beacon, NPS and one-question survey, milestone celebration, streak nudge,
social proof toast (real counts only), app install, localized pricing, B2B
seat expansion, renewal reminder.

### 5. Finishes (themes)

`coachwork({ finish })` ships as registry `cssVars` plus a promotion theme:
Midnight Sapphire (matte), Portimao Metallic, Gentian Satin. Clear coat is a
top highlight, a gloss band and one hover sheen; flake is a cached noise tile.
Free gets the tokens and one finish; Pro gets all finishes and the sheen.
Studied at https://claude.ai/artifact/Jnb5ZGkzBjgjm6Seb2q8LG.

Type: a wide display face for plates, prices and timers (Michroma or a
licensed equivalent), a calm sans for reading (Figtree, available as
`@shadcn/font-figtree`).

## What we take from the ecosystem

| Need                                                                       | Source                                | How                         |
| -------------------------------------------------------------------------- | ------------------------------------- | --------------------------- |
| Chat-style inbox, markers                                                  | `@shadcn/marker`, `bubble`, `message` | Compose                     |
| One-question surveys                                                       | `@shadcn/questionnaire`               | Compose                     |
| Shimmer, scroll edge fades                                                 | `shadcn/tailwind.css` utilities       | Use                         |
| Announcement, banner, ticker, marquee, stories, deck, rating, avatar stack | `@kibo-ui`                            | Depend (URL) or reference   |
| Border beam, shine, confetti, number ticker, animated list                 | `@magicui`                            | Depend, Pro accents only    |
| Usage meters, trial expiry, limited-offer dialog, pricing tables           | `@billingsdk`                         | Reference for SaaS patterns |
| Streaks, achievements                                                      | `@trophy-ui`                          | Reference for celebration   |
| Same campaign as an email                                                  | `@emailcn` (MJML coupons, CTAs)       | Pro: campaign → email       |
| Campaign OG images                                                         | `@ogimagecn`                          | Pro: share cards            |
| Clips from campaign data                                                   | `@remocn` / Remotion                  | Later                       |
| Fonts                                                                      | `@shadcn/font-*`                      | Install                     |

Licences are checked per item before depending on it; anything not MIT or
compatible is referenced, not shipped.

## Gallery (the exhibit)

The promotions exhibit becomes a gallery like shadcn blocks: browse by
situation or by attention level, see each pattern live inside a better mock
site in the Coachwork finish, switch finish and device, then Preview, Code or
Install. The simulator, editor and results move to a side drawer. The
homepage and /pro show the gallery's best pieces instead of text rows.

## Build order (stacked PRs)

| PR  | Scope                                                                                                           | Tickets             |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------- |
| 16  | Coachwork tokens and finishes; core split; free parts extracted from today's surfaces, surfaces rebuilt on them | KL-70, KL-71, KL-72 |
| 17  | New parts (price, meter, proof, features, capture, survey, celebrate, marker, beacon)                           | KL-73               |
| 18  | Free starter patterns and the first 12 Pro patterns                                                             | KL-74               |
| 19  | Gallery exhibit, homepage and /pro redesign in Coachwork                                                        | KL-75               |
| 20  | Remaining Pro patterns, email and OG parity                                                                     | KL-76, KL-77        |

Each PR keeps the gates from #15: axe, reduced motion, visual baselines,
bundle budgets.

## Decisions still open

- Wide display face: Michroma (free, Google) or a licensed automotive face.
- Which finish is the default for the site itself.
- Whether free users get the sheen (currently Pro).
