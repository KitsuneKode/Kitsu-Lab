'use client'

import type { BookPreviewSpreads } from './prefs'
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
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

/** Where a next/previous turn lands from `from`: views that show two pages
    turn a whole spread. Null means there is nothing that way. */
export type BookPreviewPageStep = (
  from: number,
  direction: 1 | -1,
) => number | null

/** Offered once when a document opens: after a silent resume ("picked up
    where you left off — start over?") or when a shared link opened away
    from the reader's own place ("you were on page M — go there?"). */
export type BookPreviewResumeNotice = {
  kind: 'resumed' | 'yours'
  pageIndex: number
  source: string
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
  /** Registered by a view that pages by spreads (the curl book, premier's
      two-page view) so arrows, the pager and Space turn a spread, not half
      of one — and Previous/Next disable at the true ends. */
  setPageStep: (step: BookPreviewPageStep | null) => void
  toggleFullscreen: () => void
  fullscreen: boolean
  /** Fullscreen chrome: hidden while reading, optionally pinned up. */
  chrome: {
    hidden: boolean
    pinned: boolean
    toggle: () => void
    togglePinned: () => void
  }
  /** How two-page views lay out: spreads by screen shape / never / always
      (the reader's choice, remembered), and whether the first page stands
      alone as a cover. */
  pageLayout: { spreads: BookPreviewSpreads; cover: boolean }
  setSpreads: (spreads: BookPreviewSpreads) => void
  setCover: (cover: boolean) => void
  resume: BookPreviewResumeNotice | null
  dismissResume: () => void
  /** Estimated minutes to the end at this reader's own pace; null until a
      few page turns have taught it. */
  minutesLeft: number | null
  /** The keyboard-shortcut sheet (`?`), with the engine shortcuts that
      exist at the moment it opened. */
  shortcutsOpen: boolean
  engineShortcutsAvailable: { search: boolean; zoom: boolean }
  setShortcutsOpen: (open: boolean) => void
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

type BookPreviewStore = {
  get: () => BookPreviewContextValue
  set: (value: BookPreviewContextValue) => void
  subscribe: (listener: () => void) => () => void
}

function createBookPreviewStore(
  initial: BookPreviewContextValue,
): BookPreviewStore {
  let current = initial
  const listeners = new Set<() => void>()
  return {
    get: () => current,
    set: (value) => {
      if (value === current) return
      current = value
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

const BookPreviewStoreContext = createContext<BookPreviewStore | null>(null)

export function BookPreviewProvider({
  value,
  children,
}: {
  value: BookPreviewContextValue
  children: ReactNode
}) {
  const [store] = useState(() => createBookPreviewStore(value))
  // Published before paint, so selector consumers never show a stale frame.
  useLayoutEffect(() => {
    store.set(value)
  }, [store, value])
  return (
    <BookPreviewStoreContext.Provider value={store}>
      <BookPreviewContext.Provider value={value}>
        {children}
      </BookPreviewContext.Provider>
    </BookPreviewStoreContext.Provider>
  )
}

/** The whole reader context. Re-renders on every change — a page turn
    included; prefer `useBookPreviewSelector` in anything heavy. */
export function useBookPreview(): BookPreviewContextValue {
  const value = useContext(BookPreviewContext)
  if (!value) {
    throw new Error('useBookPreview must be used within BookPreview')
  }
  return value
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false
  }
  const keysA = Object.keys(a)
  if (keysA.length !== Object.keys(b).length) return false
  return keysA.every((key) =>
    Object.is(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  )
}

/**
 * A slice of the reader context that re-renders only when that slice
 * changes (compared shallowly). A notebook panel that picks
 * `{ annotations, companion }` stays put while the reader turns pages.
 */
export function useBookPreviewSelector<T>(
  select: (value: BookPreviewContextValue) => T,
): T {
  const store = useContext(BookPreviewStoreContext)
  if (!store) {
    throw new Error('useBookPreviewSelector must be used within BookPreview')
  }
  const selectRef = useRef(select)
  const lastRef = useRef<{ value: T } | null>(null)
  useLayoutEffect(() => {
    selectRef.current = select
  })
  const getSnapshot = useCallback(() => {
    const next = selectRef.current(store.get())
    const last = lastRef.current
    if (last && shallowEqual(last.value, next)) return last.value
    lastRef.current = { value: next }
    return next
  }, [store])
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot)
}
