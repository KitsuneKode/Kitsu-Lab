/**
 * Reader typography — the "Aa" settings. Pure data and CSS-variable mapping,
 * no DOM, so bun can test it. Text pages and the premier text view read these
 * variables; rasterized PDF pages are pictures of type and are unaffected.
 */

export const TYPOGRAPHY_FONTS = ['serif', 'sans', 'readable', 'mono'] as const
export type TypographyFont = (typeof TYPOGRAPHY_FONTS)[number]

export const TYPOGRAPHY_SPACINGS = ['compact', 'normal', 'relaxed'] as const
export type TypographySpacing = (typeof TYPOGRAPHY_SPACINGS)[number]

export const TYPOGRAPHY_WIDTHS = ['narrow', 'normal', 'wide'] as const
export type TypographyWidth = (typeof TYPOGRAPHY_WIDTHS)[number]

export type BookPreviewTypography = {
  /** Multiplier over the page's own type size, 0.8 – 1.6. */
  scale: number
  font: TypographyFont
  spacing: TypographySpacing
  width: TypographyWidth
  justify: boolean
}

export const DEFAULT_TYPOGRAPHY: BookPreviewTypography = {
  scale: 1,
  font: 'serif',
  spacing: 'normal',
  width: 'normal',
  justify: false,
}

export const TYPOGRAPHY_SCALE_MIN = 0.8
export const TYPOGRAPHY_SCALE_MAX = 1.6
export const TYPOGRAPHY_SCALE_STEP = 0.1

export function stepTypographyScale(scale: number, direction: 1 | -1) {
  const next = Math.round((scale + direction * TYPOGRAPHY_SCALE_STEP) * 10) / 10
  return Math.min(TYPOGRAPHY_SCALE_MAX, Math.max(TYPOGRAPHY_SCALE_MIN, next))
}

const FONT_STACKS: Record<TypographyFont, string> = {
  serif:
    'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  // Wide apertures and distinct letterforms (b/d, I/l/1) — the traits that
  // help dyslexic and low-vision readers — from fonts already on the device.
  readable:
    '"Atkinson Hyperlegible", "Atkinson Hyperlegible Next", Verdana, Tahoma, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
}

const LINE_HEIGHTS: Record<TypographySpacing, number> = {
  compact: 1.45,
  normal: 1.7,
  relaxed: 1.95,
}

/** Characters per line, the measure typographers actually tune by. */
const MEASURES: Record<TypographyWidth, string> = {
  narrow: '32rem',
  normal: '40rem',
  wide: '52rem',
}

export function typographyVariables(
  typography: BookPreviewTypography,
): Record<string, string> {
  return {
    '--bp-type-scale': String(typography.scale),
    '--bp-type-family': FONT_STACKS[typography.font],
    '--bp-type-leading': String(LINE_HEIGHTS[typography.spacing]),
    '--bp-type-measure': MEASURES[typography.width],
    '--bp-type-align': typography.justify ? 'justify' : 'start',
    '--bp-type-tracking': typography.font === 'readable' ? '0.02em' : 'normal',
  }
}

/** Validates an untrusted stored value field by field, keeping the defaults
    for anything malformed. */
export function sanitizeTypography(raw: unknown): BookPreviewTypography {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_TYPOGRAPHY }
  const value = raw as Record<string, unknown>
  const scale =
    typeof value.scale === 'number' && Number.isFinite(value.scale)
      ? Math.min(
          TYPOGRAPHY_SCALE_MAX,
          Math.max(TYPOGRAPHY_SCALE_MIN, value.scale),
        )
      : DEFAULT_TYPOGRAPHY.scale
  const pick = <T extends string>(input: unknown, allowed: readonly T[]) =>
    typeof input === 'string' && (allowed as readonly string[]).includes(input)
      ? (input as T)
      : null
  return {
    scale,
    font: pick(value.font, TYPOGRAPHY_FONTS) ?? DEFAULT_TYPOGRAPHY.font,
    spacing:
      pick(value.spacing, TYPOGRAPHY_SPACINGS) ?? DEFAULT_TYPOGRAPHY.spacing,
    width: pick(value.width, TYPOGRAPHY_WIDTHS) ?? DEFAULT_TYPOGRAPHY.width,
    justify:
      typeof value.justify === 'boolean'
        ? value.justify
        : DEFAULT_TYPOGRAPHY.justify,
  }
}
