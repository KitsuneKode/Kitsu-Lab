# 07 — Premium roadmap: Campaigns and Reader at the $89+ level

Linear-ready backlog. Each ticket has an id (`KL-nn`), a Linear project, a
priority, a size (S ≤ 1 day, M ≤ 3 days, L ≤ 1 week, XL needs a spike first),
dependencies and acceptance criteria. Names are working titles; the naming pass
is ticket KL-60.

## Status

| Ticket                                   | State                                                       | Where                        |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------------------- |
| KL-01                                    | In review                                                   | #8 (stack of #3, #7, #5, #6) |
| KL-05                                    | Started: `@shadcn/lint` at `warn`                           | #9                           |
| KL-10, KL-11, KL-12, KL-21               | Done                                                        | #9                           |
| KL-13, KL-20, KL-22, KL-23               | Done                                                        | #10                          |
| KL-14                                    | Done except 9:16 cuts                                       | #9, #10                      |
| KL-15                                    | Partly: counter removed; real product photos still needed   | #9                           |
| KL-36, KL-37, KL-38, KL-40, KL-42, KL-43 | Done                                                        | #11                          |
| KL-39                                    | Done for editorial, mono, bold; glass needs a surface token | #11                          |

## Operating rules

1. **Build first, split later, but split-ready from day one.** Every new
   feature lands as its own file and its own registry item. Free code never
   imports pro code. The pro split then becomes a pricing decision, not a
   refactor.
2. **The client project is customer zero.** It installs from the registry
   with the shadcn CLI like a buyer would, pins a version, and keeps
   client-specific code in its own add-on file (the rule from the promotions
   v3 spec).
3. **Every visible feature ships with:** reduced-motion behaviour, RTL,
   keyboard path, a demo state, a test for its pure logic and a docs entry.

## Projects

| Project          | Goal                                                      |
| ---------------- | --------------------------------------------------------- |
| Foundation       | Merge the stack, freeze APIs, raise the quality bar in CI |
| Media & Showcase | Video, the showcase carousel, real footage                |
| Demo & Site      | A demo and a /pro page that sell by showing               |
| Campaigns        | Premium promotion features                                |
| Reader           | Premium reader features                                   |
| Bridge           | Features that need both products                          |
| Packaging        | Names, tiers, pricing, licence                            |

---

## Foundation

### KL-01 Merge the open PR stack

Project: Foundation · Priority: Urgent · Size: M · Depends on: none

Merge #3 → #7 and #5 → #6 per `plans/01-pr-merge-order.md`; close #4 and #1.
Every ticket below is cheaper on `main` than on four stacked branches.

- [ ] `main` contains the reader, promotions and payments work
- [ ] `npm run check`, `npm run build`, `npm run registry:check` pass on `main`
- [ ] Worktrees for merged branches removed

### KL-02 Freeze the reader and promotions public APIs

Project: Foundation · Priority: Urgent · Size: M · Depends on: KL-01

The client project locks the API the day it installs. Apply the freeze rules
in `plans/04-reader-scope.md` to both products.

- [ ] Public props and types marked `@public`; extension points documented
- [ ] Controlled/uncontrolled contract table in docs for `BookPreview` and `PromotionProvider`
- [ ] Registry items carry a version; a `CHANGELOG.md` exists per product

### KL-03 Accessibility and visual regression in CI

Project: Foundation · Priority: High · Size: M · Depends on: KL-01

- [ ] axe run over every exhibit state in the e2e job (fails on serious/critical)
- [ ] Playwright screenshot baselines for each promo surface and each reader engine at 390, 1024 and 1440 widths, light and dark
- [ ] A reduced-motion pass in the same job

### KL-04 Bundle budgets per registry item

Project: Foundation · Priority: Medium · Size: S · Depends on: KL-01

- [ ] Script reports gzipped cost of each registry item's own code and its dependencies
- [ ] Budgets checked in CI; numbers published in each item's docs

### KL-05 Adopt @shadcn/lint to "error"

Project: Foundation · Priority: High · Size: L · Depends on: KL-01

