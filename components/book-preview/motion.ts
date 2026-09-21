export const BOOK_PREVIEW_EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)"
export const BOOK_PREVIEW_PRESS_MS = 160
export const BOOK_PREVIEW_PRESS_SCALE = 0.97
export const BOOK_PREVIEW_UI_MS = 220
export const BOOK_PREVIEW_CROSSFADE_MS = 180
export const BOOK_PREVIEW_GESTURE_INTENT_PX = 16
export const BOOK_PREVIEW_BOUNDARY_RESISTANCE = 0.28
export const BOOK_PREVIEW_COMMIT_RATIO = 0.28
export const BOOK_PREVIEW_VELOCITY_COMMIT = 0.55
export const BOOK_PREVIEW_SETTLE_MS = 280
export const BOOK_PREVIEW_MOMENTUM_MS = 240

export const bookPreviewMotionStyle = {
  "--book-preview-ease-out": BOOK_PREVIEW_EASE_OUT,
  "--book-preview-press-ms": `${BOOK_PREVIEW_PRESS_MS}ms`,
  "--book-preview-press-scale": String(BOOK_PREVIEW_PRESS_SCALE),
  "--book-preview-ui-ms": `${BOOK_PREVIEW_UI_MS}ms`,
  "--book-preview-crossfade-ms": `${BOOK_PREVIEW_CROSSFADE_MS}ms`,
} as const
