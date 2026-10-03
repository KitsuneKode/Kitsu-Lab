import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

import { openReader, useSiteTheme } from './helpers'

/**
 * axe over every exhibit state a visitor can reach: pages, demo tabs,
 * opened surfaces, each reader view. Serious and critical findings fail;
 * the rest are for triage. Runs in light and dark.
 */

async function audit(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  const blocking = violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  const report = blocking.map(
    (v) =>
      `${v.impact} ${v.id}: ${v.help}\n` +
      v.nodes
        .slice(0, 4)
        .map(
          (n) =>
            `    ${n.target.join(' ')}\n      ${n.failureSummary?.split('\n').slice(1, 2).join('')}`,
        )
        .join('\n'),
  )
  expect(report, report.join('\n')).toEqual([])
}

const PROMOTIONS = '/exhibition/promotions'

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`${scheme}`, () => {
    test.beforeEach(({ page }) => useSiteTheme(page, scheme))

    for (const path of [
      '/',
      '/pro',
      '/exhibition/keyboard',
      '/exhibition/email-domain',
    ]) {
      test(`page ${path}`, async ({ page }) => {
        await page.goto(path, { waitUntil: 'networkidle' })
        await audit(page)
      })
    }

    for (const tab of ['Live site', 'Editor', 'Results', 'Docs']) {
      test(`promotions: ${tab}`, async ({ page }) => {
        await page.goto(PROMOTIONS, { waitUntil: 'networkidle' })
        await page
          .getByRole('group', { name: 'Demo view' })
          .getByRole('button', { name: tab, exact: true })
          .click()
        await page.waitForTimeout(400)
        await audit(page)
      })
    }

    test('promotions: changelog and tour open', async ({ page }) => {
      await page.goto(PROMOTIONS, { waitUntil: 'networkidle' })
      const changelog = page
        .locator('[data-slot="promo-changelog-trigger"]')
        .locator('visible=true')
        .first()
      await changelog.click()
      await page.waitForTimeout(400)
      await audit(page)
      await page.keyboard.press('Escape')
      await page.getByRole('button', { name: 'Take the tour' }).first().click()
      await page.waitForTimeout(600)
      await audit(page)
    })

    for (const query of [
      'doc=bird&mode=page',
      'doc=bird&mode=premier&view=single&page=4',
      'doc=bird&mode=premier&view=spread&page=4',
      'doc=bird&mode=premier&view=scroll',
      'doc=bird&mode=premier&view=text&page=3',
      'doc=bird&mode=curl&page=2',
      'doc=bird&mode=archival-curl&page=2',
      'doc=celestial&mode=scroll',
      'doc=celestial&mode=spread',
    ]) {
      test(`reader: ${query}`, async ({ page }) => {
        await openReader(page, `${query}&theme=${scheme}`)
        await audit(page)
      })
    }

    test('reader: a hotspot card open', async ({ page }) => {
      await openReader(page, 'doc=bird&mode=premier&view=single&page=4')
      await page.locator('[data-bp-hotspot]').first().click()
      await page.waitForTimeout(300)
      await audit(page)
    })
  })
}