`@shadcn/lint` 0.2.0 is installed in oxlint with the five core rules at
`warn`. First measurement (538 findings): 175 arbitrary values, 145 inline
styles, 125 raw colours, 90 restyles, 3 dynamic classNames. Triage, then
promote each rule to `error`.

- [ ] Repeated curves and radii become tokens shipped through registry `cssVars` (`ease-snappy`, `ease-drawer`, `rounded-promo`), so buyers' projects get them too
- [ ] Reader chrome restyles of `<Button>` become real button variants
- [ ] Raw palette colours (`#D4AF37`, `stone-700`, …) move to theme tokens
- [ ] Engine transforms stay inline where values are per-frame; others move to CSS variables
- [ ] Decide how exact `transition-[…]` property lists (the "never transition all" rule) coexist with `no-arbitrary-values`
- [ ] Every rule at `error` with a clean tree

---

## Media & Showcase

### KL-10 Fix the launch story showing book pages

Project: Media & Showcase · Priority: Urgent · Size: S · Depends on: none

`SAMPLE_PAGES` (`components/promotions/promotion-kit.ts`) points at the
reader's `/sample-pages/page-N.svg`, so the "What's new in 3.0" story shows a
history book while its captions talk about workspaces.

- [ ] Launch kit media shows product visuals that match the captions
- [ ] No promotions kit references reader sample assets

### KL-11 `PromoMedia`: video as a media kind

Project: Media & Showcase · Priority: High · Size: L · Depends on: none

Make `PromotionMedia` a union of image and video
(`{ kind: 'video', src, poster, type, alt, width, height }`, poster required).

- [ ] Parser validates `src` and `poster` with `isAllowedMediaSrc`, allows only `video/mp4` and `video/webm`; tests cover rejects
- [ ] One `<PromoMedia>` renders both kinds: `muted playsInline loop preload="none"`
- [ ] Plays at ≥ 50% visible, pauses off screen and on a hidden tab
- [ ] Reduced motion or Save-Data shows the poster only
- [ ] Poster fades into video on `playing` (no black frame)
- [ ] Visible pause/play control on anything that loops longer than 5s (WCAG 2.2.2)
- [ ] Editor accepts a video with its poster

### KL-12 Video in the side card, split dialog and story

Project: Media & Showcase · Priority: High · Size: M · Depends on: KL-11

- [ ] Docked side card shows a 16:10 clip; the peek tab keeps a still thumbnail
- [ ] Split dialog puts video on the media half
- [ ] Story: a video slide lasts as long as the video and `ended` advances it; still slides keep the 6s clock
- [ ] Toast stays still (thumbnail only), by design

### KL-13 Showcase carousel

Project: Media & Showcase · Priority: High · Size: L · Depends on: KL-11

A new `variant="showcase"` on the carousel: one large active slide, chapter
labels below, each chapter's fill driven by its video's playback.

- [ ] Advances when the active clip ends; pauses on hover, focus, hidden tab
- [ ] Never advances under reduced motion; visible pause control
- [ ] Chapters are real tabs (arrow keys, `aria-selected`)
- [ ] The default offers carousel stays manual; docstring explains the difference

### KL-14 Clip recording pipeline

Project: Media & Showcase · Priority: High · Size: M · Depends on: KL-01

`scripts/record-promo-clips.mjs`: Playwright records scripted interactions with
the lab's own components (page curl, ink, highlights, promo surfaces), then
ffmpeg writes webm + mp4 + a poster.

- [ ] One command regenerates every clip
- [ ] Each clip ≤ 8s, ≤ 700 KB webm, 16:10 and 9:16 cuts
- [ ] Clips are fetched or built at deploy like specimens, not committed if large

### KL-15 Replace the store's hand-drawn swatches

Project: Media & Showcase · Priority: Medium · Size: S · Depends on: KL-14

- [ ] Store kit uses real product photography or a clip; no text baked into images
- [ ] Gallery drops the "1/4" overlay; the dots carry position

---

## Demo & Site

### KL-20 Rebuild the Northwind mock site

Project: Demo & Site · Priority: High · Size: L · Depends on: KL-14

- [ ] Real hero with a product visual, a feature section and pricing; no grey placeholder blocks, no three equal tiles
- [ ] Desktop layout leaves a margin wide enough for the side card to dock
- [ ] Each scenario (launch, store, course) has its own believable page set

