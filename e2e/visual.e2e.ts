import { expect, test, type Page } from '@playwright/test'

import { openReader, useSiteTheme } from './helpers'

/**
 * Screenshot baselines for the promotion surfaces and each reader engine,
 * at phone, tablet and desktop widths, light and dark.
 *
 * Runs only in the Playwright Docker image (the `visual` project), locally
 * and in CI alike, so fonts and rasterisation match: `npm run
 * test:visual:update` regenerates baselines, `npm run test:visual` checks.
 * The clock is fixed and motion reduced, so countdowns, clips and entrances
 * hold still.
 */

const WIDTHS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

const STATES: {
  name: string
  open: (page: Page, scheme: 'light' | 'dark') => Promise<void>
  /** The region to capture; the whole viewport when omitted. */
  target?: string
}[] = [
  {
    name: 'promotions-site',
    open: async (page) => {
      await page.goto('/exhibition/promotions', { waitUntil: 'networkidle' })
    },
  },
  {
    name: 'promotions-editor',
    open: async (page) => {
      await page.goto('/exhibition/promotions', { waitUntil: 'networkidle' })
      await page
        .getByRole('group', { name: 'Demo view' })
        .getByRole('button', { name: 'Editor', exact: true })
        .click()
    },
  },
  {
    name: 'reader-premier',
    open: (page, scheme) =>
      openReader(
        page,
        `doc=bird&mode=premier&view=single&page=4&theme=${scheme}`,
      ),
    target: '.book-preview',
  },
  {
    name: 'reader-curl',
    open: (page, scheme) =>
      openReader(page, `doc=celestial&mode=curl&page=2&theme=${scheme}`),
    target: '.book-preview',
  },
  {
    name: 'reader-scroll',
    open: (page, scheme) =>
      openReader(page, `doc=celestial&mode=scroll&theme=${scheme}`),
    target: '.book-preview',
  },
  {
    name: 'reader-text',
    // Sepia in the light run, to cover a paper with grain.
    open: (page, scheme) =>
      openReader(
        page,
        `doc=bird&mode=premier&view=text&page=3&theme=${scheme === 'light' ? 'sepia' : 'dark'}`,
      ),
    target: '.book-preview',
  },
]

test.use({ reducedMotion: 'reduce' })

for (const scheme of ['light', 'dark'] as const) {
  for (const size of WIDTHS) {
    test.describe(`${scheme} ${size.name}`, () => {
      test.use({ viewport: { width: size.width, height: size.height } })

      for (const state of STATES) {
        test(state.name, async ({ page }) => {
          await page.clock.setFixedTime(new Date('2026-09-28T10:00:00Z'))
          await useSiteTheme(page, scheme)
          await state.open(page, scheme)
          await page.evaluate(() => document.fonts.ready)
          await page.waitForTimeout(500)
          const shot = `${state.name}-${scheme}-${size.name}.png`
          const options = { animations: 'disabled', caret: 'hide' } as const
          if (state.target)
            await expect(page.locator(state.target).first()).toHaveScreenshot(
              shot,
              options,
            )
          else await expect(page).toHaveScreenshot(shot, options)
        })
      }
    })
  }
}
