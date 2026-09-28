import type * as React from 'react'

/**
 * Finished looks for every promotion surface, made only of the `--promo-*`
 * tokens the surfaces already read, so a preset never forks a component.
 *
 * Surfaces portal into `<body>`, so set a preset where they inherit it:
 *
 * ```tsx
 * <body style={promotionThemes.editorial}>
 * ```
 *
 * Or spread one and override a token: `{ ...promotionThemes.bold,
 * '--promo-highlight': 'oklch(0.7 0.15 30)' }`.
 */
export const promotionThemes = {
  /** Quiet and bookish: small corners, a serif for titles, soft highlights. */
  editorial: {
    '--promo-radius': '0.25rem',
    '--promo-display':
      'ui-serif, "Iowan Old Style", "Palatino Linotype", Georgia, serif',
    '--promo-highlight':
      'color-mix(in oklch, var(--foreground) 6%, var(--background))',
    '--promo-highlight-foreground': 'var(--foreground)',
  },
  /** Technical: square corners, monospaced titles, an inverted highlight. */
  mono: {
    '--promo-radius': '0rem',
    '--promo-display':
      'ui-monospace, "SFMono-Regular", "JetBrains Mono", Menlo, monospace',
    '--promo-highlight': 'var(--foreground)',
    '--promo-highlight-foreground': 'var(--background)',
  },
  /** Loud on purpose: generous corners and the brand colour as highlight. */
  bold: {
    '--promo-radius': '1.25rem',
    '--promo-display': 'inherit',
    '--promo-highlight': 'var(--primary)',
    '--promo-highlight-foreground': 'var(--primary-foreground)',
  },
} as const satisfies Record<string, Record<`--promo-${string}`, string>>

export type PromotionThemeName = keyof typeof promotionThemes

/** A preset as a `style` value (CSS custom properties are not in CSSProperties). */
export function promotionThemeStyle(
  name: PromotionThemeName,
): React.CSSProperties {
  return promotionThemes[name] as React.CSSProperties
}
