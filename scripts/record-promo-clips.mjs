#!/usr/bin/env node
/**
 * Records the promotions demo's clips from the real reader, so the footage
 * is honest and stays in step with the code. Each scene drives the running
 * app with Playwright, then ffmpeg crops it to the subject and writes a
 * WebM, an MP4 fallback and a still (the poster) to public/promo-clips/.
 *
 *   npm run build && npx next start -p 3410   # in another terminal
 *   node scripts/record-promo-clips.mjs [scene…]
 *
 * Set CLIPS_BASE_URL to record another server. Needs ffmpeg on PATH.
 * Frames come from Chrome's own screencast, so no extra browser download.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const BASE = process.env.CLIPS_BASE_URL ?? 'http://localhost:3410'
const OUT = join(process.cwd(), 'public', 'promo-clips')
const VIEWPORT = { width: 1440, height: 960 }
/** 16:10, the frame every surface shows clips in. */
const SIZE = { width: 960, height: 600 }

const wait = (page, ms) => page.waitForTimeout(ms)

async function openReader(page, query) {
  await page.goto(`${BASE}/exhibition/book-reader?${query}`, {
    waitUntil: 'networkidle',
  })
  await page.waitForFunction(() => {
    const vp = document.querySelector('[data-book-preview-viewport]')
    return Boolean(vp) && !/Loading reader|Opening/.test(vp.textContent ?? '')
  })
  await page
    .locator('[data-book-preview-viewport]')
    .evaluate((el) => el.scrollIntoView({ block: 'center' }))
  await wait(page, 900)
}

/** A slow, eased drag, the way a hand turns a page. */
async function drag(page, from, to, ms = 1100) {
  const steps = Math.round(ms / 16)
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i += 1) {
    const t = i / steps
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    await page.mouse.move(
      from.x + (to.x - from.x) * e,
      from.y + (to.y - from.y) * e - Math.sin(Math.PI * t) * 40,
    )
    await wait(page, 16)
  }
  await page.mouse.up()
}

/** A frame around `box`, grown to 16:10 and kept inside the viewport. */
function frameAround(box, pad = 48) {
  let width = box.width + pad * 2
  let height = box.height + pad * 2
  if (width / height > 1.6) height = width / 1.6
  else width = height * 1.6
  width = Math.min(width, VIEWPORT.width)
  height = Math.min(height, VIEWPORT.height, width / 1.6)
  width = height * 1.6
  const x = Math.max(
    0,
    Math.min(box.x + box.width / 2 - width / 2, VIEWPORT.width - width),
  )
  const y = Math.max(
    0,
    Math.min(box.y + box.height / 2 - height / 2, VIEWPORT.height - height),
  )
  return { x, y, width, height }
}

