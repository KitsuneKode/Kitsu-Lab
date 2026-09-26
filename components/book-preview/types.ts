import type { BookPreviewUrlKeys } from './url-state'
import type { BookPreviewTypography } from './typography'
import type { BookPreviewAiAdapter } from './ai'
import type { BookPreviewAnnotation } from './annotations'
import type { ComponentType, ReactNode } from 'react'

export const BOOK_PREVIEW_MODES = [
  'page',
  'curl',
  'scroll',
  'spread',
  'archival-curl',
  'webgl',
  'pdf',
  'premier',
] as const

export type BookPreviewMode = (typeof BOOK_PREVIEW_MODES)[number]

export const BOOK_PREVIEW_APPEARANCES = [
  'system',
  'sepia',
  'light',
  'dark',
  'oled',
] as const

export type BookPreviewAppearance = (typeof BOOK_PREVIEW_APPEARANCES)[number]

export const BOOK_PREVIEW_ERROR_KINDS = [
  'unsupported',
  'engine-load',
  'invalid-source',
  'pdf-parse',
  'pdf-render',
  'upload',
  'page-render',
  'empty',
] as const

export type BookPreviewErrorKind = (typeof BOOK_PREVIEW_ERROR_KINDS)[number]

export type BookPreviewStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unsupported'
  | 'empty'

export type BookPreviewCapabilities = {
  pagination: boolean
  spreads: boolean
  curl: boolean
  zoom: boolean
  loupe: boolean
  search: boolean
  speech: boolean
  fullscreen: boolean
  download: boolean
  upload: boolean
  appearance: boolean
  sound: boolean
  thumbnails: boolean
  webgl: boolean
}

export type BookPreviewError = {
  kind: BookPreviewErrorKind
  message: string
}

export type BookPreviewPageRenderContext = {
  appearance: BookPreviewAppearance
  isLeftPage: boolean
  page: BookPreviewPage
}

export type BookPreviewPage = {
  id: string
  pageNumber: number
  title?: string
  subtitle?: string
  kicker?: string
  paragraphs?: string[]
  quote?: {
    text: string
    attribution?: string
  }
  isCover?: boolean
  isBackCover?: boolean
  searchableText?: string
  render?: (context: BookPreviewPageRenderContext) => ReactNode
}

export type BookPreviewSource = {
  /** Change this when custom render output changes without changing serializable page data. */
  revision?: string
  title?: string
  author?: string
  pages?: BookPreviewPage[]
  pdfUrl?: string
  pdfFileName?: string
  allowPdfUpload?: boolean
  downloadUrl?: string
  downloadFileName?: string
}

export type NormalizedBookSource = {
  revision?: string
  title?: string
  author?: string
  pages: BookPreviewPage[]
  pdfUrl?: string
  pdfFileName?: string
  allowPdfUpload: boolean
  downloadUrl?: string
  downloadFileName?: string
}

export type BookPreviewContentsEntry = {
  title: string
  pageIndex: number
  /** Nesting level from the document outline; 0 is a top-level chapter. */
  depth: number
}

export type BookPreviewEngineReadyInfo = {
  totalPages: number
  capabilities: BookPreviewCapabilities
  /** Document-provided table of contents (e.g. a PDF outline). Overrides the
      page-title menu the toolbar builds from source pages. */
  contents?: BookPreviewContentsEntry[]
}

export type BookPreviewLayout = 'inline' | 'fill'

export type BookPreviewNavigationBehavior = 'animated' | 'instant'

export type BookPreviewEngineProps = {
  source: NormalizedBookSource
  pageIndex: number
  appearance: BookPreviewAppearance
  soundEnabled: boolean
  reducedMotion: boolean
  navigationBehavior: BookPreviewNavigationBehavior
  /** Mirror of the shell's persistPreferences prop, so engines can remember
      their own view settings (e.g. the PDF reader's zoom level). */
  persistPreferences?: boolean
  /** Query key the engine may mirror its own layout into (the premier
      reader's view), so shared links reopen the same layout. Undefined when
      the host has not opted into URL state. */
  viewParam?: string
  onPageChange: (
    pageIndex: number,
    behavior?: BookPreviewNavigationBehavior,
  ) => void
  onReady: (info: BookPreviewEngineReadyInfo) => void
  onError: (error: BookPreviewError) => void
}

