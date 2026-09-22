import { BOOK_PREVIEW_APPEARANCES, BOOK_PREVIEW_MODES } from "./types"
import type { BookPreviewAppearance, BookPreviewMode } from "./types"

export const PREMIER_VIEWS = ["book", "single", "spread", "scroll", "text"] as const
export type PremierView = (typeof PREMIER_VIEWS)[number]

export type BookPreviewPrefs = {
  appearance?: BookPreviewAppearance
  mode?: BookPreviewMode
  /** PDF reader zoom — 0 is the fit-width sentinel used by the pdf engine. */
  pdfZoom?: number
  /** The premier reader's layout — book flip, one page, a spread, or a
      continuous strip. */
  premierView?: PremierView
}

const PREFS_KEY = "book-preview:prefs"

export function readBookPreviewPrefs(): BookPreviewPrefs {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(PREFS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<Record<keyof BookPreviewPrefs, unknown>>
    const prefs: BookPreviewPrefs = {}
    if (
      typeof parsed.appearance === "string" &&
      (BOOK_PREVIEW_APPEARANCES as readonly string[]).includes(parsed.appearance)
    ) {
      prefs.appearance = parsed.appearance as BookPreviewAppearance
    }
    if (
      typeof parsed.mode === "string" &&
      (BOOK_PREVIEW_MODES as readonly string[]).includes(parsed.mode)
    ) {
      prefs.mode = parsed.mode as BookPreviewMode
    }
    if (typeof parsed.pdfZoom === "number" && Number.isFinite(parsed.pdfZoom)) {
      prefs.pdfZoom = parsed.pdfZoom
    }
    if (
      typeof parsed.premierView === "string" &&
      (PREMIER_VIEWS as readonly string[]).includes(parsed.premierView)
    ) {
      prefs.premierView = parsed.premierView as PremierView
    }
    return prefs
  } catch {
    // localStorage may be unavailable (private mode, sandboxed iframe).
    return {}
  }
}

// Merges into the existing record — the shell and the engines write different
// keys of the same object and must not clobber each other.
export function writeBookPreviewPrefs(patch: BookPreviewPrefs): void {
  if (typeof window === "undefined") return
  try {
    const next = { ...readBookPreviewPrefs(), ...patch }
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(next))
  } catch {
    // localStorage may be unavailable.
  }
}
