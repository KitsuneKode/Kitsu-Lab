# 06 — Design and taste pass (the "premium tier" work)

## Where the product stands

The lab shell is restrained and confident: sparse catalog, `viewport-fit: cover`, thoughtful `themeColor`/`interactiveWidget` viewport config, a custom cursor that's pointer-gated and sleeps when idle, view transitions in nav. The reader is where the craft lives — the code reads like someone who cares (endpapers beside lone pages, spread hysteresis, `env(safe-area-inset-*)` arrow placement, reduced-motion fallbacks for every flourish).

The taste risks are _incoherence and copy_, not ugliness:

## TASTE-01 — Typography hierarchy

`app/layout.tsx` loads **Orbitron** (sci-fi display) + Space Grotesk + JetBrains Mono globally. Orbitron is a strong choice for a "lab" brand but it fights the reader's editorial/bookish surfaces (serif-ish page content vs. techno chrome). Audit where Orbitron actually renders:

- If it's brand marks/headings only → keep, but subset its weights in `next/font`.
- If it leaks into reader chrome → scope it out; the reader should feel like paper, the shell like the lab.

The reader already has a typography system (`typography.ts` — font/spacing/width prefs). That system should stay reading-focused; don't let the brand font invade page text.

## TASTE-02 — Copy and metadata (cheap, high polish return)

- `app/layout.tsx` description: _"The destination for all your component. This website shows all the trial components by kitsunekode"_ — broken English in the product's own meta description. Rewrite: e.g. _"Kitsu Lab — a registry of animated, accessible components and a book reader engine for shadcn/ui."_
- README demo URL, metadataBase, and PR #6 site URL disagree (see plan 01 step 3) — canonical hostname is also a taste bug.
- `app/page.tsx` catalog: verify the exhibit count/message still reflects reality post-merge (it describes "trial components"; the site now ships a reader, promotions, and paid registry).

## TASTE-03 — Custom cursor

`components/custom-cursor.tsx` — pointer-gated, reduced-motion aware, sleeps its rAF loop when settled (verified). Keep it, but confirm:

- It never sits on top of interactive elements with `pointer-events: auto` (must be `pointer-events-none` + high z-index visual only).
- In the reader's immersive fullscreen the cursor should probably revert to native — a floating ring while reading is the kind of flourish that reads "portfolio" not "product". Decide deliberately; hiding it inside `.book-preview[data-book-preview-immersive]` is one CSS rule.

## TASTE-04 — Promotions as a shipped product (PR #5)

The system is well-architected (honest frequency caps, holdouts, "a story never opens on its own"). The taste question is whether a _component lab_ should ship a marketing-campaign engine at all — it's a second product with its own editorial surface (editor, inbox, stories). If kept:

- The promotion components' own visual language (bars, toasts, dialogs) must match the lab's: they use `tone: neutral|brand|highlight` tokens — verify `brand`/`highlight` resolve to the lab palette and not generic blue.
- The promotion editor is power-user UI; gate its exhibition route behind a demo flag or accept that it's a different audience than the reader demos.

## TASTE-05 — Reader polish details worth the pixels

Already strong; remaining gaps to verify by running the demo (`npm run dev`, every engine × mobile widths × landscape):

- Page-turn sound: confirm it never fires on keyboard/pager turns (PR #7 encodes "only the reader's own hand makes the paper sound" — verify the pointer path only).
- `minutesLeft` copy: "about N minutes left" — check pluralization ("1 minutes") and that it hides until enough pace data exists (`null until a few page turns`).
- Resume pill: `role="status"` + 8s auto-leave — verify screen readers announce it once and it doesn't steal focus.
- Ask panel streaming: chunk append should not yank layout (verify `min-height`/scroll pinning on the answer area).

## Verification

- `npm run dev`, eyeball pass: shell home → reader demo → promotions demo → pricing (post-#6). Screenshot each at 375px, 768px, 1440px, and 390px-landscape (PR #7 added the short-height chrome fix — verify).
- `prefers-reduced-motion: reduce` emulation pass — no animation should read as motion.
- Fonts: `npm run build` output font files; Lighthouse typography pass (no invisible-text flashes beyond `swap`).
