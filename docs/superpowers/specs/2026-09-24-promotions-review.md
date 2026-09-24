# Promotions — review and refinement (v2)

**Date:** 24 September 2026
**Reviews:** PR #4 (`claude/promotions-and-image-pages`), design in `2026-09-22-promotions-design.md`
**Method:** a line-by-line read of the system, Emil Kowalski's `emil-design-eng`,
`review-animations` and `find-animation-opportunities` skills (vendored in
`.claude/skills/`, MIT), and a Playwright pass over the demo at desktop,
laptop and phone widths.

## What changed

- **New placements.** `toast` (a polite corner card that folds into a chip),
  a `floating` bar variant (docked at the bottom, no layout shift) and
  `PromoBadge` (a "New" pill or dot beside a nav link, driven by any live
  promotion whose button points there).
- **New content.** `code` (a coupon with a copy button) and image fields in
  the editor.
- **Phone dialog.** The bottom sheet is now a Base UI Drawer, so it can be
  swiped away with velocity. It uses the iOS drawer curve.
- **Behaviour.** One floating surface at a time, and each opens at most once
  per visit. Nothing opens while the visitor is typing, in another modal, or
  on a hidden tab. Exit intent is available as an opt-in. `openPromotion(id)`
  opens a surface on request.
- **i18n.** Every string goes through `labels`.

## Bugs and edge cases fixed

| Area       | Problem                                                                                                                                    | Fix                                                                                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Security   | `/\evil.com` passed `defaultIsAllowedHref`; browsers read it as `//evil.com` (an open redirect)                                            | Backslashes and control characters are refused; tests cover it                                                 |
| Provider   | An inline `source={{ load }}` made a new object every render, which re-ran the effect → load → setState → render loop                      | The loader sits in a ref and runs once per mount; `sourceKey` reloads it                                       |
| Provider   | One malformed CMS row (for example a missing `include`) threw inside `targetsRoute`, and the provider is in the root layout                | `isPromotion` / `sanitizePromotions` drop bad rows                                                             |
| Analytics  | A dialog CTA click was reported as `click` **and** `dismiss`, so every conversion also counted as a rejection                              | `complete()` closes the surface without a dismiss event                                                        |
| Analytics  | Impressions fired once per mount, not per page view; a dialog could be "seen" in a background tab                                          | Impressions are keyed by pathname and wait for a visible tab                                                   |
| Layout     | When a dialog outranked the bar, the bar collapsed behind the modal and came back after it closed: two layout shifts                       | The bar never steps aside. Floating surfaces are the only ones arbitrated                                      |
| Time       | The editor's `datetime-local` read the browser's zone while the summary used `timeZone`. A reviewer in UTC scheduling for IST was 5h30 out | `toZonedInput` / `fromZonedInput` convert in the given zone, with DST tests                                    |
| Time       | The clock polled every 60s, so a window opened up to a minute late, and later still after the laptop slept                                 | It sleeps until the next start or end (`nextBoundary`) and re-reads when the tab becomes visible               |
| Dismissal  | `dismissedAt` used `Date.now()` while expiry used the injected clock                                                                       | Both use the injected clock                                                                                    |
| Dismissal  | Dismissing in one tab left the others showing it                                                                                           | `DismissalStore.subscribe`; the browser store listens for `storage` events                                     |
| Dialog     | Could reopen on every page after a back-navigation, chasing the visitor                                                                    | Once per visit. Unanswered means it does not come back until the next session                                  |
| Dialog     | Could open over a half-typed form or another modal                                                                                         | `visitorIsBusy()` holds it. Found in the browser: a focused slider counted as typing, fixed to text entry only |
| a11y       | Focus fell to `<body>` when a focused bar or card was dismissed                                                                            | `moveFocusPast` moves it to the next tabbable element                                                          |
| a11y       | Editor `Label htmlFor` pointed at toggle groups, which cannot be labelled that way, so groups were unnamed                                 | `aria-labelledby`; errors use `role="alert"` and `aria-describedby`                                            |
| a11y / RTL | `right-2`, and the arrow nudged the wrong way in RTL                                                                                       | Logical `end-*` / `ps-*`, a mirrored arrow                                                                     |
| Review     | `reviewPromotion` warned about a record overlapping itself when editing, and ignored routes                                                | `{ id }` option and `routesMayOverlap`                                                                         |
| Editor     | A failed `onSubmit` threw silently; errors only showed after submit                                                                        | Form-level alert, per-field errors on blur                                                                     |
| Editor     | On phones the preview sat under a long form                                                                                                | A sticky Edit / Preview switch showing the warning count                                                       |
| Parse      | A host that narrowed CTA targets also blocked every image                                                                                  | Separate `isAllowedMediaSrc`                                                                                   |
| Tests      | `promotion.test.ts` was not in `npm run test`                                                                                              | Added. 32 promotion tests, 119 in total                                                                        |

## Motion review (Emil format)

