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

/**
 * A pre-rendered page raster. Lets hosts serve page images (for bandwidth,
 * low-end devices, or keeping the source document off the client) without a
 * custom `render` per page. Images can still be captured; this is not DRM.
 */
export type BookPreviewPageImage = {
  src: string
  /** e.g. '/p/3-1024.webp 1024w, /p/3-1600.webp 1600w' */
  srcSet?: string
  sizes?: string
  /** Intrinsic size, used for the aspect ratio so nothing shifts on load. */
  width: number
  height: number
  /** Required. A short summary of the page, or "Page 3". */
  alt: string
  /** Shown behind the image while it loads: a CSS colour or a tiny data URL. */
  placeholder?: string
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
  /** Render this page as an image. Takes precedence over text fields. */
  image?: BookPreviewPageImage
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
  defaultAppearance?: BookPreviewAppearance
  appearance?: BookPreviewAppearance
  onAppearanceChange?: (appearance: BookPreviewAppearance) => void
  defaultSound?: boolean
  sound?: boolean
  onSoundChange?: (sound: boolean) => void
  prefetchModes?: BookPreviewMode[]
  /** Called when the requested mode cannot render this source and another
      compatible engine takes over (e.g. "webgl" requested for a PDF). */
  onModeFallback?: (requested: BookPreviewMode, actual: BookPreviewMode) => void
  onCapabilitiesChange?: (capabilities: BookPreviewCapabilities) => void
  onError?: (error: BookPreviewError) => void
  onStatusChange?: (status: BookPreviewStatus) => void
}
