# 05 — E2E in CI and payment-route coverage

## TEST-01 — Playwright suite exists but never runs in CI

PR #7 adds `e2e/helpers.ts`, `e2e/reader.e2e.ts`, `playwright.config.ts`, and `npm run test:e2e`, but `.github/workflows/ci.yml` (verified at PR #7 head) has no e2e step. The suite will silently rot.

**Fix:** add a CI job:

```yaml
e2e:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - uses: actions/setup-node@v4
      with: { node-version: 22 }
    - run: bun install --frozen-lockfile
    - run: bun run build # suite needs a build per AGENTS.md
    - run: bunx playwright install --with-deps chromium
    - run: bun run test:e2e
    - uses: actions/upload-artifact@v4
      if: failure()
      with: { name: playwright-report, path: playwright-report/ }
```

**Risk: MED** — e2e flakes block every PR. Mitigate: `retries: 2` in `playwright.config.ts` for CI only, keep the suite small (it currently covers the smoke paths — good), run it only on PRs touching `components/book-preview/**` and `e2e/**` via `paths:` filters if runtime is a problem.

## TEST-02 — Payment/license routes: unit coverage exists, route-level gaps

PR #6 ships `lib/dodo.test.ts` and `lib/pro-registry.test.ts` — good. Untested seams:

- `app/api/checkout/route.ts`: plan→product-id mapping when an env var is missing (should 500/503 cleanly, not create a session against `undefined`), unknown plan names, and the redirect-URL construction.
- `app/api/dodo/webhook/route.ts`: replay behavior (send same `webhook-id` twice → second is 204 with no side effects), bad signature → 401 before parsing, malformed JSON → 400.
- `app/pro/r/[name]/route.ts`: traversal names (`..%2F`, `a.json.json`), missing `KITSU_PRO_KEYS` → 503, wrong key → 401, valid key → correct content-type + no-store.

These are `Request`/`Response` handlers — testable with plain `new Request(...)` + `await GET/POST(...)` under bun (same pattern as `pro-registry.test.ts` already uses for the pure parts). Mock `verifyWebhook` and `readFile` at module seams if needed.

## TEST-03 — Coverage gaps in the reader worth one test each

- `useBookPreviewSelector` shallow-equal: a selector returning a fresh object with identical leaves must not re-render (guards the PR #7 perf work).
- `sourceIdentity` stability: same source → same key across calls (regression net for PERF-01).
- Curl cover-spread edge: 1-page book with `cover: true` must not produce a negative-slot render (the `visible.delete(-1)`/`exists(s)` guards — pin them).
- Promotion `isPromotion` rejects `cta.href: "javascript:alert(1)"` and `/\\evil.com` backslash paths — likely covered in `promotion.test.ts`; confirm, add if missing.

## Verification

`npm run check` + new tests; CI green on a PR; one intentional e2e failure to confirm artifacts upload.
