"use client"

import { createContext, useContext, type ReactNode } from "react"
import type { BookPreviewState } from "./reducer"
import type {
  BookPreviewAppearance,
  BookPreviewEngine,
  BookPreviewMode,
  BookPreviewNavigationBehavior,
  NormalizedBookSource,
} from "./types"

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
