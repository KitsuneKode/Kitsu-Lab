import type { Page } from '@playwright/test'

export const READER = '/exhibition/book-reader'

/** Opens the demo reader and waits for the engine to settle. */
export async function openReader(page: Page, query: string) {
  await page.goto(`${READER}?${query}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => {
    const vp = document.querySelector('[data-book-preview-viewport]')
    return (
      Boolean(vp) && !/Loading reader|Opening PDF/.test(vp!.textContent ?? '')
    )
  })
  await page.waitForTimeout(400)
}

/** The 1-based page in the URL (the reader mirrors it with urlState). */
export function urlPage(page: Page): number {
  return Number(new URL(page.url()).searchParams.get('page') ?? '1')
}

/** Curl leaves currently on screen, as "index@left" — spreads show two. */
export function visibleLeaves(page: Page) {
  return page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>('[data-book-preview-curl-leaf]'),
    )
      .filter((el) => el.style.visibility === 'visible')
      .map((el) => Number(el.dataset.bookPreviewCurlLeaf)),
  )
}

export async function bookBox(page: Page) {
  const box = await page.locator('[data-book-preview-curl-book]').boundingBox()
  if (!box) throw new Error('curl book not visible')
  return box
}

/** A horizontal mouse drag across the curl book, in fractions of its size. */
export async function dragBook(
  page: Page,
  fromX: number,
  toX: number,
  y = 0.7,
  steps = 16,
  /** Hold before letting go; 0 releases mid-motion, as a flick does. */
  pauseMs = 120,
) {
  const b = await bookBox(page)
  await page.mouse.move(b.x + b.width * fromX, b.y + b.height * y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(
      b.x + b.width * (fromX + ((toX - fromX) * i) / steps),
      b.y + b.height * y,
    )
    await page.waitForTimeout(16)
  }
  if (pauseMs > 0) await page.waitForTimeout(pauseMs)
  await page.mouse.up()
  await page.waitForTimeout(900)
}
