import type { BookPreviewAppearance } from "@/components/book-preview"

export type ArchivalFilterMode = "aged" | "museum" | "night"

/**
 * Maps the reader's appearance setting onto a plate treatment.
 *
 * The plate owns its own colour completely. It must never use Tailwind `dark:`
 * variants: the paper is a hardcoded cream, so a `dark:` text colour would win
 * from the app theme and paint near-white type onto near-white paper.
 */
export function archivalFilterModeFor(
  appearance: BookPreviewAppearance
): ArchivalFilterMode {
  if (appearance === "dark" || appearance === "oled") return "night"
  if (appearance === "light") return "museum"
  return "aged"
}
