# 02 — Security hardening: payments, pro registry, headers

## What the audit found (evidence-based, post-merge tree of #5+#6)

**Already good — do not regress:**

- `lib/pro-registry.ts`: `parseItemName` whitelists `^[a-z0-9][a-z0-9-]{0,63}$` (no traversal), `isAuthorized` hashes then `timingSafeEqual`s keys, paid artifacts served `private, no-store`.
- `app/api/dodo/webhook/route.ts`: signature-verified (`verifyWebhook` on raw body + timestamp), replay dedup with bounded `seen` set (clears at 5000), `forgetLicenses()` cache invalidation on access-ending events, notify fetch has `AbortSignal.timeout(3000)` and swallows errors.
- `components/promotions/promotion.ts`: `defaultIsAllowedHref` blocks `javascript:`, `//`, backslash, control chars; `plainText` rejects `<>`; `isPromotion`/`sanitizePromotions` drop malformed CMS rows before they reach the root layout.
- `components/book-preview/ai.ts`: prompt is assembled as plain text, output rendered via React text nodes (no `dangerouslySetInnerHTML` in inspected surfaces).
- PR #2 (merged) patched the React Server Components CVE.

**Needs fixing:**

### SEC-01 — No security headers anywhere

`next.config.ts` `headers()` only sets cache-control on static assets. A site that runs checkout redirects, serves a bearer-authenticated registry, and renders user-uploaded PDFs should set at minimum:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY` (or CSP `frame-ancestors 'none'` — the registry JSON routes should never be framed)
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- CSP: start report-only (`Content-Security-Policy-Report-Only`), because `pdfjs-dist` workers, blob: object URLs for uploads, and Vercel Analytics all need explicit allowances. Tune until clean, then enforce.

**Files:** `next.config.ts` `headers()`. **Effort: S-M. Risk: MED** — a too-tight CSP breaks the PDF worker (`worker-src blob:`) and uploaded-file rendering (`img-src`/`connect-src blob:`). Test with a real PDF upload.

### SEC-02 — Webhook replay dedup is per-process

`seen` is a module-level `Set` in `app/api/dodo/webhook/route.ts`. On serverless/multi-instance deploys each instance has its own set, so a replayed event hits a warm instance and re-fires. **Impact today is low** — the handler only does cache invalidation + a duplicate sale ping — but if fulfillment logic is ever added here this becomes exploitable.

- Minimal fix: document the limitation in the route comment.
- Real fix (when fulfillment lands): move dedup to durable storage (KV/DB unique constraint on `webhook-id`).

**Effort: S (doc) / M (durable). Risk: LOW now, MED later.**

### SEC-03 — License lookup rate limiter is per-process

`lib/pro-license.ts` rate-limits unknown-key lookups per process; on autoscaling serverless each instance resets the budget, so key enumeration/defacement of the Dodo API quota scales with instance count. Same class of issue as SEC-02. Document now; use durable rate limiting if abuse is observed.

### SEC-04 — `KITSU_PRO_KEYS` static keys have no per-customer revocation

`lib/pro-registry.ts` + PR #6 route: all buyers share keys from one env var (or per-key rows — either way a leaked key works until an env rotation). Acceptable for MVP; write a rotation runbook (which env var, how to roll, how buyers re-auth) into `docs/` before launch.

### SEC-05 — Hostname canonicalization (also in plan 01)

`SITE_URL`/metadataBase/checkout `success_url` derive from env with divergent fallbacks across three files. Wrong base = checkout redirects to a stale origin = failed payments. Consolidate to one `lib/site.ts` export used by metadata, sitemap, robots, OG, and the checkout route.

### SEC-06 — Upload/drop surface on `book-preview.tsx` dropzone

`div` with `onDrop`/`tabIndex` (oxlint a11y warnings at ~1637/1644). Not a security bug, but the drag-drop path should be re-checked for: non-PDF rejection (handled — `isPdfFile`), oversized files (no size cap observed — add one, e.g. 50 MB, before `URL.createObjectURL`), and `application/pdf` spoofing (harmless — pdf.js will just fail to parse).

## Verification

- `npm run check`, `npm run build`.
- Manual: `curl -I https://<deploy>/` shows the new headers; `curl -H "Authorization: Bearer wrong" https://<deploy>/pro/r/promo-pill.json` returns 401; replay a captured webhook body → 204 once, 204 again (dedup) — and confirm no second Discord/Slack ping.
- CSP validation: load the reader, upload a PDF, switch through every engine, open Ask — zero CSP violations in console before flipping from Report-Only to enforce.

## Rollback

Header changes are config-only; revert `next.config.ts`. Keep report-only CSP until the engine matrix passes.
