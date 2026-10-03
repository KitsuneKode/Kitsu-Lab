import { expect, test, type Page } from '@playwright/test'

import { openReader, urlPage } from './helpers'

/**
 * With prefers-reduced-motion, nothing moves on its own: no running CSS or
 * WAAPI animation once a page settles, no clip playing, no cover lift. The
 * controls prove the same pages do move when motion is allowed, so these
 * checks can't pass vacuously.
 */

const PAGES = [
  '/',
  '/pro',
  '/exhibition/promotions',
  '/exhibition/keyboard',
  '/exhibition/email-domain',
  '/exhibition/book-reader?doc=bird&mode=premier&view=single&page=4',
  '/exhibition/book-reader?doc=bird&mode=curl&page=1',
]

function motionReport(page: Page) {
  return page.evaluate(
    (FADES) => ({
      animations: document
        .getAnimations()
        .filter((animation) => animation.playState === 'running')
        // Reduced motion means nothing moves; a fade or a colour change is
        // still fine, and is what the components fall back to.
        .filter(
          (animation) =>
            !(
              animation instanceof CSSTransition &&
              FADES.includes(animation.transitionProperty)
            ),
        )
        .map((animation) => {
          const target = (animation.effect as KeyframeEffect | null)?.target
          return `${(animation as CSSAnimation).animationName ?? 'script'} on ${target?.getAttribute('class')?.slice(0, 60) ?? target?.tagName}`
        }),
      playing: [...document.querySelectorAll('video')].filter((v) => !v.paused)
        .length,
      coverLifted: Object.keys(localStorage).some((key) =>
        key.startsWith('book-preview:opened:'),
      ),
    }),
    FADES,
  )
}

const FADES = [
  'opacity',
  'color',
  'background-color',
  'border-color',
  'outline-color',
  'box-shadow',
]

test.skip(({ isMobile }) => isMobile, 'one viewport is enough')

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  for (const path of PAGES) {
    test(`still: ${path}`, async ({ page }) => {
      await page.goto(path, { waitUntil: 'networkidle' })
      // Longer than any entrance, autoplay delay or first-open lift.
      await page.waitForTimeout(2500)
      expect(await motionReport(page)).toEqual({
        animations: [],
        playing: 0,
        coverLifted: false,
      })
    })
  }

  test('a curl turn lands at once', async ({ page }) => {
    await openReader(page, 'doc=celestial&mode=curl&page=2')
    await page.locator('.book-preview').first().focus()
    const before = urlPage(page)
    await page.keyboard.press('ArrowRight')
    // A page or a whole spread, depending on the width; either way, now.
    await expect
      .poll(() => urlPage(page), { timeout: 150 })
      .toBeGreaterThan(before)
    expect((await motionReport(page)).animations).toEqual([])
  })
})

test.describe('with motion (controls)', () => {
  test('the pro page plays its clip', async ({ page }) => {
    await page.goto('/pro', { waitUntil: 'networkidle' })
    await expect.poll(async () => (await motionReport(page)).playing).toBe(1)
  })

  test('a hardcover lifts on first open', async ({ page }) => {
    await page.goto('/exhibition/book-reader?doc=bird&mode=curl&page=1', {
      waitUntil: 'networkidle',
    })
    await expect
      .poll(async () => (await motionReport(page)).coverLifted)
      .toBe(true)
  })
})
