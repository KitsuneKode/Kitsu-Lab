import { DEFAULT_CAPABILITIES, hasWebGLSupport } from "./capabilities"
import { isEmptySource } from "./normalize"
import type {
  BookPreviewEngine,
  BookPreviewMode,
  NormalizedBookSource,
} from "./types"

export const pageEngine: BookPreviewEngine = {
  id: "page",
  label: "Slide",
  description: "Horizontal page slide",
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    spreads: true,
    appearance: true,
    sound: true,
    fullscreen: true,
  },
  requiresPages: true,
  load: () => import("./engines/page-engine"),
}

export function engineIsCompatible(
  engine: BookPreviewEngine,
  source: NormalizedBookSource
): boolean {
  if (engine.requiresPages && source.pages.length === 0) return false
  // The pdf engine alone may sit behind `allowPdfUpload`: it renders the
  // upload affordance itself. The document-backed modes below have no empty
  // state, so they only become compatible once a real pdfUrl exists.
  if (engine.requiresPdf && !source.pdfUrl && !source.allowPdfUpload) return false
  // These engines render either page data or a rasterized PDF, so they need
  // at least one of the two.
  if (
    (engine.id === "curl" || engine.id === "scroll" || engine.id === "archival-curl") &&
    source.pages.length === 0 &&
    !source.pdfUrl
  ) {
    return false
  }
  return true
}

export function resolveEnabledEngines(
  engines: BookPreviewEngine[] | undefined,
  enabledModes: BookPreviewMode[] | undefined
): BookPreviewEngine[] {
  const catalog = engines && engines.length > 0 ? engines : [pageEngine]
  if (!enabledModes || enabledModes.length === 0) {
    return catalog.filter((engine, index, list) => list.findIndex((item) => item.id === engine.id) === index)
  }
  const allowed = new Set(enabledModes)
  return catalog.filter((engine) => allowed.has(engine.id))
}

export function resolveCompatibleEngines(
  engines: BookPreviewEngine[],
  source: NormalizedBookSource
): BookPreviewEngine[] {
  return engines.filter((engine) => engineIsCompatible(engine, source))
}

// When the requested mode cannot render a source, the reader should land on
// the mode that fits the document — not whatever happens to be first in the
// engine catalog. PDFs want the real document reader (selectable text, zoom,
// bounded memory) with continuous scroll as the runner-up; page data wants
// the dependency-free slide engine.
const FALLBACK_MODE_ORDER = {
  pdf: ["pdf", "scroll", "page"],
  pages: ["page"],
} as const satisfies Record<string, readonly BookPreviewMode[]>

export function resolveActiveEngine(input: {
  requestedMode: BookPreviewMode | undefined
  engines: BookPreviewEngine[]
  source: NormalizedBookSource
}): { engine: BookPreviewEngine | null; fallback: boolean; unsupported: boolean } {
  const { requestedMode, engines, source } = input
  if (isEmptySource(source)) {
    return { engine: null, fallback: false, unsupported: false }
  }

  const compatible = resolveCompatibleEngines(engines, source)
  const requested = requestedMode
    ? compatible.find((engine) => engine.id === requestedMode)
    : undefined

  if (requested) {
    return { engine: requested, fallback: false, unsupported: false }
  }

  const preference =
    source.pages.length > 0 ? FALLBACK_MODE_ORDER.pages : FALLBACK_MODE_ORDER.pdf
  for (const id of preference) {
    const engine = compatible.find((item) => item.id === id)
    if (engine) {
      return { engine, fallback: Boolean(requestedMode), unsupported: false }
    }
  }
  if (compatible[0]) {
    return { engine: compatible[0], fallback: Boolean(requestedMode), unsupported: false }
  }
  return { engine: null, fallback: false, unsupported: true }
}

export function createWebGLSupportCheck(): () => boolean {
  return hasWebGLSupport
}

export function describeEngineLoadFailure(label: string): string {
  return `The ${label} reader failed to load. Reload the page, then try this mode again.`
}

export function shouldPrefetchEngines(): boolean {
  // A failed dynamic import is cached for the page lifetime. Prefetching in
  // development races Turbopack HMR and can permanently poison a mode until reload.
  return process.env.NODE_ENV === "production"
}

export { pageEngine as defaultEngine }
