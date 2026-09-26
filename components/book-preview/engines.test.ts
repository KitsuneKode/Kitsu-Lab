import { describe, expect, test } from 'bun:test'
import {
  describeEngineLoadFailure,
  pageEngine,
  resolveActiveEngine,
  resolveCompatibleEngines,
  resolveEnabledEngines,
  shouldPrefetchEngines,
} from './engines'
import {
  CURL_MAX_PAGE_WIDTH,
  CURL_MIN_PAGE_WIDTH,
  CURL_PAGE_RATIO,
  CURL_SIZE_QUANTUM,
  curlClickIntent,
  curlReleaseVelocity,
  curlShouldCommit,
  CURL_COMMIT_PROGRESS,
  CURL_COMMIT_VELOCITY,
  curlPageSizeForStage,
  quantizeCurlPageSize,
  curlUseSpread,
  curlSpreadStart,
  curlStepTarget,
  curlResolveSpread,
} from './engines/curl-geometry'
import { normalizeSource } from './normalize'
import type { BookPreviewEngine } from './types'

const pdfEngine: BookPreviewEngine = {
  ...pageEngine,
  id: 'pdf',
  label: 'PDF',
  requiresPages: false,
  requiresPdf: true,
  load: pageEngine.load,
}

describe('engine resolution', () => {
  test('defaults to the page engine', () => {
    const source = normalizeSource({
      pages: [{ id: '1', pageNumber: 1, title: 'Cover' }],
    })
    const resolved = resolveActiveEngine({
      requestedMode: 'page',
      engines: resolveEnabledEngines(undefined, undefined),
      source,
    })
    expect(resolved.engine?.id).toBe('page')
    expect(resolved.unsupported).toBe(false)
  })

  test('falls back when a requested engine is incompatible', () => {
    const source = normalizeSource({
      pages: [{ id: '1', pageNumber: 1, title: 'Cover' }],
    })
    const resolved = resolveActiveEngine({
      requestedMode: 'pdf',
      engines: [pageEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe('page')
    expect(resolved.fallback).toBe(true)
  })

  test('keeps pdf when a document source exists', () => {
    const source = normalizeSource({ pdfUrl: '/sample-book.pdf' })
    const resolved = resolveActiveEngine({
      requestedMode: 'pdf',
      engines: [pageEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe('pdf')
  })

  test('keeps curl when only a PDF source exists', () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'curl',
      label: 'Curl',
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ pdfUrl: '/sample-book.pdf' })
    const resolved = resolveActiveEngine({
      requestedMode: 'curl',
      engines: [pageEngine, curlEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe('curl')
  })

  test('keeps scroll when only a PDF source exists', () => {
    const scrollEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'scroll',
      label: 'Scroll',
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ pdfUrl: '/sample-book.pdf' })
    const resolved = resolveActiveEngine({
      requestedMode: 'scroll',
      engines: [pageEngine, scrollEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe('scroll')
  })

  test('prefers the document reader over showcase modes for a PDF source', () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'curl',
      label: 'Curl',
      requiresPages: false,
      load: pageEngine.load,
    }
    const scrollEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'scroll',
      label: 'Scroll',
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ pdfUrl: '/sample-book.pdf' })
    const resolved = resolveActiveEngine({
      // "page" cannot render a document, so the source-aware preference picks.
      requestedMode: 'page',
      engines: [pageEngine, curlEngine, scrollEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe('pdf')
    expect(resolved.fallback).toBe(true)
  })

  test('falls back to scroll for a PDF source without the pdf engine', () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'curl',
      label: 'Curl',
      requiresPages: false,
      load: pageEngine.load,
    }
    const scrollEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'scroll',
      label: 'Scroll',
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ pdfUrl: '/sample-book.pdf' })
    const resolved = resolveActiveEngine({
      requestedMode: 'page',
      engines: [pageEngine, curlEngine, scrollEngine],
      source,
    })
    expect(resolved.engine?.id).toBe('scroll')
    expect(resolved.fallback).toBe(true)
  })

  test('lands on the pdf engine for an upload-only source', () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'curl',
      label: 'Curl',
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ allowPdfUpload: true })
    const resolved = resolveActiveEngine({
      requestedMode: 'curl',
      engines: [pageEngine, curlEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe('pdf')
  })

  test('document modes stay hidden until an upload exists', () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'curl',
      label: 'Curl',
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ allowPdfUpload: true })
    expect(
      resolveCompatibleEngines([pageEngine, curlEngine, pdfEngine], source).map(
        (engine) => engine.id,
      ),
    ).toEqual(['pdf'])
  })

  test('premier stays available on an upload-only source', () => {
    const premierEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'premier',
      label: 'Premier',
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ allowPdfUpload: true })
    expect(
      resolveCompatibleEngines([pageEngine, premierEngine], source).map(
        (engine) => engine.id,
      ),
    ).toEqual(['premier'])
  })

  test('premier renders both page data and PDFs', () => {
    const premierEngine: BookPreviewEngine = {
      ...pageEngine,
      id: 'premier',
      label: 'Premier',
      requiresPages: false,
      load: pageEngine.load,
    }
    const paged = normalizeSource({
      pages: [{ id: '1', pageNumber: 1, title: 'Cover' }],
    })
    const document = normalizeSource({ pdfUrl: '/sample-book.pdf' })
    expect(
      resolveActiveEngine({
        requestedMode: 'premier',
        engines: [pageEngine, premierEngine],
        source: paged,
      }).engine?.id,
    ).toBe('premier')
    expect(
      resolveActiveEngine({
        requestedMode: 'premier',
        engines: [pageEngine, premierEngine],
        source: document,
      }).engine?.id,
    ).toBe('premier')
  })

  test('filters mode choices to engines that can render the current source', () => {
    const source = normalizeSource({
      pages: [{ id: '1', pageNumber: 1, title: 'Cover' }],
    })
    expect(
      resolveCompatibleEngines([pageEngine, pdfEngine], source).map(
        (engine) => engine.id,
      ),
    ).toEqual(['page'])
  })

  test('does not evaluate browser support while resolving the render tree', () => {
    let checks = 0
    const webgl: BookPreviewEngine = {
      ...pageEngine,
      id: 'webgl',
      label: 'WebGL',
      isSupported: () => {
        checks += 1
        return false
      },
    }
    const source = normalizeSource({
      pages: [{ id: '1', pageNumber: 1, title: 'Cover' }],
    })
    expect(
      resolveCompatibleEngines([pageEngine, webgl], source).map(
        (engine) => engine.id,
      ),
    ).toEqual(['page', 'webgl'])
    expect(
      resolveActiveEngine({
        requestedMode: 'webgl',
        engines: [pageEngine, webgl],
        source,
      }).engine?.id,
    ).toBe('webgl')
    expect(checks).toBe(0)
  })
})