export type BookPreviewEngine = {
  id: BookPreviewMode
  label: string
  description: string
  capabilities: BookPreviewCapabilities
  load: () => Promise<{ default: ComponentType<BookPreviewEngineProps> }>
  isSupported?: () => boolean
  requiresPages?: boolean
  requiresPdf?: boolean
}

export type BookPreviewProps = {
  source: BookPreviewSource
  className?: string
  label?: string
  /** `inline` sizes the stage to comfortable breakpoints inside a page;
      `fill` stretches to the parent's height (give the parent one) — for
      app shells, split views, and dedicated reader routes. */
  layout?: BookPreviewLayout
  engines?: BookPreviewEngine[]
  enabledModes?: BookPreviewMode[]
  defaultMode?: BookPreviewMode
  mode?: BookPreviewMode
  onModeChange?: (mode: BookPreviewMode) => void
  defaultPageIndex?: number
  pageIndex?: number
  onPageChange?: (pageIndex: number) => void
  /** Remember the reading position per source in localStorage and restore it
      on the next visit. Ignored while `pageIndex` is controlled. */
  persistPage?: boolean
  /** Remember appearance and reader mode (and engine-level settings like PDF
      zoom) across visits. Ignored for props the consumer controls. */
  persistPreferences?: boolean
  /** Sync the reading position with a URL query parameter, e.g.
      `pageParam="page"` produces `?page=12`. Applied once per source on open,
      then kept current with history.replaceState — no history spam. */
  pageParam?: string
  /** Mirror reader state into the query string so links and refreshes keep
      it: `true` syncs `?page=`, `?mode=`, `?theme=` and the premier `?view=`;
      an object renames or picks individual keys. Uses replaceState only. */
  urlState?: boolean | BookPreviewUrlKeys
  defaultAppearance?: BookPreviewAppearance
  appearance?: BookPreviewAppearance
  onAppearanceChange?: (appearance: BookPreviewAppearance) => void
  defaultSound?: boolean
  sound?: boolean
  onSoundChange?: (sound: boolean) => void
  prefetchModes?: BookPreviewMode[]
  /** Starting "Aa" settings (type size, face, spacing, measure). Remembered
      across visits with `persistPreferences`. */
  defaultTypography?: Partial<BookPreviewTypography>
  onTypographyChange?: (typography: BookPreviewTypography) => void
  /** Select text to highlight it, add notes, and bookmark pages. On by
      default; set false for a read-only preview. */
  annotate?: boolean
  /** A Share button (system share sheet, or copy link) and "Share" on
      highlights. Links carry page, mode, view and paper when `urlState` is
      on; an uploaded PDF shares the file itself where the device can.
      Default true. */
  share?: boolean
  /** Controlled notebook — pair with `onAnnotationsChange` to sync highlights,
      notes and bookmarks to your own backend (they carry ids and timestamps
      for last-write-wins merging). */
  annotations?: BookPreviewAnnotation[]
  defaultAnnotations?: BookPreviewAnnotation[]
  onAnnotationsChange?: (annotations: BookPreviewAnnotation[]) => void
  /** Remember the notebook per document in localStorage (uncontrolled only),
      kept in step across open tabs. */
  persistAnnotations?: boolean
  /** Put a model next to the page: "Ask" on a selection or the current
      page. See ai.ts for the on-device, OpenAI-compatible (Ollama), and
      server-route adapters. */
  ai?: BookPreviewAiAdapter
  /** Called when the requested mode cannot render this source and another
      compatible engine takes over (e.g. "webgl" requested for a PDF). */
  onModeFallback?: (requested: BookPreviewMode, actual: BookPreviewMode) => void
  onCapabilitiesChange?: (capabilities: BookPreviewCapabilities) => void
  onError?: (error: BookPreviewError) => void
  onStatusChange?: (status: BookPreviewStatus) => void
}
