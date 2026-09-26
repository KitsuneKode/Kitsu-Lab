import { expect, test } from '@playwright/test'
import { dragBook, openReader, READER, urlPage, visibleLeaves } from './helpers'

const desktopOnly = (name: string) =>
  test.skip(name !== 'desktop', 'desktop layout')
const phoneOnly = (name: string) => test.skip(name !== 'phone', 'phone layout')

test.describe('switching modes', () => {
  test('never leaves the reader stuck loading', async ({ page }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=page&page=1')
    const picker = page.locator('[aria-label="Reader mode"]')
    for (const mode of ['Premier', 'Curl', 'Scroll', 'Spread', 'Slide']) {
      await picker.getByText(mode, { exact: true }).click()
      await expect(
        page.locator('[data-book-preview-viewport]'),
      ).not.toContainText('Loading reader', { timeout: 15_000 })
    }
  })
})

test.describe('curl book, single page (phone)', () => {
  test('a short drag settles back; a long drag and a flick turn', async ({
    page,
  }, info) => {
    phoneOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=curl&page=3')
    await page.locator('[data-book-preview-curl-book]').scrollIntoViewIfNeeded()
    await dragBook(page, 0.92, 0.7)
    expect(urlPage(page)).toBe(3)
    await dragBook(page, 0.92, 0.3)
    expect(urlPage(page)).toBe(4)
    // A flick: short, fast, released while still moving.
    await dragBook(page, 0.9, 0.72, 0.7, 3, 0)
    expect(urlPage(page)).toBe(5)
    await dragBook(page, 0.08, 0.7)
    expect(urlPage(page)).toBe(4)
  })

  test('dragging past the last page leaves the book usable', async ({
    page,
  }, info) => {
    phoneOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=curl&page=7')
    await page.locator('[data-book-preview-curl-book]').scrollIntoViewIfNeeded()
    await dragBook(page, 0.92, 0.3)
    expect(urlPage(page)).toBe(7)
    await page.locator('section.book-preview').focus()
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => urlPage(page)).toBe(6)
  })
})

test.describe('curl book, spreads (desktop)', () => {
  test('a book opens on its cover alone, then pairs (2|3)', async ({
    page,
  }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=curl&page=1')
    await expect.poll(() => visibleLeaves(page)).toEqual([0])
    await page.locator('section.book-preview').focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => visibleLeaves(page)).toEqual([1, 2])
    expect(urlPage(page)).toBe(2)
  })

  test('a PDF pairs (1|2) from the first page', async ({ page }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=pdf&file=sample-book.pdf&mode=curl&page=1')
    await expect.poll(() => visibleLeaves(page)).toEqual([0, 1])
  })

  test('End lands on the last spread and Next disables', async ({
    page,
  }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=curl&page=1')
    await page.locator('section.book-preview').focus()
    await page.keyboard.press('End')
    await expect.poll(() => urlPage(page)).toBe(7)
    await expect(
      page.locator(
        '[data-book-preview-chrome=bottom] [aria-label="Next page"]',
      ),
    ).toBeDisabled()
  })

  test('One page in Aa turns spreads off', async ({ page }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=curl&page=2')
    await page.getByLabel('Reading settings').click()
    await page.getByLabel('One', { exact: true }).click()
    await page.keyboard.press('Escape')
    await expect.poll(() => visibleLeaves(page)).toEqual([1])
  })
})

test.describe('side arrows', () => {
  test('fade in on hover and turn the page', async ({ page }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=page&page=2')
    const next = page.locator('[data-book-preview-side-arrow=right]')
    await expect(next).toHaveCSS('opacity', '0')
    await page.locator('[data-book-preview-viewport]').hover()
    await expect(next).not.toHaveCSS('opacity', '0')
    await next.click()
    await expect.poll(() => urlPage(page)).toBe(3)
  })

  test('are visible on touch', async ({ page }, info) => {
    phoneOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=page&page=2')
    await expect(
      page.locator('[data-book-preview-side-arrow=right]'),
    ).not.toHaveCSS('opacity', '0')
  })
})

test.describe('fullscreen chrome', () => {
  test('hides when idle, returns at the edge, toggles with C', async ({
    page,
  }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=premier&view=book&page=2')
    await page.getByLabel('Enter fullscreen').click()
    const root = page.locator('section.book-preview')
    await page.mouse.move(700, 450)
    await expect(root).toHaveAttribute('data-chrome-hidden', { timeout: 5000 })
    // Moving across the page is reading: the chrome stays away.
    for (let i = 0; i < 8; i += 1) await page.mouse.move(500 + i * 30, 420)
    await expect(root).toHaveAttribute('data-chrome-hidden')
    await page.mouse.move(700, 30, { steps: 4 })
    await expect(root).not.toHaveAttribute('data-chrome-hidden')
    await page.keyboard.press('c')
    await expect(root).toHaveAttribute('data-chrome-hidden')
    await page.keyboard.press('c')
    await expect(root).not.toHaveAttribute('data-chrome-hidden')
  })

  test('? lists the keyboard shortcuts', async ({ page }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=page&page=2')
    await page.locator('section.book-preview').focus()
    await page.keyboard.press('?')
    await expect(
      page.getByText('Keyboard shortcuts', { exact: true }),
    ).toBeVisible()
  })
})

test.describe('coming back', () => {
  test('resumes where you left off, and offers your page on a shared link', async ({
    page,
  }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=celestial&mode=page&page=5')
    await openReader(page, 'doc=celestial&mode=page')
    const notice = page.locator('[data-book-preview-resume]')
    await expect(notice).toContainText('Picked up on page 5')
    await openReader(page, 'doc=celestial&mode=page&page=2')
    await expect(notice).toContainText('You were on page 5')
    await notice.getByRole('button', { name: 'Go there' }).click()
    await expect.poll(() => urlPage(page)).toBe(5)
  })
})

test.describe('PDF', () => {
  test('pages paint (the legacy pdf.js build covers older engines)', async ({
    page,
  }, info) => {
    desktopOnly(info.project.name)
    await openReader(page, 'doc=pdf&file=sample-book.pdf&mode=curl&page=1')
    await expect
      .poll(() => page.locator('[data-book-preview-sheet-img][src]').count(), {
        timeout: 15_000,
      })
      .toBeGreaterThan(1)
  })
})

test.describe('layout', () => {
  for (const mode of ['page', 'premier&view=book', 'curl', 'scroll']) {
    test(`no horizontal overflow — ${mode}`, async ({ page }) => {
      await page.goto(`${READER}?doc=celestial&mode=${mode}&page=2`, {
        waitUntil: 'networkidle',
      })
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
})