### KL-21 Regroup the demo control panel

Project: Demo & Site · Priority: Medium · Size: M · Depends on: none

- [ ] Three groups: View (device, language), Visitor (guest/member, reset), Rules (budget, exit intent)
- [ ] Toggles are switches with a fixed label, not buttons that rename themselves
- [ ] Clock slider gets landmarks (now, launch ends, cohort starts)

### KL-22 Run our own launch on our own product

Project: Demo & Site · Priority: High · Size: M · Depends on: KL-12, KL-01

- [ ] The lab site runs a real Kitsu launch with its own promotions: bar, docked side card with a reader clip, a "what's new" story
- [ ] Events go to analytics; frequency caps honoured

### KL-23 `/pro` page that shows instead of lists

Project: Demo & Site · Priority: High · Size: M · Depends on: KL-13, KL-14

- [ ] The `INCLUDED` rows become a showcase carousel, one chapter per feature
- [ ] Clear licence, refund policy and changelog links

---

## Campaigns

### KL-30 Product tours

Project: Campaigns · Priority: High · Size: XL · Depends on: KL-02

A sequence of spotlight steps built on `PromoSpotlight`.

- [ ] Steps with progress, next/back/skip, resume where the visitor left off
- [ ] Starts from an event trigger or `openPromotion`; never on its own
- [ ] Survives a step's anchor mounting late or never (skips with a report)
- [ ] Editor can author steps

### KL-31 Changelog hub

Project: Campaigns · Priority: High · Size: L · Depends on: KL-11

Grow `PromoInbox` into a "what's new" panel.

- [ ] Unread tracking per visitor, rich entries with media, deep links
- [ ] Optional reactions reported as events
- [ ] Badge on the trigger reflects unread count

### KL-32 Results dashboard component

Project: Campaigns · Priority: High · Size: L · Depends on: KL-02

`<CampaignResults>` over the event stream.

- [ ] Impressions → clicks → conversions per variant
- [ ] Lift against the holdout, with a clear "not enough data yet" state
- [ ] Pure stats module with tests; charts follow one palette in light and dark

### KL-33 Signed preview links

Project: Campaigns · Priority: High · Size: M · Depends on: KL-02

- [ ] `?promo-preview=<token>` shows a draft on the real site to the holder only
- [ ] Token signed server-side with expiry; host supplies the verifier
- [ ] Preview never reports analytics or spends frequency budget

### KL-34 Zero-layout-shift server bar

Project: Campaigns · Priority: Medium · Size: M · Depends on: KL-02

- [ ] `PromotionScript` + cookie store render the inline bar on the server
- [ ] Dismissed bars never flash; CLS 0 in the e2e check

### KL-35 Content source adapters

Project: Campaigns · Priority: Medium · Size: L · Depends on: KL-02

- [ ] Published JSON schema for records
- [ ] Adapters: Sanity, Contentful, Payload, Supabase, Vercel Edge Config, Google Sheets
- [ ] Stale-while-revalidate fetch adapter that parses with `sanitizePromotions`

### KL-36 Analytics adapters

Project: Campaigns · Priority: Medium · Size: S · Depends on: none

- [ ] `onEvent` adapters for PostHog, GA4, Segment, Vercel Analytics

### KL-37 Morphing announcement pill

Project: Campaigns · Priority: Medium · Size: M · Depends on: none

- [ ] Pill expands into its card in place with a shared-element transition
- [ ] Interruptible; reduced motion swaps with a fade

### KL-38 Countdown digits

Project: Campaigns · Priority: Low · Size: S · Depends on: none

- [ ] Digits roll only when the displayed unit changes (never per second), tabular numbers, static under reduced motion

### KL-39 Theme presets

Project: Campaigns · Priority: Medium · Size: M · Depends on: none

- [ ] Four presets (editorial, glass, mono, bold) using only `--promo-*` tokens
- [ ] Glass has a solid fallback for reduced transparency

### KL-40 Success moment on applied code

Project: Campaigns · Priority: Low · Size: S · Depends on: none

- [ ] One small celebration when a code is applied at checkout; none on hover or repeat

### KL-41 More kits

