# Promotions — a shadcn registry system for scheduled, reviewable campaigns

**Date:** 22 September 2026
**Status:** Draft for implementation
**First consumer:** Impact Career Tutorials (ICT) site, installed via `@kitsu/*`
**Also in this change:** an `image` page kind for `BookPreview` (last section)

## Objective

A small family of registry items that lets any Next.js + shadcn site announce a
new course, product, discount or deadline without making the page loud, and
lets a non-developer schedule, review and retire those announcements. It must
be generic enough to sell: no backend, route list, brand or analytics vendor is
baked in.

## Product principles

- **Quiet by default.** One intrusive surface per visitor at a time. Dialogs
  only after engagement, never on arrival. No marquees, auto-rotating
  carousels, fake countdowns or stacked popups.
- **Truthful urgency.** A countdown may only point at a real `endsAt`.
- **Reviewable.** Every record has a derived state anyone can read at a glance:
  draft, scheduled, live, paused, ended, archived. What you preview is exactly
  what renders.
- **Respectful dismissal.** Dismissal is stored and honoured; copy edits do not
  resurrect a dismissed promotion, a deliberate `dismissalVersion` bump does.
- **Accessible and calm motion.** Reduced motion removes travel; focus is
  managed by Base UI primitives; nothing relies on colour alone.

## Registry items

| Item                  | Type               | Contents                                                                                     | Deps                                |
| --------------------- | ------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------- |
| `promotion`           | `registry:lib`     | Types, `parsePromotion`, `deliveryState`, `selectPromotions`, `dismissalKey`, route matcher | none                                |
| `promotion-provider`  | `registry:component` | Context: source, pathname, clock, dismissal store, event callbacks, intrusive-slot arbiter | `promotion`                         |
| `promo-bar`           | `registry:component` | Announcement bar (top), dismissible, optional countdown to `endsAt`                       | provider, `button`                  |
| `promo-card`          | `registry:component` | Inline card for a named slot (`<PromoCard slot="hero" />`), 3 layouts: text, media, compact | provider, `button`, `badge`         |
| `promo-dialog`        | `registry:component` | Dialog on ≥`md`, bottom sheet below; engagement trigger                                     | provider, `dialog`, `drawer`        |
| `promotion-editor`    | `registry:block`   | Form + live preview + schedule summary; host supplies `onSubmit`, allowed routes/targets    | `field`, `input`, `textarea`, `select`, `tabs`, the renderers |
| `promotions`          | `registry:block`   | Convenience bundle of all of the above                                                       |                                     |

No data adapters ship in the core: the host passes a `PromotionSource`. A
`promotion-source-fetch` item (GET JSON, stale-while-revalidate in memory) is
the only optional adapter, because it is backend-agnostic.

## Data model

```ts
type PromotionPlacement = 'bar' | 'card' | 'dialog'
type PromotionTone = 'neutral' | 'brand' | 'highlight'

type Promotion = {
  id: string
  state: 'draft' | 'published' | 'paused' | 'archived'
  placement: PromotionPlacement
  /** For `card`: which named slot it fills. Ignored otherwise. */
  slot?: string
  eyebrow?: string
  title: string            // plain text, ≤ 80
  body?: string            // plain text, ≤ 320
  media?: { src: string; alt: string; width: number; height: number }
  cta?: { label: string; href: string; external?: boolean }
  tone: PromotionTone
  /** Route patterns: '/', '/courses', '/courses/*'. Empty = everywhere. */
  include: string[]
  exclude: string[]        // always wins over include
  startsAt: number         // ms epoch; delivery window is [startsAt, endsAt)
  endsAt: number
  priority: number         // 0–100, higher wins within a placement/slot
  dismiss: { mode: 'session' | 'days' | 'never-again'; days?: number }
  dismissalVersion: number // bump to show a changed promotion again
  showCountdown?: boolean  // only honoured when endsAt ≤ 14 days away
  campaign?: string        // opaque id passed to analytics callbacks
  revision: number
}
```

Derived, never stored: `deliveryState(p, now)` returns
`draft | scheduled | live | paused | ended | archived`.

Validation (`parsePromotion`) is pure and host-configurable:

```ts
parsePromotion(input, {
  isAllowedHref?: (href: string) => boolean   // e.g. internal routes + one WhatsApp intent
  isAllowedRoute?: (pattern: string) => boolean
  maxWindowDays?: number                      // default 365
})
```

Plain text only (no HTML sink anywhere); `<`/`>` rejected; hrefs limited to
`/…`, `https://…`, `tel:`, `mailto:` unless the host narrows further.

## Selection rules