describe('engine load recovery', () => {
  test('tells the user to reload after a failed import', () => {
    expect(describeEngineLoadFailure('Spread')).toBe(
      'The Spread reader failed to load. Reload the page, then try this mode again.',
    )
  })

  test('does not prefetch engines outside production', () => {
    expect(shouldPrefetchEngines()).toBe(process.env.NODE_ENV === 'production')
  })
})

describe('curl stage sizing', () => {
  test('keeps a readable page on a phone', () => {
    const size = curlPageSizeForStage(390, 700)
    expect(size.width).toBeGreaterThanOrEqual(CURL_MIN_PAGE_WIDTH)
    expect(size.width).toBeLessThanOrEqual(390)
    expect(size.height / size.width).toBeCloseTo(530 / 370, 2)
  })

  test('grows up to the large-screen cap', () => {
    // A 1400px page is ~2005px tall at the 370:530 ratio, so the cap is only
    // reachable on a stage tall enough to contain it.
    const size = curlPageSizeForStage(3200, 2200)
    expect(size.width).toBe(CURL_MAX_PAGE_WIDTH)
  })

  test('does not explode when height has not been measured', () => {
    const size = curlPageSizeForStage(800, 0)
    expect(size.width).toBeGreaterThanOrEqual(CURL_MIN_PAGE_WIDTH)
    expect(size.width).toBeLessThanOrEqual(360)
  })

  test('never emits a page taller than a short stage', () => {
    // Landscape phones and split panes: the readable-size floor used to
    // push the page past the stage height and clip it. Fitting beats
    // flooring — a small page reads small, a clipped one reads broken.
    const size = curlPageSizeForStage(900, 200)
    expect(size.height).toBeLessThanOrEqual(200)
  })

  test('never emits a page wider than a narrow stage', () => {
    const size = curlPageSizeForStage(200, 700)
    expect(size.width).toBeLessThanOrEqual(200)
  })

  test('quantizes width so tiny resizes do not rebuild the book', () => {
    const size = quantizeCurlPageSize({ width: 403, height: 577 })
    expect(size.width % CURL_SIZE_QUANTUM).toBe(0)
    expect(size.height / size.width).toBeCloseTo(CURL_PAGE_RATIO, 2)
  })

  test('quantizing never rounds a page past the stage', () => {
    // A width snapped up over the measured size overflows the viewport.
    const size = quantizeCurlPageSize({ width: 351, height: 0 })
    expect(size.width).toBeLessThanOrEqual(351)
    expect(size.width % CURL_SIZE_QUANTUM).toBe(0)
  })
})

