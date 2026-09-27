# 04 — Reader API freeze and engine scope (the "overreach" call)

## The honest assessment

The book-preview is technically excellent — pure-math modules with real tests, disciplined cleanup, capability detection, SSR-safe, no HTML sinks. **It is also overbuilt relative to what a shadcn registry item should be.** The public prop surface in `types.ts` runs ~30+ props (controlled mode+page+appearance+sound, URL-state keys, persistence toggles, typography, annotations, ink, AI adapter, engine overrides, prefetch, share). Eight engines ship (page, curl, scroll, spread, archival-curl, webgl, pdf, premier). This is a _product_, not a _component_ — that's fine if the product is the point (the payments work in #6 suggests it is), but the maintenance contract must be chosen deliberately.

## Decisions to make (pick before executing)

### Option A — Keep it all, tier the registry (recommended)

Split the registry story into explicit tiers so consumers self-select:

| Tier    | Registry item         | Contents                                                                              |
| ------- | --------------------- | ------------------------------------------------------------------------------------- |
| Core    | `book-preview`        | page + scroll engines, toolbar, pager, settings — no pdf.js, no WebGL, no annotations |
| Reader+ | `book-preview-reader` | + curl, spread, premier, annotations/ink/Ask                                          |
| Full    | `book-preview-full`   | everything incl. pdf + webgl engines                                                  |

This matches the existing artifact split (`book-preview.json` vs `book-preview-pdf.json`, `-webgl.json`, `-engines.json`) — the work is mostly _documentation + registry.json metadata_, not code.

### Option B — Slim the default

If the goal is a genuinely light shadcn component: make `book-preview.json` = page engine only; move annotations, ink, Ask, URL-state, and persistence behind opt-in props that default **off** (they're already prop-gated: `annotate`, `share`). Lowest code churn; Option A's marketing is still possible.

### Not recommended

Do **not** delete engines. The tests and cleanup discipline make them cheap to keep; the risk is API width, not engine count.

## API freeze rules (either option)

1. `types.ts` public props are now frozen — new capabilities go through the existing `engines`/adapter extension points or new opt-in props, never renames/removals without a major.
2. Document the controlled/uncontrolled matrix in `docs/` (the README has usage but no contract table). Consumers hit the controlled-page + persistence interaction constantly (`usePersistedPageIndex` skip-while-controlled is subtle).
3. `BookPreviewPageStep`, `BookPreviewEngineProps`, `BookPreviewEngineReadyInfo` are the extension API — mark them `@public` in comments and treat changes as breaking.

## Specific debt items

- `components/book-preview-demo/` is ~2k+ lines of demo-only code shipping in the app bundle on exhibition routes — fine (it's a lab site), but confirm none of it is imported by registry items (`registry:check` passes, so imports are clean; keep it that way).
- `book-preview.tsx` after PR #7 is ~1,000 lines — acceptable now that hooks extracted. Do not split further without a named pain point; file-size refactors are churn.
- `minutesLeft` (PR #7): reading-pace learning persists per book — verify the localStorage schema handles eviction (many books × small keys; fine, but confirm no unbounded growth).

## Verification

- `registry:build` + `registry:check` after any registry.json change.
- Fresh-install test per the spec: `npx shadcn add <registry>/book-preview` into a blank project — document the result in the plan notes; it's the spec's top completion criterion and has never been demonstrated in the audit trail.
