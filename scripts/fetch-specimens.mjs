// Fetch the large demo PDFs at build time. They are public documents kept
// out of git (public/specimens/ is gitignored) so the repo stays lean —
// Vercel builds pull them here instead. Never fails the build: a missing
// specimen is hidden by the demo's reachability probe anyway.

import { createWriteStream } from 'node:fs'
import { mkdir, stat, open } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const SPECIMENS = [
  {
    file: 'attention-is-all-you-need.pdf',
    url: 'https://arxiv.org/pdf/1706.03762',
    minBytes: 500_000,
  },
  {
    file: 'elements-of-statistical-learning.pdf',
    url: 'https://archive.org/download/the-elements-of-statistical-learning-data-mining-inference-and-prediction-2nd-ed/The%20Elements%20of%20Statistical%20Learning%20Data%20Mining%2C%20Inference%2C%20and%20Prediction%20%282nd%20edition%29%20%2812print%202017%29%20by%20Trevor%20Hastie%2C%20Robert%20Tibshirani%2C%20Jerome%20Friedm.pdf',
    minBytes: 5_000_000,
  },
]

const DIR = path.join(process.cwd(), 'public', 'specimens')
const TIMEOUT_MS = 120_000

async function isValidPdf(file) {
  try {
    const info = await stat(file)
    if (info.size < 1_000) return false
    const handle = await open(file, 'r')
    const head = Buffer.alloc(5)
    await handle.read(head, 0, 5, 0)
    await handle.close()
    return head.toString('latin1') === '%PDF-'
  } catch {
    return false
  }
}

async function fetchSpecimen({ file, url, minBytes }) {
  const dest = path.join(DIR, file)
  if (await isValidPdf(dest)) {
    console.log(`specimen present, skipping: ${file}`)
    return
  }
  console.log(`fetching specimen: ${file}`)
  const res = await fetch(url, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: 'follow',
    headers: { 'User-Agent': 'kitsu-lab-build/1.0' },
  })
  if (!res.ok || !res.body) {
    throw new Error(`${res.status} fetching ${file}`)
  }
  const tmp = `${dest}.tmp`
  await pipeline(res.body, createWriteStream(tmp))
  const { rename } = await import('node:fs/promises')
  await rename(tmp, dest)
  const info = await stat(dest)
  if (info.size < minBytes || !(await isValidPdf(dest))) {
    throw new Error(`fetched ${file} failed PDF validation (${info.size}B)`)
  }
  console.log(`specimen ok: ${file} (${(info.size / 1e6).toFixed(1)}MB)`)
}

try {
  await mkdir(DIR, { recursive: true })
  for (const s of SPECIMENS) await fetchSpecimen(s)
} catch (err) {
  console.warn(`specimen fetch failed (demo falls back to samples): ${err}`)
}