describe('curl click intent', () => {
  test('turns forward from the right half', () => {
    expect(curlClickIntent(180, 200, true, true)).toBe('next')
  })

  test('turns back from the left half', () => {
    expect(curlClickIntent(20, 200, true, true)).toBe('prev')
  })

  test('still turns forward when back is impossible', () => {
    expect(curlClickIntent(20, 200, false, true)).toBe('next')
  })

  test('the last page never turns backward from a "next" tap', () => {
    expect(curlClickIntent(180, 200, true, false)).toBeNull()
  })

  test('does nothing when the book cannot move', () => {
    expect(curlClickIntent(180, 200, false, false)).toBeNull()
  })

  test('the whole page is a turn target — the chrome claims the middle itself', () => {
    expect(curlClickIntent(99, 200, true, true)).toBe('prev')
    expect(curlClickIntent(101, 200, true, true)).toBe('next')
  })
})

describe('curl release', () => {
  test('commits past the threshold, cancels short of it', () => {
    expect(curlShouldCommit(CURL_COMMIT_PROGRESS, 0)).toBe(true)
    expect(curlShouldCommit(CURL_COMMIT_PROGRESS - 1, 0)).toBe(false)
  })

  test('a flick decides regardless of distance', () => {
    expect(curlShouldCommit(5, CURL_COMMIT_VELOCITY)).toBe(true)
    expect(curlShouldCommit(90, -CURL_COMMIT_VELOCITY)).toBe(false)
  })

  test('release velocity reads only the last moments', () => {
    expect(curlReleaseVelocity([])).toBe(0)
    expect(
      curlReleaseVelocity([
        { x: 0, t: 0 },
        { x: 50, t: 100 },
        { x: 50, t: 400 },
        { x: 50, t: 420 },
      ]),
    ).toBe(0)
    expect(
      curlReleaseVelocity([
        { x: 200, t: 0 },
        { x: 160, t: 40 },
        { x: 120, t: 80 },
      ]),
    ).toBe(-1)
  })
})

