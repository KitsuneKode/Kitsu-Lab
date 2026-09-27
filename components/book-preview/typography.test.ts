import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_TYPOGRAPHY,
  TYPOGRAPHY_SCALE_MAX,
  TYPOGRAPHY_SCALE_MIN,
  sanitizeTypography,
  stepTypographyScale,
  typographyVariables,
} from './typography'

describe('typography', () => {
  test('stepTypographyScale moves in tenths and clamps', () => {
    expect(stepTypographyScale(1, 1)).toBe(1.1)
    expect(stepTypographyScale(1, -1)).toBe(0.9)
    expect(stepTypographyScale(TYPOGRAPHY_SCALE_MAX, 1)).toBe(
      TYPOGRAPHY_SCALE_MAX,
    )
    expect(stepTypographyScale(TYPOGRAPHY_SCALE_MIN, -1)).toBe(
      TYPOGRAPHY_SCALE_MIN,
    )
    // No float drift after many steps.
    let scale = 1
    for (let i = 0; i < 4; i++) scale = stepTypographyScale(scale, 1)
    expect(scale).toBe(1.4)
  })

  test('sanitizeTypography keeps valid fields and repairs the rest', () => {
    expect(sanitizeTypography(null)).toEqual(DEFAULT_TYPOGRAPHY)
    expect(
      sanitizeTypography({ scale: 9, font: 'comic', spacing: 'relaxed' }),
    ).toEqual({
      ...DEFAULT_TYPOGRAPHY,
      scale: TYPOGRAPHY_SCALE_MAX,
      spacing: 'relaxed',
    })
    expect(sanitizeTypography({ justify: 'yes', width: 'wide' })).toEqual({
      ...DEFAULT_TYPOGRAPHY,
      width: 'wide',
    })
  })

  test('typographyVariables maps every setting to a variable', () => {
    const vars = typographyVariables({
      scale: 1.2,
      font: 'readable',
      spacing: 'compact',
      width: 'narrow',
      justify: true,
    })
    expect(vars['--bp-type-scale']).toBe('1.2')
    expect(vars['--bp-type-align']).toBe('justify')
    expect(vars['--bp-type-tracking']).toBe('0.02em')
    expect(vars['--bp-type-measure']).toBe('32rem')
    expect(Number(vars['--bp-type-leading'])).toBeLessThan(1.7)
  })
})
