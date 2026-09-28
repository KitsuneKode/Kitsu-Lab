# 03 — Reader performance audit fixes

## PERF-01 — `sourceIdentity` re-serializes the book on every render

`components/book-preview/normalize.ts:58` — `sourceIdentity` maps every page (spreading each page object), `JSON.stringify`s the result (all page text), then FNV-hashes the string. It is called **three times, unmemoized**, in `book-preview.tsx`:

- `:912` `propSourceKey = sourceIdentity(propSource)` — every render
- `:973` `sourceKey = sourceIdentity(normalized)` — every render
- `:979` `sourceIdentity({ ...normalized, pdfUrl: ... })` — the spread creates a **new object identity every render**, so even React Compiler's memoization misses; every render during an upload session serializes the whole source

On a 300-page text book, each page turn re-serializes ~the entire book text 2–3×. This runs on the render path that feeds `contextValue` (line ~1520).

**Fix:**

```ts
const propSourceKey = useMemo(() => sourceIdentity(propSource), [propSource])
const sourceKey = useMemo(() => sourceIdentity(normalized), [normalized])
const storageKey = useMemo(
  () =>
    upload
      ? sourceIdentity({
          ...normalized,
          pdfUrl: `upload:${upload.fingerprint}`,
        })
      : sourceKey,
  [upload, normalized, sourceKey],
)
```

`useMemo` here is a stability contract, not premature optimization — the keys feed effect deps, localStorage keys, and the engine reset epoch.

**Verify:** add a render-count probe in dev (`console.count('sourceIdentity')` inside the function), turn pages — count stays flat. Existing reducer/normalize tests cover behavior; run `bun test components/book-preview`.

## PERF-02 — Finish the selector migration (PR #7 started it)

`useBookPreviewSelector` (`book-preview-provider.tsx`) with shallow-equal slices is correct, but many components still call `useBookPreview()` and re-render on every page turn. Known remaining heavy consumers at PR #7 head: `BookPreviewNavigation` (added `minutesLeft` — fine, it needs page state), `BookPreviewSideArrows`, `BookPreviewResume`, engines' `useBookPreview()` calls (`curl-stage.tsx` line ~165, premier/webgl engines).

**Fix:** migrate components whose render is expensive (engines' per-frame paths, `BookPreviewAnnotationLayer`, `BookPreviewInkLayer`, `BookPreviewCompanion` panels) to selectors picking only the fields they read. Leave cheap leaf components on `useBookPreview()` — the ergonomics matter and the compiler already memoizes JSX.

**Verify:** React DevTools Profiler — a page turn should not re-render the notebook list, toolbar clusters that don't show page state, or the companion.

## PERF-03 — Verify heavy-engine bundle isolation (spec requirement)

The design spec (`docs/superpowers/specs/2026-09-20-shadcn-book-preview-design.md`) requires `pdfjs-dist`, `three`/`@react-three/fiber`/`drei`/`maath`, and the curl/scroll/spread engines absent from the initial chunk. The engine `load()` indirection exists; it needs a measurement, not a promise.

**Steps:**

1. `npm run build`, inspect `.next` chunk output / `@next/bundle-analyzer` (add as devDep if absent).
2. Confirm the `book-preview` entry chunk excludes `pdfjs-dist`, `three`, `drei`, `maath`. `optimizePackageImports` in `next.config.ts` already covers icon/drei/fiber barrel pruning.
3. Confirm registry artifacts: `public/r/book-preview.json` (core) must not list `three`/`pdfjs-dist` deps; `book-preview-pdf.json`, `book-preview-webgl.json`, `book-preview-engines.json` carry them separately.
4. Record numbers in the plan's notes — this becomes the regression baseline.

**Stop condition:** if any heavy lib reaches the core chunk, find the import chain (`bun build --analyze` or analyzer) and convert it to the engine `load()` pattern.

## PERF-04 — PDF canvas memory ceilings

`pdf-engine.tsx` renders page canvases + a thumbnail rail + a text layer per page. Verify:

- devicePixelRatio is capped (e.g. `Math.min(dpr, 2)`) before `canvas.width` sizing — 3× DPR phones otherwise allocate 9× pixels per page.
- Thumbnail canvases render at reduced scale, not full-size scaled down by CSS.
- Offscreen page canvases are released/recycled (the mount-window pattern exists in curl; pdf uses a scroll list — confirm offscreen pages' canvases are torn down or capped).
- `URL.revokeObjectURL` on upload replace/unmount (already verified in `useUploadedPdf`).

**Effort:** verify-only if caps exist (S); add caps if missing (M).

## PERF-05 — Three Google fonts on every page

`app/layout.tsx` loads Orbitron, Space Grotesk, JetBrains Mono site-wide. Orbitron is a display/brand face — if it only appears in headings/brand marks, consider `weight` subsetting or scoping it to the shell heading and letting the reader use Grotesk/mono only. Measure: `next/font` already self-hosts, so the cost is ~3 font files + FOUT on first load.

## Order & dependencies

PERF-01 first (isolated, cheap). PERF-03 after PR #7 merges (its engine-extraction changes the chunk graph). PERF-02 after #7.