describe('curl sheet ratio', () => {
  test('defaults to the bound-book ratio', () => {
    const size = quantizeCurlPageSize({ width: 400, height: 0 })
    expect(size.height / size.width).toBeCloseTo(CURL_PAGE_RATIO, 2)
  })

  test('sizes a sheet to the document ratio it is given', () => {
    const letter = 792 / 612
    const size = quantizeCurlPageSize({ width: 400, height: 0 }, letter)
    expect(size.height / size.width).toBeCloseTo(letter, 2)
    // A Letter page must not be forced into the taller paper-book sheet.
    expect(size.height).toBeLessThan(Math.round(size.width * CURL_PAGE_RATIO))
  })

  test('fits the stage using the document ratio', () => {
    const letter = 792 / 612
    const size = curlPageSizeForStage(900, 700, letter)
    expect(size.height).toBeLessThanOrEqual(700)
    expect(size.height / size.width).toBeCloseTo(letter, 2)
  })

  test('a wide document stays within the stage height', () => {
    const landscape = 0.7
    const size = curlPageSizeForStage(900, 700, landscape)
    expect(size.height / size.width).toBeCloseTo(landscape, 2)
    expect(size.height).toBeLessThanOrEqual(700)
  })
})

describe('curl spreads', () => {
  test('a landscape laptop stage shows two pages', () => {
    expect(curlUseSpread(1400, 800)).toBe(true)
  })

  test('a portrait phone or tablet stays on one page', () => {
    expect(curlUseSpread(390, 700)).toBe(false)
    expect(curlUseSpread(820, 1100)).toBe(false)
  })

  test('spreads pair (1|2), (3|4)… from the first page', () => {
    expect(curlSpreadStart(0)).toBe(0)
    expect(curlSpreadStart(1)).toBe(0)
    expect(curlSpreadStart(5)).toBe(4)
  })

  test('a turn moves a page, or a whole spread', () => {
    expect(curlStepTarget(3, 1, 10, false)).toBe(4)
    expect(curlStepTarget(3, 1, 10, true)).toBe(4)
    expect(curlStepTarget(2, 1, 10, true)).toBe(4)
    expect(curlStepTarget(3, -1, 10, true)).toBe(0)
    expect(curlStepTarget(1, -1, 10, true)).toBeNull()
    // A lone last page is still a spread to land on.
    expect(curlStepTarget(7, 1, 9, true)).toBe(8)
    expect(curlStepTarget(8, 1, 9, true)).toBeNull()
  })
})

describe('curl spread hysteresis', () => {
  test('an open spread survives a small squeeze that would not open one', () => {
    // Find a stage height right under the entry threshold.
    let height = 600
    expect(curlUseSpread(900, height)).toBe(true)
    while (curlUseSpread(900, height)) height += 10
    expect(curlUseSpread(900, height, CURL_PAGE_RATIO, false)).toBe(false)
    expect(curlUseSpread(900, height, CURL_PAGE_RATIO, true)).toBe(true)
  })
})

describe('curl spreads with a cover', () => {
  test('the cover sits alone on the right, then (2|3), (4|5)…', () => {
    expect(curlSpreadStart(0, true)).toBe(-1)
    expect(curlSpreadStart(1, true)).toBe(1)
    expect(curlSpreadStart(2, true)).toBe(1)
    expect(curlSpreadStart(3, true)).toBe(3)
  })

  test('turns land on the first real page of each spread', () => {
    expect(curlStepTarget(0, 1, 10, true, true)).toBe(1)
    expect(curlStepTarget(1, 1, 10, true, true)).toBe(3)
    expect(curlStepTarget(2, -1, 10, true, true)).toBe(0)
    expect(curlStepTarget(0, -1, 10, true, true)).toBeNull()
    expect(curlStepTarget(9, 1, 10, true, true)).toBeNull()
    expect(curlStepTarget(6, 1, 9, true, true)).toBe(7)
    expect(curlStepTarget(7, 1, 9, true, true)).toBeNull()
  })

  test('a forced spread still gives way on a phone held upright', () => {
    expect(
      curlResolveSpread('double', 390, 700, CURL_PAGE_RATIO, 10, false),
    ).toBe(false)
    expect(
      curlResolveSpread('double', 820, 1100, CURL_PAGE_RATIO, 10, false),
    ).toBe(true)
    expect(
      curlResolveSpread('single', 1400, 800, CURL_PAGE_RATIO, 10, false),
    ).toBe(false)
    expect(
      curlResolveSpread('auto', 1400, 800, CURL_PAGE_RATIO, 1, false),
    ).toBe(false)
  })
})
