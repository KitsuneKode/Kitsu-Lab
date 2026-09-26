<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

Kitsu Lab is a shadcn registry of production components, each with a live
exhibit at `/exhibition/<path>`. The free items install from `@kitsu`
(`public/r/`); paid items install from `@kitsu-pro` (`registry-pro/r/`)
behind a license check. This file is the map for any agent working here.

## Repo map

| Path                                  | What lives there                                                                                                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`                                | Next 16 App Router: home, `/exhibition/[exhibit]`, `/pro` pricing, `/pro/r/[name]` (paid registry), `/api/checkout`, `/api/dodo/webhook`, `sitemap.ts`, `robots.ts`, OG images |
| `app/utils/registry.ts`               | The exhibit list: name, path, description, demo component. Drives the home list, sitemap and exhibit metadata.                                                                 |
| `components/promotions/`              | The promotions system. `index.ts` is the free barrel, `pro.ts` the paid one.                                                                                                   |
| `components/promotions-demo/`         | The promotions exhibit: scenarios, full-window preview, docs tab.                                                                                                              |
| `components/book-preview/`            | The book and PDF reader and its engines.                                                                                                                                       |
| `components/exhibit-*.tsx`            | Page chrome shared by all exhibits (Back to Lab, fullscreen, stage).                                                                                                           |
| `lib/`                                | Server helpers: `dodo.ts` (payments), `pro-license.ts`, `pro-registry.ts`, `pro-plans.ts`, `site.ts`, `og-card.tsx`.                                                           |
| `registry.json` / `registry-pro.json` | shadcn manifests for the free and paid registries.                                                                                                                             |
| `public/r/`, `registry-pro/r/`        | Generated registry JSON. Never edit or format by hand.                                                                                                                         |

## Verification & tooling

Run the full gate before committing: `npm run check` (typecheck + oxlint +
oxfmt check + every bun suite), then `npm run build`, then rebuild both
registries. CI runs the same and fails if the built registry drifts.

- Registries: `shadcn` is not a dependency. Use the version CI pins:
  `npx -y shadcn@4.21.0 build` (free) and
  `npx -y shadcn@4.21.0 build registry-pro.json -o registry-pro/r` (pro).
  Any change to a file listed in a manifest needs both rebuilt and committed.
- `npm run lint` — oxlint only (`.oxlintrc.json`). The worker-pump `await`-in-loop and cleanup-closure flags in the book-preview engines are intentional; those rules are off there. `role="status"` live regions and canvas `role="img"` are correct ARIA — `prefer-tag-over-role` is off. React Compiler runs via `reactCompiler: true` in `next.config.ts`.
- `npm run format` — oxfmt (`sortingMethod: lineLength`, `sortTailwindcss`). Generated registry output is ignored.
- `npm run test` — bun test over `components/book-preview`, `components/book-preview-demo`, `components/promotions` and `lib`.
- `npx react-doctor` — occasional audits. Intentional flags: serialized awaits in raster/text drains, setState-after-await behind `cancelled` guards, big orchestrator engines.
- Large demo PDFs live in `public/specimens/` (gitignored); `prebuild` fetches them via `scripts/fetch-specimens.mjs` and never fails the build.
- Check UI changes in a browser (Playwright or the dev server) at desktop, laptop and phone widths, and in Arabic for right-to-left.

## Conventions

- Pure logic lives in plain `.ts` modules so bun can test it without a DOM: `promotion.ts` (rules, parsing, selection), `*-math.ts`, `*-geometry.ts`, `lib/dodo.ts`. Put new logic there first and test it.
- UI primitives are Base UI flavored (`@base-ui/react/*`). Registry items relying on `items`, `render` props or `alignItemWithTrigger` must say so in their `docs` field.
- Lint rejects `setState` inside effects. Derive state during render, read external values with `useSyncExternalStore`, or, when an effect truly syncs with an external store, annotate the one line with `// oxlint-disable-next-line react/set-state-in-effect -- <why>`.
- Every exported or non-trivial function gets a one-line `/** … */` docstring saying what it is for.
- Motion: transform and opacity (and clip-path) only, strong ease-out (`cubic-bezier(0.23,1,0.32,1)`), the drawer curve for sheets, and a reduced-motion path.
- Copy and code stay generic. No client names, links or brand copy in the library; client specifics live in the client's own repo.

## Promotions architecture

- Records are plain JSON (`Promotion`), validated by `parsePromotion` (editor input) and `isPromotion` (stored rows). Unknown or malformed optional fields must be rejected by both, because a bad row renders in the root layout.
- `PromotionProvider` selects what shows: one floating surface at a time (dialog, then spotlight, then toast), campaign dedupe against the bar, frequency windows, a daily interruption budget, audiences, experiments (variants and holdout, stable per visitor), conversions and event triggers.
- Surfaces read everything through `usePromotions()`. Each is its own registry item.
- Free vs pro is decided by the manifests plus the two barrels. A pro file may import only from the free core. When you add a surface, list it in exactly one manifest and export it from the matching barrel.

## Kitsu Pro and payments

- Payments go through Dodo Payments (merchant of record, pays out to India). `lib/dodo.ts` talks to it over `fetch`: checkout sessions, public license validation, and Standard Webhooks signature checks.
- `/pro/r/[name]` serves `registry-pro/r/*.json` to a bearer key that is either listed in `KITSU_PRO_KEYS` or valid according to Dodo (subscription keys stop validating when the subscription lapses). Answers are cached briefly.
- Plans are defined in `lib/pro-plans.ts`; each maps to a Dodo product id from the environment. Keep the displayed price in step with the Dodo product.
- Environment variables are listed in `.env.example`. Never commit real values.
- The repository is public, so pro source is readable on GitHub until it moves to a private repo. Do not claim otherwise in copy.

## Pull requests

- One branch and PR per topic. Commit and push early; work only on a local or cloud machine is lost when that machine goes away.
- Merge with "Squash and merge"; `main` history is linear.
- When a PR depends on another open PR, branch from it and say so in the description; after the base merges, retarget to `main`.
- CodeRabbit reviews only on request here (`@coderabbitai review`) and is rate-limited to about one review an hour. Verify each finding against the code before changing anything, reply on every thread, and resolve it.