const SCENES = {
  /** The curl book: two pages turned by hand. */
  async turn(page) {
    await openReader(page, 'doc=celestial&mode=curl&page=2&theme=light')
    const book = await page
      .locator('[data-book-preview-curl-book]')
      .boundingBox()
    const start = await mark(page)
    const y = book.y + book.height * 0.72
    for (let i = 0; i < 2; i += 1) {
      await drag(
        page,
        { x: book.x + book.width * 0.97, y },
        { x: book.x + book.width * 0.08, y: y - 30 },
      )
      await wait(page, 1100)
    }
    // Mid-curl says "page turn" better than the settled last page.
    return {
      start,
      end: await mark(page),
      crop: frameAround(book, 24),
      still: 1.3,
    }
  },

  /** Ink: a marker across a line, a pen underline, a loop round the title. */
  async ink(page) {
    const face = await openPage(page)
    await page.keyboard.press('d')
    await wait(page, 400)
    const at = (x, y) => ({
      x: face.x + face.width * x,
      y: face.y + face.height * y,
    })
    const tool = async (name, colour) => {
      await page.getByRole('button', { name, exact: true }).click()
      await page
        .getByRole('button', { name: `${colour} ink`, exact: true })
        .click()
      await page.mouse.move(at(0.5, 0.95).x, at(0.5, 0.95).y)
    }
    const start = await mark(page)
    await tool('Marker', 'Yellow')
    await stroke(
      page,
      (t) => at(0.07 + t * 0.74, 0.573 + Math.sin(t * 9) * 0.002),
      40,
    )
    await wait(page, 450)
    await tool('Pen', 'Red')
    await stroke(
      page,
      (t) => at(0.4 + t * 0.34, 0.484 + Math.sin(t * 12) * 0.002),
      30,
    )
    await wait(page, 450)
    await tool('Pen', 'Blue')
    await stroke(
      page,
      (t) => {
        const a = -0.2 + t * Math.PI * 2.15
        return at(0.362 + Math.cos(a) * 0.33, 0.352 + Math.sin(a) * 0.04)
      },
      70,
    )
    await wait(page, 1500)
    return { start, end: await mark(page), crop: pageWindow(face) }
  },

  /** Search: type a word, the book narrows to its pages, open one. */
  async search(page) {
    await openReader(
      page,
      'doc=bird&mode=premier&view=single&page=2&theme=light',
    )
    const reader = page.locator('section.book-preview').first()
    await reader.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await wait(page, 500)
    const box = await reader.boundingBox()
    await page.getByRole('button', { name: 'Search pages' }).click()
    await page.getByRole('textbox', { name: 'Search pages' }).click()
    const start = await mark(page)
    await wait(page, 500)
    await page.keyboard.type('owl', { delay: 240 })
    await wait(page, 1300)
    await page.getByRole('button', { name: /Arctic Nomad/ }).click()
    await wait(page, 2000)
    // The reader itself, clear of the lab's floating chrome at the edges.
    const height = box.width / 1.6
    return {
      start,
      end: await mark(page),
      crop: { x: box.x, y: Math.max(0, box.y), width: box.width, height },
    }
  },

  /** Promotions: the bar, a toast arriving, the side card playing. */
  async surfaces(page) {
    await page.goto(`${BASE}/exhibition/promotions#preview`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('[data-promo-theatre]')
    const start = await mark(page)
    await page.waitForSelector('[data-slot=promo-side-card][data-state=docked]')
    await wait(page, 5200)
    return { start, end: await mark(page), crop: belowDock(), still: 4.5 }
  },

  /** Promotions: a story, opened on request, clips as slides. */
  async story(page) {
    await page.goto(`${BASE}/exhibition/promotions#preview`, {
      waitUntil: 'networkidle',
    })
    await wait(page, 1500)
    const start = await mark(page)
    await page.getByRole('button', { name: 'See what’s new' }).click()
    await wait(page, 6500)
    return { start, end: await mark(page), crop: belowDock(), still: 3 }
  },

  /** Promotions: the editor's live preview following the form. */
  async editor(page) {
    await page.goto(`${BASE}/exhibition/promotions`, {
      waitUntil: 'networkidle',
    })
    await page.getByRole('button', { name: 'Editor', exact: true }).click()
    const placement = page.getByText('Placement', { exact: true })
    await placement.evaluate((el) => el.scrollIntoView({ block: 'start' }))
    await page.mouse.wheel(0, -24)
    await wait(page, 600)
    const form = await placement.boundingBox()
    const start = await mark(page)
    await page.getByRole('button', { name: 'Inline card', exact: true }).click()
    await wait(page, 350)
    await page.getByLabel('Title', { exact: true }).click()
    await page.keyboard.type('Write on any page', { delay: 55 })
    await page.getByLabel('Message (optional)', { exact: true }).click()
    await page.keyboard.type('Pen and marker, kept with the page.', {
      delay: 35,
    })
    await page
      .getByLabel('Image URL (optional)', { exact: true })
      .fill('/promo-clips/ink.webp')
    await page
      .getByLabel('Image description', { exact: true })
      .fill('Ink drawn on a page')
    await page
      .getByLabel('Clip (optional)', { exact: true })
      .fill('/promo-clips/ink.webm, /promo-clips/ink.mp4')
    await wait(page, 2600)
    const width = 1040
    return {
      start,
      end: await mark(page),
      crop: { x: form.x - 16, y: form.y - 16, width, height: width / 1.6 },
    }
  },

  /** Paper that suits the light: paper, sepia, dusk, night. */
  async paper(page) {
    const face = await openPage(page)
    await page.getByRole('button', { name: 'Reading settings' }).click()
    await wait(page, 500)
    const start = await mark(page)
    await wait(page, 700)
    for (const name of ['Sepia', 'Dusk', 'Night']) {
      await page.getByRole('button', { name, exact: true }).click()
      await wait(page, 1300)
    }
    // Negative on purpose: pulls the crop inside the page, clear of the
    // settings popover that otherwise shows as a sliver at the edge.
    return { start, end: await mark(page), crop: pageWindow(face, -20) }
  },
}

/** The promotions preview, below its 48px dock, at 16:10. */
function belowDock() {
  const width = VIEWPORT.width
  return { x: 0, y: 48, width, height: width / 1.6 }
}

/** The Bird book's preface, single page, on white paper. */
async function openPage(page) {
  await openReader(page, 'doc=bird&mode=premier&view=single&page=2&theme=light')
  await page.locator('section.book-preview').first().focus()
  return page.locator('[data-bp-inkable]').first().boundingBox()
}

/**
 * A 16:10 window on the preface's title and first paragraphs. `pad` is the
 * margin beside the page; the paper scene keeps it tight so the open
 * settings popover stays out of frame.
 */
function pageWindow(face, pad = 36) {
  const width = face.width + pad * 2
  const height = width / 1.6
  return { x: face.x - pad, y: face.y + face.height * 0.27, width, height }
}

/** A hand-drawn stroke along `path(t)`, t from 0 to 1. */
async function stroke(page, path, steps) {
  const first = path(0)
  await page.mouse.move(first.x, first.y)
  await page.mouse.down()
  for (let i = 1; i <= steps; i += 1) {
    const point = path(i / steps)
    await page.mouse.move(point.x, point.y)
    await wait(page, 14)
  }
  await page.mouse.up()
}

/** Seconds since the scene's screencast began (epoch seconds at start). */
let t0 = 0
const mark = async () => Date.now() / 1000 - t0

/**
 * Screencast frames arrive only when the page paints, each with its time.
 * A concat list holds each frame for as long as it was on screen, which
 * ffmpeg then resamples to a steady 30 fps.
 */
function encode(frames, dir, name, { start, end, crop, still }) {
  const shown = frames.filter((f) => f.t >= start - 0.05 && f.t <= end)
  if (shown.length < 2) throw new Error(`${name}: no frames captured`)
  const lines = []
  shown.forEach((frame, i) => {
    const file = join(dir, `${String(i).padStart(5, '0')}.jpg`)
    writeFileSync(file, Buffer.from(frame.data, 'base64'))
    const next = shown[i + 1]?.t ?? end
    lines.push(
      `file '${file}'`,
      `duration ${Math.max(0.001, next - frame.t).toFixed(4)}`,
    )
  })
  lines.push(
    `file '${join(dir, `${String(shown.length - 1).padStart(5, '0')}.jpg`)}'`,
  )
  const list = join(dir, 'frames.txt')
  writeFileSync(list, lines.join('\n'))
  const c = [crop.width, crop.height, crop.x, crop.y].map(Math.round)
  const filter = `crop=${c.join(':')},scale=${SIZE.width}:${SIZE.height}:flags=lanczos,fps=30,format=yuv420p`
  const input = ['-f', 'concat', '-safe', '0', '-i', list]
  const run = (...args) =>
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], {
      stdio: 'inherit',
    })
  run(
    ...input,
    '-vf',
    filter,
    '-an',
    '-c:v',
    'libvpx-vp9',
    '-crf',
    '40',
    '-b:v',
    '0',
    '-row-mt',
    '1',
    join(OUT, `${name}.webm`),
  )
  run(
    ...input,
    '-vf',
    filter,
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '28',
    '-preset',
    'slow',
    '-movflags',
    '+faststart',
    join(OUT, `${name}.mp4`),
  )
  // The still is also the poster: the last frame (the finished ink), or the
  // moment a scene names with `still`, in seconds into the clip.
  run(
    ...(still === undefined ? ['-sseof', '-0.1'] : ['-ss', String(still)]),
    '-i',
    join(OUT, `${name}.mp4`),
    '-frames:v',
    '1',
    '-q:v',
    '82',
    join(OUT, `${name}.webp`),
  )
}

mkdirSync(OUT, { recursive: true })
const wanted = process.argv.slice(2)
const names = wanted.length ? wanted : Object.keys(SCENES)
const browser = await chromium.launch({ channel: 'chrome' })
for (const name of names) {
  const scene = SCENES[name]
  if (!scene) throw new Error(`Unknown scene: ${name}`)
  const dir = mkdtempSync(join(tmpdir(), 'promo-clip-'))
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ data, t: metadata.timestamp - t0 })
    void cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  t0 = Date.now() / 1000
  await cdp.send('Page.startScreencast', {
    format: 'jpeg',
    quality: 95,
    maxWidth: VIEWPORT.width,
    maxHeight: VIEWPORT.height,
  })
  const timing = await scene(page)
  await cdp.send('Page.stopScreencast')
  await context.close()
  encode(frames, dir, name, timing)
  rmSync(dir, { recursive: true, force: true })
  console.log(`${name}: ${(timing.end - timing.start).toFixed(1)}s`)
}
await browser.close()
