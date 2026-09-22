"use client"

import { createContext, useContext, type ReactNode, type RefObject } from "react"
import type { BookPreviewState } from "./reducer"
import type {
  BookPreviewAppearance,
  BookPreviewEngine,
  BookPreviewMode,
  BookPreviewNavigationBehavior,
  NormalizedBookSource,
} from "./types"

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
  goToPage: (pageIndex: number, behavior?: BookPreviewNavigationBehavior) => void
  nextPage: () => void
  prevPage: () => void
  setAppearance: (appearance: BookPreviewAppearance) => void
  setSound: (sound: boolean) => void
  retry: () => void
  prefetchMode: (mode: BookPreviewMode) => void
  /** Accept a PDF file (toolbar button or drag-and-drop). The shell owns the
      object URL so every engine can read the document. */
  uploadPdf: (file: File) => void
  engineShortcutsRef: RefObject<BookPreviewEngineShortcuts>
  toggleFullscreen: () => void
  fullscreen: boolean
}

const BookPreviewContext = createContext<BookPreviewContextValue | null>(null)

export function BookPreviewProvider({
  value,
  children,
}: {
  value: BookPreviewContextValue
  children: ReactNode
}) {
  return <BookPreviewContext.Provider value={value}>{children}</BookPreviewContext.Provider>
}

export function useBookPreview(): BookPreviewContextValue {
  const value = useContext(BookPreviewContext)
  if (!value) {
    throw new Error("useBookPreview must be used within BookPreview")
  }
  return value
}
