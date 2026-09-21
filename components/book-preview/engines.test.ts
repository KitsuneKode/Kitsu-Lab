import { describe, expect, test } from "bun:test"
import {
  describeEngineLoadFailure,
  pageEngine,
  resolveActiveEngine,
  resolveCompatibleEngines,
  resolveEnabledEngines,
  shouldPrefetchEngines,
} from "./engines"
import {
  CURL_MAX_PAGE_WIDTH,
  CURL_MIN_PAGE_WIDTH,
  CURL_PAGE_RATIO,
  CURL_SIZE_QUANTUM,
  curlClickIntent,
  curlDragOrigin,
  curlPageSizeForStage,
  quantizeCurlPageSize,
  curlPageLabel,
  curlSameSpread,
  curlSpreadFitsStage,
  CURL_SPREAD_MIN_PAGE_WIDTH,
  CURL_SPREAD_ENABLED,
} from "./engines/curl-geometry"
import { normalizeSource } from "./normalize"
import type { BookPreviewEngine } from "./types"

const pdfEngine: BookPreviewEngine = {
  ...pageEngine,
  id: "pdf",
  label: "PDF",
  requiresPages: false,
  requiresPdf: true,
  load: pageEngine.load,
}

describe("engine resolution", () => {
  test("defaults to the page engine", () => {
    const source = normalizeSource({
      pages: [{ id: "1", pageNumber: 1, title: "Cover" }],
    })
    const resolved = resolveActiveEngine({
      requestedMode: "page",
      engines: resolveEnabledEngines(undefined, undefined),
      source,
    })
    expect(resolved.engine?.id).toBe("page")
    expect(resolved.unsupported).toBe(false)
  })

  test("falls back when a requested engine is incompatible", () => {
    const source = normalizeSource({
      pages: [{ id: "1", pageNumber: 1, title: "Cover" }],
    })
    const resolved = resolveActiveEngine({
      requestedMode: "pdf",
      engines: [pageEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe("page")
    expect(resolved.fallback).toBe(true)
  })

  test("keeps pdf when a document source exists", () => {
    const source = normalizeSource({ pdfUrl: "/sample-book.pdf" })
    const resolved = resolveActiveEngine({
      requestedMode: "pdf",
      engines: [pageEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe("pdf")
  })

  test("keeps curl when only a PDF source exists", () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: "curl",
      label: "Curl",
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ pdfUrl: "/sample-book.pdf" })
    const resolved = resolveActiveEngine({
      requestedMode: "curl",
      engines: [pageEngine, curlEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe("curl")
  })

  test("keeps scroll when only a PDF source exists", () => {
    const scrollEngine: BookPreviewEngine = {
      ...pageEngine,
      id: "scroll",
      label: "Scroll",
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ pdfUrl: "/sample-book.pdf" })
    const resolved = resolveActiveEngine({
      requestedMode: "scroll",
      engines: [pageEngine, scrollEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe("scroll")
  })

  test("prefers the document reader over showcase modes for a PDF source", () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: "curl",
      label: "Curl",
      requiresPages: false,
      load: pageEngine.load,
    }
    const scrollEngine: BookPreviewEngine = {
      ...pageEngine,
      id: "scroll",
      label: "Scroll",
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ pdfUrl: "/sample-book.pdf" })
    const resolved = resolveActiveEngine({
      // "page" cannot render a document, so the source-aware preference picks.
      requestedMode: "page",
      engines: [pageEngine, curlEngine, scrollEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe("pdf")
    expect(resolved.fallback).toBe(true)
  })

  test("falls back to scroll for a PDF source without the pdf engine", () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: "curl",
      label: "Curl",
      requiresPages: false,
      load: pageEngine.load,
    }
    const scrollEngine: BookPreviewEngine = {
      ...pageEngine,
      id: "scroll",
      label: "Scroll",
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ pdfUrl: "/sample-book.pdf" })
    const resolved = resolveActiveEngine({
      requestedMode: "page",
      engines: [pageEngine, curlEngine, scrollEngine],
      source,
    })
    expect(resolved.engine?.id).toBe("scroll")
    expect(resolved.fallback).toBe(true)
  })

  test("lands on the pdf engine for an upload-only source", () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: "curl",
      label: "Curl",
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ allowPdfUpload: true })
    const resolved = resolveActiveEngine({
      requestedMode: "curl",
      engines: [pageEngine, curlEngine, pdfEngine],
      source,
    })
    expect(resolved.engine?.id).toBe("pdf")
  })

  test("document modes stay hidden until an upload exists", () => {
    const curlEngine: BookPreviewEngine = {
      ...pageEngine,
      id: "curl",
      label: "Curl",
      requiresPages: false,
      load: pageEngine.load,
    }
    const source = normalizeSource({ allowPdfUpload: true })
    expect(
      resolveCompatibleEngines([pageEngine, curlEngine, pdfEngine], source).map(
        (engine) => engine.id
      )
    ).toEqual(["pdf"])
  })

  test("filters mode choices to engines that can render the current source", () => {
    const source = normalizeSource({
      pages: [{ id: "1", pageNumber: 1, title: "Cover" }],
    })
    expect(resolveCompatibleEngines([pageEngine, pdfEngine], source).map((engine) => engine.id)).toEqual([
      "page",
    ])
  })

  test("does not evaluate browser support while resolving the render tree", () => {
    let checks = 0
    const webgl: BookPreviewEngine = {
      ...pageEngine,
      id: "webgl",
      label: "WebGL",
      isSupported: () => {
        checks += 1
        return false
      },
    }
    const source = normalizeSource({
      pages: [{ id: "1", pageNumber: 1, title: "Cover" }],
    })
    expect(resolveCompatibleEngines([pageEngine, webgl], source).map((engine) => engine.id)).toEqual([
      "page",
      "webgl",
    ])
    expect(resolveActiveEngine({ requestedMode: "webgl", engines: [pageEngine, webgl], source }).engine?.id).toBe(
      "webgl"
    )
    expect(checks).toBe(0)
  })
})

describe("engine load recovery", () => {
  test("tells the user to reload after a failed import", () => {
    expect(describeEngineLoadFailure("Spread")).toBe(
      "The Spread reader failed to load. Reload the page, then try this mode again."
    )
  })

  test("does not prefetch engines outside production", () => {
    expect(shouldPrefetchEngines()).toBe(process.env.NODE_ENV === "production")
  })
})

describe("curl stage sizing", () => {
  test("keeps a readable page on a phone", () => {
    const size = curlPageSizeForStage(390, 700)
    expect(size.width).toBeGreaterThanOrEqual(CURL_MIN_PAGE_WIDTH)
    expect(size.width).toBeLessThanOrEqual(390)
    expect(size.height / size.width).toBeCloseTo(530 / 370, 2)
  })

  test("grows up to the large-screen cap", () => {
    // A 1400px page is ~2005px tall at the 370:530 ratio, so the cap is only
    // reachable on a stage tall enough to contain it.
    const size = curlPageSizeForStage(3200, 2200)
    expect(size.width).toBe(CURL_MAX_PAGE_WIDTH)
  })

  test("does not explode when height has not been measured", () => {
    const size = curlPageSizeForStage(800, 0)
    expect(size.width).toBeGreaterThanOrEqual(CURL_MIN_PAGE_WIDTH)
    expect(size.width).toBeLessThanOrEqual(360)
  })

  test("quantizes width so tiny resizes do not rebuild the book", () => {
    const size = quantizeCurlPageSize({ width: 403, height: 577 })
    expect(size.width % CURL_SIZE_QUANTUM).toBe(0)
    expect(size.height / size.width).toBeCloseTo(CURL_PAGE_RATIO, 2)
  })
})

describe("curl click intent", () => {
  test("turns forward from the right half", () => {
    expect(curlClickIntent(180, 200, true, true)).toBe("next")
  })

  test("turns back from the left half", () => {
    expect(curlClickIntent(20, 200, true, true)).toBe("prev")
  })

  test("still turns forward when back is impossible", () => {
    expect(curlClickIntent(20, 200, false, true)).toBe("next")
  })

  test("still turns back when forward is impossible", () => {
    expect(curlClickIntent(180, 200, true, false)).toBe("prev")
  })

  test("does nothing when the book cannot move", () => {
    expect(curlClickIntent(180, 200, false, false)).toBeNull()
  })
})

describe("curl drag origin", () => {
  test("starts a forward peel on the right edge", () => {
    const origin = curlDragOrigin({ x: 100, y: 80 }, { x: 40, y: 90 }, 200)
    expect(origin.x).toBeGreaterThanOrEqual(176)
    expect(origin.y).toBe(80)
  })

  test("starts a backward peel on the left edge", () => {
    const origin = curlDragOrigin({ x: 100, y: 80 }, { x: 140, y: 90 }, 200)
    expect(origin.x).toBeLessThanOrEqual(24)
    expect(origin.y).toBe(80)
  })
})

describe("curl sheet ratio", () => {
  test("defaults to the bound-book ratio", () => {
    const size = quantizeCurlPageSize({ width: 400, height: 0 })
    expect(size.height / size.width).toBeCloseTo(CURL_PAGE_RATIO, 2)
  })

  test("sizes a sheet to the document ratio it is given", () => {
    const letter = 792 / 612
    const size = quantizeCurlPageSize({ width: 400, height: 0 }, letter)
    expect(size.height / size.width).toBeCloseTo(letter, 2)
    // A Letter page must not be forced into the taller paper-book sheet.
    expect(size.height).toBeLessThan(Math.round(size.width * CURL_PAGE_RATIO))
  })

  test("fits the stage using the document ratio", () => {
    const letter = 792 / 612
    const size = curlPageSizeForStage(900, 700, letter)
    expect(size.height).toBeLessThanOrEqual(700)
    expect(size.height / size.width).toBeCloseTo(letter, 2)
  })

  test("a wide document stays within the stage height", () => {
    const landscape = 0.7
    const size = curlPageSizeForStage(900, 700, landscape)
    expect(size.height / size.width).toBeCloseTo(landscape, 2)
    expect(size.height).toBeLessThanOrEqual(700)
  })
})

describe("curl two-page spread", () => {
  test("a phone-width stage stays on a single page", () => {
    expect(curlSpreadFitsStage(390)).toBe(false)
  })

  test("keeps the known-unsafe desktop spread behind its safety gate", () => {
    // Gated off while the page-flip landscape freeze is unresolved.
    expect(curlSpreadFitsStage(1200)).toBe(CURL_SPREAD_ENABLED)
  })

  test("the threshold is exactly two readable leaves", () => {
    const exact = CURL_SPREAD_MIN_PAGE_WIDTH * 2 + 24
    expect(curlSpreadFitsStage(exact)).toBe(CURL_SPREAD_ENABLED)
    expect(curlSpreadFitsStage(exact - 1)).toBe(false)
  })

  test("each leaf takes half the stage in a spread", () => {
    const single = curlPageSizeForStage(1200, 900, CURL_PAGE_RATIO, false)
    const paired = curlPageSizeForStage(1200, 900, CURL_PAGE_RATIO, true)
    expect(paired.width).toBeLessThan(single.width)
    // Two leaves plus padding must still fit the stage.
    expect(paired.width * 2).toBeLessThanOrEqual(1200)
  })

  test("facing pages are the same spread", () => {
    expect(curlSameSpread(14, 15, true)).toBe(true)
    expect(curlSameSpread(15, 16, true)).toBe(false)
  })

  test("without a spread only the identical page counts", () => {
    expect(curlSameSpread(14, 15, false)).toBe(false)
    expect(curlSameSpread(14, 14, false)).toBe(true)
  })

  test("the counter names both open leaves", () => {
    expect(curlPageLabel(14, 40, true)).toBe("15\u201316")
    expect(curlPageLabel(15, 40, true)).toBe("15\u201316")
    expect(curlPageLabel(14, 40, false)).toBe("15")
  })

  test("a lone final leaf is not labelled as a pair", () => {
    expect(curlPageLabel(5, 6, true)).toBe("5\u20136")
    expect(curlPageLabel(6, 7, true)).toBe("7")
  })
})
