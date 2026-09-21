import type { ComponentType, ReactNode } from "react"

export const BOOK_PREVIEW_MODES = [
  "page",
  "curl",
  "scroll",
  "spread",
  "archival-curl",
  "webgl",
  "pdf",
] as const

export type BookPreviewMode = (typeof BOOK_PREVIEW_MODES)[number]

export const BOOK_PREVIEW_APPEARANCES = [
  "system",
  "sepia",
  "light",
  "dark",
  "oled",
] as const

export type BookPreviewAppearance = (typeof BOOK_PREVIEW_APPEARANCES)[number]

export const BOOK_PREVIEW_ERROR_KINDS = [
  "unsupported",
  "engine-load",
  "invalid-source",
  "pdf-parse",
  "pdf-render",
  "upload",
  "page-render",
  "empty",
] as const

export type BookPreviewErrorKind = (typeof BOOK_PREVIEW_ERROR_KINDS)[number]

export type BookPreviewStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error"
  | "unsupported"
  | "empty"

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

export type BookPreviewEngineReadyInfo = {
  totalPages: number
  capabilities: BookPreviewCapabilities
}

export type BookPreviewNavigationBehavior = "animated" | "instant"

export type BookPreviewEngineProps = {
  source: NormalizedBookSource
  pageIndex: number
  appearance: BookPreviewAppearance
  soundEnabled: boolean
  reducedMotion: boolean
  navigationBehavior: BookPreviewNavigationBehavior
  onPageChange: (pageIndex: number, behavior?: BookPreviewNavigationBehavior) => void
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
