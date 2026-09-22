<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Verification & tooling

Run the full gate before committing: `npm run check` (typecheck + oxlint + oxfmt check + tests), then `npm run build` and `npm run registry:build`.

- `npm run lint` — oxlint only (ESLint was removed; `.oxlintrc.json` is the single lint config). The worker-pump `await`-in-loop and cleanup-closure flags in the book-preview engines are intentional; those rules are off there. `role="status"` live regions and canvas `role="img"` are correct ARIA — `prefer-tag-over-role` is off. Note: React Compiler diagnostics are no longer linted — the compiler itself still runs via `reactCompiler: true` in `next.config.ts` and bails safely per-component.
- `npm run format` — oxfmt is the canonical formatter. `.oxfmtrc.json` replicates the old prettier behavior: `sortingMethod: lineLength` (import sorting) and `sortTailwindcss` (class sorting). Generated `public/r/` artifacts are in `ignorePatterns` — never format them.
- `npm run test` — bun test (book-preview suites).
- `npm run registry:build` — `shadcn build` regenerates `public/r/*.json` from `registry.json` + source. Keep artifacts in sync: `npm run registry:check` fails if the built output drifts from what's committed.
- `npx react-doctor` — occasional health audits (score lives at react.doctor). Intentional patterns it flags: serialized awaits in raster/text drains (bounded worker load), setState-after-await behind `cancelled` guards, big orchestrator engines.
- Large demo PDFs live in `public/specimens/` (gitignored, local-only). Tracked samples: `public/sample-*.pdf`.

## Conventions

- Pure math/geometry for engines lives in `*-math.ts` / `*-geometry.ts` modules so bun can test it without JSX/browser imports (see `premier-math.ts`, `webgl-geometry.ts`).
- UI primitives are Base UI flavored (`@base-ui/react/*`) — registry items relying on `items`, `render` props, or `alignItemWithTrigger` must say so in their `docs` field.