`selectPromotions(records, { pathname, now })` → at most one record per
`bar`, per `dialog`, and per card `slot`, by priority then stable id. Exclude
beats include. The provider then applies visitor-level rules:

1. Dismissed (key = `promo:<id>:<dismissalVersion>`) → skipped.
2. **Intrusive arbiter:** at most one of `bar`/`dialog` open at once; a dialog
   defers while a bar is visible unless its priority is strictly higher.
3. **Engagement trigger for dialogs:** after N seconds *and* scroll depth, or
   on an explicit `openPromotion(id)`; never within the first interaction.
4. `suppress` prop / `suppressOn` patterns (checkout, sign-in) hide intrusive
   placements entirely.

## Provider API

```tsx
<PromotionProvider
  source={source}                 // PromotionSource: { load(): Promise<Promotion[]> } | Promotion[]
  pathname={usePathname()}
  now={() => Date.now()}          // injectable for tests and previews
  storage={localStorageDismissals} // default; swap for cookies/server
  suppressOn={['/checkout', '/login']}
  onEvent={(e) => track(e)}       // { type: 'impression'|'click'|'dismiss', id, placement, campaign }
>
  <PromoBar />
  {children}
  <PromoDialog />
</PromotionProvider>

<PromoCard slot="hero" fallback={null} />
```

- Impressions fire once per page view when ≥50% visible for ≥1s
  (IntersectionObserver), never on render.
- Events carry ids only; the component never sees or emits personal data.
- `now` is re-read on a 60 s interval so a promotion that starts or ends while
  the tab is open appears or disappears on time.
- SSR renders nothing for time-dependent placements (hydration-safe); the bar
  reserves no space until it has something to show, and animates in with a
  height transition that reduced motion replaces with an opacity change.

## Editor block

The piece that makes it sellable to non-developers:

- Two columns on desktop (form | preview), tabs on mobile.
- Preview renders the real `PromoBar`/`PromoCard`/`PromoDialog` with the draft
  and a "preview time" slider so the reviewer can see scheduled vs live vs
  ended, and a route field to test targeting.
- Schedule summary in plain language: "Live from Mon 29 Sep, 9:00 AM to Sun 5
  Oct, 11:59 PM IST (7 days). Shows on /courses and /courses/*. Hidden on
  /checkout."
- Warnings, not errors, for taste: countdown on a window over 14 days, two
  live dialogs on overlapping routes, a CTA pointing off-site.
- Timezone is explicit (`timeZone` prop, default the browser's) and shown next
  to every date.
- Host provides `onSubmit(promotion)`, `onPublish`, `onPause`,
  `onArchive`, `allowedRoutes`, `allowedTargets`. The block owns no data.

## Demo

`/exhibition/promotions`: three seeded records on a mock page, a clock
scrubber, the editor with live preview, and an event log panel showing the
analytics callbacks.

## Testing

- `bun test` for all pure functions: parse, delivery state boundaries
  (`startsAt` inclusive, `endsAt` exclusive), selection ordering, exclude
  precedence, dismissal keys, arbiter.
- Rendering tests only where logic lives in components (arbiter, engagement
  trigger) with an injected clock.
- `registry:check` stays green; `shadcn add ./public/r/promotions.json
  --dry-run` in a clean base-nova app.

## Scope boundaries

In: three placements, scheduling, route targeting, dismissal, events, editor.
Out: audience segmentation, A/B testing, geo/device targeting, rich text,
frequency caps beyond dismissal, a hosted backend.

---

## `BookPreview`: image page kind

Consumers that serve pre-rasterized pages (for cost, privacy or low-end
devices) currently need a `render` callback per page. Add first-class support:

```ts
type BookPreviewPage = {
  // …existing fields
  image?: {
    src: string
    srcSet?: string          // e.g. '…-1024.webp 1024w, …-1600.webp 1600w'
    sizes?: string
    width: number            // intrinsic, for aspect ratio and no layout shift
    height: number
    alt: string              // required; page text summary or "Page 3"
    placeholder?: string     // tiny data URL or dominant colour
  }
}
```

- `page`, `spread` and `scroll` engines render `image` pages with a plain
  `<img decoding="async" loading="lazy">` (the current and next page eager),
  sized by aspect ratio, no PDF runtime involved.
- Normalisation includes `image.src` in source identity so a changed page
  invalidates cached state.
- Optional `imageProps` hook on the root (`crossOrigin`, `referrerPolicy`,
  `draggable={false}`, `onContextMenu`) for hosts that want to discourage —
  not prevent — saving. Docs must say plainly that images can be captured.
- `download` capability stays false unless `downloadUrl` is set.
- Tests: normalisation of image pages, engine readiness with image-only
  sources, aspect-ratio math.
