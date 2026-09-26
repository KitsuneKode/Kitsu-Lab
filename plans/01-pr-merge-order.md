# 01 — PR merge order and stack hygiene

## Why

The open PR stack has structural problems that will cause merge pain regardless of code quality:

- **PR #4 is fully redundant.** PR #5's branch includes PR #4's commits (`claude/promotions-and-image-pages` is an ancestor of `claude/promo-component-refinement-4hvk9a`). Merging both means double-reviewing ~6,700 lines and guaranteed conflicts.
- **PR #5 vendors 18 unrelated files** under `.claude/skills/` (emil-design-eng, animate, review-animations, pick-ui-library, improve-animations, find-animation-opportunities, animation-vocabulary — LICENSEs included, so legal, but they're agent tooling that has nothing to do with the promotions product and inflate the diff).
- **PR #6 is stacked on #5** and **PR #7 is stacked on #3**. GitHub will not retarget cleanly if parents merge with squashes — orphaned stacks need manual rebase.
- **Three hostnames disagree**: `app/layout.tsx` metadataBase = `kitsulab.vercel.app`, README demo = `lab.kitsunelabs.xyz`, PR #6 default = `kitsu-lab.vercel.app`. Canonical sitemap/OG/canonical URLs and the checkout `success_url` base all derive from whichever wins.
- **PR #1 (ImgBot)** is +73/−222 image recompression; lowest risk, can land anytime.

## Steps

1. **Close PR #4** with a comment pointing to #5. Do not merge it.
2. **Remove the vendored skills from PR #5** before merge:
   ```bash
   git checkout claude/promo-component-refinement-4hvk9a
   git rm -r .claude/skills
   ```
   If the team wants them, they belong in a separate tooling commit/PR or `~/.agents/skills/` (user-level), not the product diff.
3. **Pick the canonical hostname** (recommend the custom domain `lab.kitsunelabs.xyz` since README already advertises it) and set `NEXT_PUBLIC_SITE_URL` accordingly in production env. Fix `metadataBase` in `app/layout.tsx` and the PR #6 default in `lib/site.ts` (or wherever `SITE_URL` falls back).
4. **Merge order**:
   - Track A (reader): merge **#3** → rebase/merge **#7** onto main.
   - Track B (commerce): merge **#5** → rebase/merge **#6** onto main.
   - #1 anywhere. #2 already merged.
5. After each merge, run `npm run check && npm run build && npm run registry:build` on main before rebasing the next stacked PR.

## Risks

- Rebasing #7 onto a squashed #3 produces conflict noise in `book-preview.tsx` (it was heavily refactored). Mitigate by merging #7 as a normal merge commit or reviewing the rebase carefully — the extraction is mostly file moves.
- Changing metadataBase changes canonical URLs for already-indexed pages — acceptable for a pre-launch lab site; not acceptable post-launch.

## Stop conditions

- If #4 contains commits NOT in #5 (verify with `git log origin/claude/promotions-and-image-pages --not origin/claude/promo-component-refinement-4hvk9a`), do not close it — merge those commits first.
