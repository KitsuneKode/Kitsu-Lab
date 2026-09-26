'use client'

import {
  createContext,
  useContext,
  type ReactNode,
  type RefObject,
} from 'react'
import type { BookPreviewState } from './reducer'
import type { BookPreviewTypography } from './typography'
import type { BookPreviewAiAdapter } from './ai'
import type { BookPreviewAnnotation } from './annotations'
import type { BookPreviewInkColor, BookPreviewInkTool } from './ink'
import type { ShareOutcome } from './share'
import type {
  BookPreviewAppearance,
  BookPreviewEngine,
  BookPreviewMode,
  BookPreviewNavigationBehavior,
  NormalizedBookSource,
} from './types'

/** An engine registers the shortcuts it owns (zoom, search focus) here while
    mounted; the shell's keydown handler invokes them so keys like +, -, 0 and
    / work for whichever reader is active. Mutable — no re-renders on write. */
export type BookPreviewEngineShortcuts = {
  zoomIn?: () => void
  zoomOut?: () => void
  zoomReset?: () => void
  search?: () => void
  /** Escape is offered to the engine first: returning true means it closed
      its own overlay (search, thumbnails) and the shell should stay put. */
  dismiss?: () => boolean
  /** Plain text of a page, for Ask and exports. Engines that extract text
      (the premier reader) register it; otherwise the shell reads the DOM. */
  pageText?: (pageIndex: number) => string
}

export type BookPreviewCompanionTab = 'notes' | 'ask'

/** What the Ask tab opens with — the passage and, optionally, a question. */
export type BookPreviewAskSeed = {
  selection?: string
  question?: string
  pageIndex: number
  /** Changes on every request so asking about the same passage twice
      still restarts the conversation. */
  nonce: number
}

export type BookPreviewContextValue = {
  state: BookPreviewState
  source: NormalizedBookSource
  label: string
  enabledEngines: BookPreviewEngine[]
  reducedMotion: boolean
  reducedTransparency: boolean
  moreContrast: boolean
  finePointer: boolean
  canGoPrev: boolean
  canGoNext: boolean
  setMode: (mode: BookPreviewMode) => void
  goToPage: (
    pageIndex: number,
    behavior?: BookPreviewNavigationBehavior,
  ) => void
  nextPage: () => void
  prevPage: () => void
  setAppearance: (appearance: BookPreviewAppearance) => void
  setSound: (sound: boolean) => void
  typography: BookPreviewTypography
  setTypography: (typography: BookPreviewTypography) => void
  retry: () => void
  prefetchMode: (mode: BookPreviewMode) => void
  /** Accept a PDF file (toolbar button or drag-and-drop). The shell owns the
      object URL so every engine can read the document. */
  uploadPdf: (file: File) => void
  engineShortcutsRef: RefObject<BookPreviewEngineShortcuts>
  toggleFullscreen: () => void
  fullscreen: boolean
  /** DOM node inside the toolbar an engine portals its controls into, so the
      reader chrome stays one bar instead of a second row floating above the
      stage. Null until the toolbar mounts its slot. */
  chromeHost: HTMLElement | null
  setChromeHost: (el: HTMLElement | null) => void
  rootRef: RefObject<HTMLElement | null>
  /** Highlights and notes are on (the `annotate` prop). Bookmarks follow. */
  annotate: boolean
  annotations: BookPreviewAnnotation[]
  updateAnnotations: (
    fn: (list: BookPreviewAnnotation[]) => BookPreviewAnnotation[],
  ) => void
  ai: BookPreviewAiAdapter | undefined
  companion: {
    open: boolean
    tab: BookPreviewCompanionTab
    askSeed: BookPreviewAskSeed | null
  }
  openCompanion: (
    tab: BookPreviewCompanionTab,
    askSeed?: Omit<BookPreviewAskSeed, 'nonce'>,
  ) => void
  setCompanionOpen: (open: boolean) => void
  setCompanionTab: (tab: BookPreviewCompanionTab) => void
  /** Text of a page for Ask/export — engine-provided, else read from DOM,
      else the page data. */
  getPageText: (pageIndex: number) => string
  /** Freehand drawing mode — on while the reader has the pen out. */
  draw: BookPreviewDrawState
  setDraw: (patch: Partial<BookPreviewDrawState>) => void
  /** Whether the current view shows page faces that accept ink. */
  inkAvailable: boolean
  setInkAvailable: (available: boolean) => void
  /** Share affordances are on (the `share` prop). */
  share: boolean
  /** Share the current view (or, with `text`, a quote from it). */
  sharePage: (extra?: { text?: string }) => Promise<ShareOutcome>
  /** The open document came from the reader's device, not a URL. */
  uploaded: boolean
}

export type BookPreviewDrawState = {
  active: boolean
  tool: BookPreviewInkTool
  color: BookPreviewInkColor
}

const BookPreviewContext = createContext<BookPreviewContextValue | null>(null)

export function BookPreviewProvider({
  value,
  children,
}: {
  value: BookPreviewContextValue
  children: ReactNode
}) {
  return (
    <BookPreviewContext.Provider value={value}>
      {children}
    </BookPreviewContext.Provider>
  )
}

export function useBookPreview(): BookPreviewContextValue {
  const value = useContext(BookPreviewContext)
  if (!value) {
    throw new Error('useBookPreview must be used within BookPreview')
  }
  return value
}