| Before                                                       | After                                                                                                           | Why                                                                                                                  |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Bar `duration-300 ease-out` (built-in)                       | `duration-250 ease-[cubic-bezier(0.23,1,0.32,1)]`                                                               | Built-in easings are too weak. Under 300ms for UI                                                                    |
| Mobile sheet `translate-y-[2.5rem] duration-200 ease-in-out` | Drawer `translateY(100%)` + `cubic-bezier(0.32,0.72,0,1)` at 450ms, exit scaled by swipe strength               | A sheet should leave by its own height and follow the finger. `ease-in-out` is for on-screen movement, not entrances |
| Dialog `zoom-in-95 duration-100` via keyframes               | `scale-[0.96] → 1` + opacity, 200ms strong ease-out, exit 150ms                                                 | Keyframes cannot be interrupted, and 100ms read as a blink. Exit is faster than entry. Modals stay centred           |
| Card vanishes on dismiss                                     | Opacity + height fold, 250ms ease-out (opacity only when reduced)                                               | Content below teleported up                                                                                          |
| Copy button (new)                                            | Icon swap with `blur(2px)` + `scale(0.8)`, 160ms, `popLayout`                                                   | Blur makes the swap read as one object, not two crossfading                                                          |
| Toast (new)                                                  | `y: 16, scale: 0.97` → rest, 300ms ease-out, `transform-origin` at its corner, momentum swipe (96px or 450px/s) | It enters from where it lives. A flick is enough                                                                     |
| Chip, toast buttons                                          | `active:scale-[0.97]` at 150ms                                                                                  | Press feedback                                                                                                       |
| Badge                                                        | No animation, no pulse                                                                                          | A nav is seen constantly. Motion there nags                                                                          |

**Rejected candidates** (considered, not animated):

- Bar countdown ticking every second. Truthful, but it is movement in the
  corner of every page view, and "Ends in 3 hours" is enough.
- Staggered entrance of bar, card and toast. They arrive at different times
  by design, and a stagger would imply they belong together.
- Shimmer or pulse on the CTA. It raises urgency without adding information,
  which the principles forbid.

**Verdict:** approve for the promotion surfaces. One trade-off is deliberate:
the inline bar still animates `grid-template-rows`, a layout property,
because an in-flow bar must push content. `floating` is the zero-CLS
alternative, and the docs say so.

## How each screen gets it

```text
DESKTOP ≥1280                         LAPTOP ~1024                    PHONE ~390
┌───────────────────────────────┐    ┌─────────────────────────┐     ┌───────────────┐
│ ▸ New batch · Starts Mon  ✕   │    │ ▸ New batch · Mon  ✕    │     │ Night batch ✕ │ bar: title +
├───────────────────────────────┤    ├─────────────────────────┤     ├───────────────┤  CTA wrap, body
│ Logo   Courses  Books[New]  ● │    │ Logo  Courses Books[New]│     │ Logo        ☰ │  hidden <md
│                               │    │                         │     │               │
│  Hero ……………      ┌─────────┐  │    │  Hero ……………             │     │ Hero ………      │ card: stacks
│                   │ card    │  │    │  ┌─ card (media left) ┐ │     │ ┌───────────┐ │  media on top
│                   │ + image │  │    │  └────────────────────┘ │     │ │ card      │ │  (container
│                   └─────────┘  │    │                         │     │ └───────────┘ │  query, not
│                   ┌──────────┐ │    │            ┌──────────┐ │     │               │  viewport)
│                   │ toast  – ✕│ │    │            │ toast – ✕│ │     │┌─────────────┐│ toast: full
│                   │ EARLY20 ⧉ │ │    │            └──────────┘ │     ││ toast   – ✕ ││  width above
│                   └──────────┘ │    │                         │     │└─────────────┘│  the home bar,
└───────────────────────────────┘    └─────────────────────────┘     └───────────────┘  swipe sideways
 dialog: centred, max-w-md,            same as desktop                 dialog → bottom
 image on top, Not now | CTA                                           sheet, grab handle,
                                                                       swipe down, CTA in
                                                                       thumb zone
```

Wide screens can hold a card with media beside the text and a toast with a
thumbnail. Phones never get two floating things: the toast gives way to the
sheet, and a minimised toast is a 36px chip, not a banner.

## What to add next (ranked by conversion per unit of annoyance)

1. **A server-side dismissal hint** (cookie + `PromoBar` SSR) to remove the
   inline bar's one layout shift entirely. Needs a small `PromotionScript`,
   the way `next-themes` does it.
2. **A `promotion-source-fetch` adapter** from the original spec:
   stale-while-revalidate, refetch on focus, parse with `sanitizePromotions`.
3. **Frequency caps across promotions** ("at most one floating surface per
   visitor per day"). The per-promotion rules exist; a global budget does not.
4. **Audience hints** without PII: `firstVisit`, `returning`, `signedIn`,
   supplied by the host as flags and matched like routes.
5. **A/B variants** as `variants: PromotionContent[]` with a stable hash of
   an anonymous id, reported on every event.
6. **Inline "sticky CTA" for long course pages on phones.** A one-line
   bottom bar that appears after the pricing section scrolls out of view.
   High intent and low intrusion, and it reuses `PromoBar variant="floating"`
   with a scroll trigger.
7. **Editor: schedule timeline.** All records on a week strip, so overlaps
   are visible rather than only warned about.
8. **Motion Primitives / Animate UI ideas worth borrowing, and ones to skip.**
   Borrow: `TextMorph` for the countdown's unit change ("2 days" → "23
   hours"), `Disclosure` for the toast body on phones. Skip: magnetic
   buttons, spotlight borders and animated beams on promotions; they read as
   ads.

## Open questions for the owner

1. Should a **toast and a bar coexist** on the same page when the toast has
   the higher priority (current rule), or is one floating surface plus a bar
   too much for ICT?
2. **Once per visit** for dialogs: is a _visit_ a browser session (current),
   or a fixed window such as 24 hours?
3. Is **exit intent** acceptable for your brand? It is off by default.
4. Do you want **`code` copy events** fed to analytics as conversions, or
   kept separate from clicks (current)?
5. **Server dismissals:** are visitors signed in often enough that
   dismissals should follow the account (a custom `DismissalStore`) rather
   than the browser?
6. **Languages:** English only, or do we ship Assamese and Hindi `labels`
   presets in the registry?