Project: Campaigns · Priority: Medium · Size: L · Depends on: KL-02

- [ ] Trial ending, Black Friday calendar, webinar/event, app download banner, feature deprecation, incident/maintenance, newsletter capture
- [ ] Each kit reaches a live campaign in about ten minutes following its docs

### KL-42 Agent-ready campaigns

Project: Campaigns · Priority: Medium · Size: S · Depends on: KL-35

- [ ] Agent guide and JSON schema let an assistant produce a valid campaign record first time; one worked example in docs

### KL-43 "No dark patterns" as a documented guarantee

Project: Campaigns · Priority: Medium · Size: S · Depends on: none

- [ ] Docs page listing the guarantees (caps, no fake scarcity, stories never self-open, holdouts) and where the code enforces each

---

## Reader

### KL-50 Page-edge thickness shows progress

Project: Reader · Priority: High · Size: M · Depends on: KL-02

- [ ] Curl and spread engines draw page stacks whose thickness tracks position; math in a `*-geometry.ts` module with tests

### KL-51 Cover opening, once per book

Project: Reader · Priority: Medium · Size: M · Depends on: KL-50

- [ ] First open lifts the hardcover on the curl engine; never repeats for that book; skipped under reduced motion

### KL-52 Paper lighting and texture

Project: Reader · Priority: Medium · Size: M · Depends on: none

- [ ] Curl highlight follows the fold angle; each paper setting has a subtle texture; no measurable frame-time regression

### KL-53 Haptic tick on page land

Project: Reader · Priority: Low · Size: S · Depends on: none

- [ ] `navigator.vibrate` on supported devices when a turned page settles; off with sound off

### KL-54 Shoppable page hotspots

Project: Reader · Priority: High · Size: L · Depends on: KL-02

- [ ] Page-relative hotspots (0-1 coordinates like ink) open a product card
- [ ] Hotspots authored as data; events reported; keyboard reachable

### KL-55 Web component embed

Project: Reader · Priority: High · Size: L · Depends on: KL-02

- [ ] `<kitsu-book src=…>` usable on WordPress/Webflow with one script tag
- [ ] Shadow DOM styling; attribute API mirrors the main props

### KL-56 Read-aloud audit and word highlighting

Project: Reader · Priority: Medium · Size: M · Depends on: none

- [ ] Audit what `audio.ts` and `speaking-bars.tsx` already do
- [ ] Word-by-word highlight synced to speech where the platform supports it

### KL-57 Reader analytics

Project: Reader · Priority: Medium · Size: M · Depends on: KL-02

- [ ] Time per page and drop-off page reported through an `onEvent`-style adapter

### KL-58 EPUB spike

Project: Reader · Priority: Low · Size: XL · Depends on: KL-02

- [ ] Written go/no-go: parser choice, pagination strategy, which engines can render it

---

## Bridge

### KL-59 "Read the sample, then buy"

Project: Bridge · Priority: High · Size: L · Depends on: KL-02, KL-11

- [ ] Reader shows N pages, then a gated page hosting a promotion surface
- [ ] The promotion runs through the provider (caps, A/B, events)
- [ ] Works with PDF and page data; the gate is not bypassable by URL page param

---

## Packaging

### KL-60 Naming pass

Project: Packaging · Priority: High · Size: S · Depends on: none

- [ ] Product names for the promotions system and the reader; registry namespaces and item names follow them

### KL-61 Pro split

Project: Packaging · Priority: High · Size: M · Depends on: KL-60 and the feature work

- [ ] Free / Reader Pro / Campaigns Pro / All-access boundaries decided per registry item
- [ ] `registry-pro.json` updated; free items import nothing pro

### KL-62 Pricing and licence terms

Project: Packaging · Priority: High · Size: S · Depends on: KL-61

- [ ] Plans updated in `lib/pro-plans.ts` and Dodo products
- [ ] Licence text covers client projects explicitly

### KL-63 Client project integration (customer zero)

Project: Packaging · Priority: Urgent · Size: M · Depends on: KL-01, KL-02

- [ ] Client installs both products from the registry with a pinned version
- [ ] Client-specific targets, labels and plugins live in the client repo's add-on file
- [ ] Every friction point found becomes a ticket here
