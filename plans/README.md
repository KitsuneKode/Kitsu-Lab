# Improvement plans — Kitsu Lab audit

Generated from a full audit of `main` + open PRs #1–#7 (stack: #3←#7, #5←#6; #4 superseded by #5; #2 merged; #1 is ImgBot noise).

## Execution order

| #   | Plan                                                                        | Depends on                    | Risk | Status  |
| --- | --------------------------------------------------------------------------- | ----------------------------- | ---- | ------- |
| 01  | [PR merge order and stack hygiene](01-pr-merge-order.md)                    | —                             | Low  | pending |
| 02  | [Security hardening: payments, registry, headers](02-security-hardening.md) | 01 (lands on merged tree)     | Med  | pending |
| 03  | [Reader performance audit fixes](03-reader-performance.md)                  | #7 merged (or rebase onto it) | Low  | pending |
| 04  | [Reader API freeze and engine scope](04-reader-scope.md)                    | 03                            | Med  | pending |
| 05  | [E2E in CI and payment-route coverage](05-testing-ci.md)                    | #7 merged, 02                 | Low  | pending |
| 06  | [Design and taste pass](06-design-taste.md)                                 | 01 (post-merge baseline)      | Low  | pending |

## Notes for the executor

- Run the full gate before committing anything: `npm run check`, then `npm run build` and `npm run registry:build`. `registry:check` fails if `public/r/` drifts.
- oxlint warnings that are intentional (worker-pump awaits, cleanup closures, `role="status"`, dropzone tabIndex) are documented in `AGENTS.md` — do not "fix" them.
- React Compiler is enabled; do not add manual `useMemo`/`useCallback` that fights it — but module-scope hash calls over fresh objects (plan 03) still need care.
- Do not regenerate or hand-edit `public/r/*.json`; only `shadcn build` writes them.
