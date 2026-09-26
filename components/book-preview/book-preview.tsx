'use client'

import './book-preview.css'
import { cn } from '@/lib/utils'
import { stopPageTurnSounds } from './audio'
import { bookPreviewMotionStyle } from './motion'
import { createPreviewStore } from './preview-store'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BookPreviewToolbar } from './book-preview-toolbar'
import { BookPreviewViewport } from './book-preview-viewport'
import { BookPreviewNavigation } from './book-preview-navigation'
import {
  readBookPreviewPrefs,
  writeBookPreviewPrefs,
  type BookPreviewSpreads,
} from './prefs'
import { resolveUrlKeys } from './url-state'
import { createInitialState } from './reducer'
import { isInteractiveTarget, isReaderKeyboardEvent } from './keyboard'
import { useImmersiveChrome } from './hooks/use-immersive-chrome'
import { BookPreviewChromeHandle } from './book-preview-chrome-controls'
import { BookPreviewSideArrows } from './book-preview-side-arrows'
import { BookPreviewResume } from './book-preview-resume'
import { useAnnotations } from './hooks/use-annotations'
import { toggleBookmark } from './annotations'
import { BookPreviewCompanion } from './book-preview-companion'
import { BookPreviewBookmarkRibbon } from './book-preview-bookmark-ribbon'
import { BookPreviewAnnotationLayer } from './book-preview-annotation-layer'
import { BookPreviewInkLayer } from './book-preview-ink-layer'
import { shareOrCopy } from './share'
import { typographyVariables } from './typography'
import { normalizeSource, pageSearchText, sourceIdentity } from './normalize'
import {
  usePrefersMoreContrast,
  usePrefersReducedMotion,
  usePrefersReducedTransparency,
  useFinePointer,
} from './media'
import {
  BookPreviewProvider,
  type BookPreviewAskSeed,
  type BookPreviewCompanionTab,
  type BookPreviewContextValue,
  type BookPreviewDrawState,
  type BookPreviewEngineShortcuts,
  type BookPreviewPageStep,
} from './book-preview-provider'
import {
  resolveActiveEngine,
  resolveCompatibleEngines,
  resolveEnabledEngines,
  shouldPrefetchEngines,
} from './engines'
import type {
  BookPreviewMode,
  BookPreviewNavigationBehavior,
  BookPreviewProps,
  NormalizedBookSource,
} from './types'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { pickControlled, isPdfFile, eventHasFiles } from './reader-utils'
import { BookPreviewActiveEngine } from './book-preview-active-engine'
import { useFullscreen } from './hooks/use-fullscreen'
import { useEngineLoader } from './hooks/use-engine-loader'
import { usePersistedPageIndex, useReadingPace } from './hooks/use-page-memory'
import {
  usePersistedPreferences,
  useUrlReaderState,
  useTypography,
} from './hooks/use-reader-preferences'
import { useUploadedPdf } from './hooks/use-uploaded-pdf'
import {
  useBookPreviewActions,
  usePrefetchEngines,
} from './hooks/use-reader-actions'

export function BookPreview({
  source,
  className,
  label = 'Book preview',
  layout = 'inline',
  engines,
  enabledModes,
  defaultMode = 'page',
  mode,
  onModeChange,
  defaultPageIndex = 0,
  pageIndex,
  onPageChange,
  persistPage = false,
  persistPreferences = false,
  pageParam: pageParamProp,
  urlState,
  defaultAppearance = 'system',
  appearance,
  onAppearanceChange,
  defaultSound = false,
  sound,
  onSoundChange,
  prefetchModes,
  defaultTypography,
  onTypographyChange,
  spreadCover = 'auto',
  annotate = true,
  share = true,
  annotations: annotationsProp,
  defaultAnnotations,
  onAnnotationsChange,
  persistAnnotations = false,
  ai,
  onModeFallback,
  onCapabilitiesChange,
  onError,
  onStatusChange,
}: BookPreviewProps) {
  const propSource = useMemo(() => normalizeSource(source), [source])
  const urlKeys = resolveUrlKeys(urlState, pageParamProp)
  const pageParam = urlKeys.page
  const propSourceKey = sourceIdentity(propSource)
  const enabledEngines = useMemo(
    () => resolveEnabledEngines(engines, enabledModes),
    [engines, enabledModes],
  )
  const modeControlled = mode !== undefined
  const pageControlled = pageIndex !== undefined
  const appearanceControlled = appearance !== undefined
  const soundControlled = sound !== undefined

  const initialResolution = resolveActiveEngine({
    requestedMode: mode ?? defaultMode,
    engines: enabledEngines,
    source: propSource,
  })

  // State lives in an external store: dispatches fire prop notifications
  // transactionally with the transition, and subscribers read a stable snapshot
  // through useSyncExternalStore instead of a post-commit notify effect.
  const [store] = useState(() =>
    createPreviewStore(
      createInitialState({
        mode: initialResolution.engine?.id ?? defaultMode,
        pageIndex: defaultPageIndex,
        appearance: defaultAppearance,
        sound: defaultSound,
      }),
    ),
  )
  const state = useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState,
  )
  const dispatch = store.dispatch
  const [navigationBehavior, setNavigationBehavior] =
    useState<BookPreviewNavigationBehavior>('animated')
  const rootRef = useRef<HTMLDivElement | null>(null)

  const { upload, uploadPdf } = useUploadedPdf({
    sourceKey: propSourceKey,
    allowUpload: propSource.allowPdfUpload,
    dispatch,
  })
  // The upload's object URL joins the source identity, so a new document
  // resets position and becomes visible to every compatible engine.
  const normalized = useMemo<NormalizedBookSource>(
    () =>
      upload
        ? {
            ...propSource,
            pdfUrl: upload.url,
            pdfFileName: upload.name,
            // Download must hand back the reader's own file, not whatever
            // document the host configured before the upload.
            downloadUrl: upload.url,
            downloadFileName: upload.name,
          }
        : propSource,
    [propSource, upload],
  )
  const sourceKey = sourceIdentity(normalized)
  // What the reader remembers (position, highlights, ink) is keyed by the
  // document, not the session: an upload's blob: URL is new every time, so
  // uploads are identified by file fingerprint instead. Re-opening the same
  // file brings its notebook back.
  const storageKey = upload
    ? sourceIdentity({ ...normalized, pdfUrl: `upload:${upload.fingerprint}` })
    : sourceKey

  const reducedMotion = usePrefersReducedMotion()
  const reducedTransparency = usePrefersReducedTransparency()
  const moreContrast = usePrefersMoreContrast()
  const finePointer = useFinePointer()
  const { fullscreen, cssImmersive, setCssImmersive, toggleFullscreen } =
    useFullscreen(rootRef)
  const { typography, setTypography } = useTypography({
    persist: persistPreferences,
    defaultTypography,
    onTypographyChange,
  })
  const rootStyle = useMemo(
    () =>
      ({
        ...bookPreviewMotionStyle,
        ...typographyVariables(typography),
      }) as CSSProperties,
    [typography],
  )
  const {
    chromeHidden,
    chromePinned,
    showChrome,
    toggleChrome,
    togglePinned,
    hideForReading,
    chromeHandlers,
  } = useImmersiveChrome({
    enabled: fullscreen,
    rootRef,
  })
  // Two-page layout: the spreads choice is a remembered reader preference;
  // the cover defaults from the document and a reader's override lasts for
  // that document only.
  const [spreadsPref, setSpreadsPref] = useState<BookPreviewSpreads>('auto')
  useEffect(() => {
    if (!persistPreferences) return
    const stored = readBookPreviewPrefs().spreads
    // Stored preferences are read after mount so hydration stays clean.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setSpreadsPref(stored)
  }, [persistPreferences])
  const setSpreads = useCallback(
    (next: BookPreviewSpreads) => {
      setSpreadsPref(next)
      if (persistPreferences) writeBookPreviewPrefs({ spreads: next })
    },
    [persistPreferences],
  )
  const autoCover =
    spreadCover === 'auto' ? Boolean(normalized.pages[0]?.isCover) : spreadCover
  const [coverOverride, setCoverOverride] = useState<{
    source: string
    cover: boolean
  } | null>(null)
  const cover =
    coverOverride?.source === sourceKey ? coverOverride.cover : autoCover
  const setCover = useCallback(
    (next: boolean) => setCoverOverride({ source: sourceKey, cover: next }),
    [sourceKey],
  )
  const pageLayout = useMemo(
    () => ({ spreads: spreadsPref, cover }),
    [cover, spreadsPref],
  )
  const [shortcutsOpen, setShortcutsOpenState] = useState(false)
  const [engineShortcutsAvailable, setEngineShortcutsAvailable] = useState({
    search: false,
    zoom: false,
  })
  const setShortcutsOpen = useCallback(
    (open: boolean) => {
      if (open) {
        // The sheet anchors to the toolbar; in fullscreen, bring it back.
        showChrome()
        const engine = engineShortcutsRef.current
        setEngineShortcutsAvailable({
          search: Boolean(engine.search),
          zoom: Boolean(engine.zoomIn),
        })
      }
      setShortcutsOpenState(open)
    },
    [showChrome],
  )
  const chrome = useMemo(
    () => ({
      hidden: chromeHidden,
      pinned: chromePinned,
      toggle: toggleChrome,
      togglePinned,
    }),
    [chromeHidden, chromePinned, toggleChrome, togglePinned],
  )

  const activeMode = pickControlled(mode, state.mode)
  const activePage = pickControlled(pageIndex, state.pageIndex)
  const activeAppearance = pickControlled(appearance, state.appearance)
  const activeSound = pickControlled(sound, state.sound)
  // Turning the page puts fullscreen chrome away — reading has resumed.
  const lastPageRef = useRef(activePage)
  useEffect(() => {
    if (lastPageRef.current === activePage) return
    lastPageRef.current = activePage
    hideForReading()
  }, [activePage, hideForReading])
  const compatibleEngines = useMemo(
    () => resolveCompatibleEngines(enabledEngines, normalized),
    [enabledEngines, normalized],
  )
  const activeResolution = resolveActiveEngine({
    requestedMode: activeMode,
    engines: enabledEngines,
    source: normalized,
  })
  const activeEngine = activeResolution.engine
  const effectiveMode = activeEngine?.id ?? activeMode

  const [pageStep, setPageStepState] = useState<BookPreviewPageStep | null>(
    null,
  )
  const setPageStep = useCallback(
    (step: BookPreviewPageStep | null) => setPageStepState(() => step),
    [],
  )
  const {
    setMode,
    goToPage,
    stepPage,
    nextPage,
    prevPage,
    setAppearance,
    setSound,
    retry,
    handleEngineReady,
    handleEngineError,
  } = useBookPreviewActions({
    pageStep,
    modeControlled,
    pageControlled,
    appearanceControlled,
    soundControlled,
    activePage,
    totalPages: state.totalPages,
    dispatch,
    setNavigationBehavior,
    onModeChange,
    onPageChange,
    onAppearanceChange,
    onSoundChange,
    onCapabilitiesChange,
  })

  const prefetchMode = useCallback(
    (next: BookPreviewMode) => {
      if (!shouldPrefetchEngines()) return
      const engine = enabledEngines.find((item) => item.id === next)
      void engine?.load().catch(() => {})
    },
    [enabledEngines],
  )

  // Runs before useEngineLoader so a source change dispatches reset-source
  // first and the loader's status transition (loading/empty/unsupported)
  // lands last, matching the pre-extraction effect order.
  const minutesLeft = useReadingPace(
    activePage,
    state.totalPages,
    sourceKey,
    persistPage ? storageKey : null,
  )
  const { resume, dismissResume } = usePersistedPageIndex({
    sourceKey,
    storageKey,
    persistPage,
    pageParam,
    pageControlled,
    pageIndex,
    defaultPageIndex,
    status: state.status,
    totalPages: state.totalPages,
    activePage,
    goToPage,
    dispatch,
  })

  const loadedEngine = useEngineLoader({
    normalized,
    activeEngine,
    sourceKey,
    engineEpoch: state.engineEpoch,
    dispatch,
  })

  usePrefetchEngines({ prefetchModes, prefetchMode })

  usePersistedPreferences({
    enabled: persistPreferences,
    appearanceControlled,
    modeControlled,
    activeAppearance,
    activeMode,
    dispatch,
  })

  const enabledModeIds = useMemo(
    () => enabledEngines.map((engine) => engine.id),
    [enabledEngines],
  )
  useUrlReaderState({
    modeKey: urlKeys.mode,
    appearanceKey: urlKeys.appearance,
    activeMode,
    activeAppearance,
    enabledModes: enabledModeIds,
    setMode,
    setAppearance,
  })

  // Tell the consumer when an incompatible request quietly landed on another
  // engine, so a host can surface "WebGL isn't available for PDFs" instead of
  // a silent mode switch.
  const fallbackNotifiedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!activeResolution.fallback || !activeEngine) {
      fallbackNotifiedRef.current = null
      return
    }
    const key = `${activeMode}:${activeEngine.id}`
    if (fallbackNotifiedRef.current === key) return
    fallbackNotifiedRef.current = key
    onModeFallback?.(activeMode, activeEngine.id)
  }, [activeResolution.fallback, activeEngine, activeMode, onModeFallback])

  // Register the prop listeners on the store and replay the current snapshot —
  // the same emissions the previous mount/dep-driven effects produced. From
  // here on, store.dispatch notifies them inline with each state transition.
  useEffect(() => {
    store.setListeners({ onStatusChange, onError })
    store.emitCurrent()
  }, [store, onStatusChange, onError])

  useEffect(() => () => stopPageTurnSounds(), [])

  const engineShortcutsRef = useRef<BookPreviewEngineShortcuts>({})

  const { annotations, updateAnnotations } = useAnnotations({
    sourceKey: storageKey,
    annotations: annotationsProp,
    defaultAnnotations,
    onAnnotationsChange,
    persist: persistAnnotations,
  })

  // The companion sheet: the notebook (highlights, notes, bookmarks) and Ask.
  const [companion, setCompanion] = useState<{
    open: boolean
    tab: BookPreviewCompanionTab
    askSeed: BookPreviewAskSeed | null
  }>({ open: false, tab: 'notes', askSeed: null })
  const openCompanion = useCallback(
    (
      tab: BookPreviewCompanionTab,
      askSeed?: Omit<BookPreviewAskSeed, 'nonce'>,
    ) =>
      setCompanion((current) => ({
        open: true,
        tab,
        askSeed: askSeed
          ? { ...askSeed, nonce: (current.askSeed?.nonce ?? 0) + 1 }
          : current.askSeed,
      })),
    [],
  )
  const setCompanionOpen = useCallback(
    (open: boolean) => setCompanion((current) => ({ ...current, open })),
    [],
  )
  const setCompanionTab = useCallback(
    (tab: BookPreviewCompanionTab) =>
      setCompanion((current) => ({ ...current, tab })),
    [],
  )

  const [draw, setDrawState] = useState<BookPreviewDrawState>({
    active: false,
    tool: 'pen',
    color: 'ink',
  })
  const setDraw = useCallback(
    (patch: Partial<BookPreviewDrawState>) =>
      setDrawState((current) => ({ ...current, ...patch })),
    [],
  )
  const [inkAvailable, setInkAvailable] = useState(false)

  // Share: the link (which carries page, mode, view and paper when urlState
  // is on) through the system share sheet, or copied. An uploaded PDF has no
  // link to share, so the file itself goes to the sheet where supported.
  const sharePage = useCallback(
    (extra?: { text?: string }) =>
      shareOrCopy({
        title: normalized.title ?? normalized.pdfFileName ?? label,
        text: extra?.text,
        url: upload ? undefined : window.location.href,
        file: upload && !extra?.text ? upload.file : undefined,
      }),
    [label, normalized.pdfFileName, normalized.title, upload],
  )

  const getPageText = useCallback(
    (index: number) => {
      const fromEngine = engineShortcutsRef.current.pageText?.(index)
      if (fromEngine) return fromEngine
      const root = rootRef.current
      const surfaces = root
        ? root.querySelectorAll<HTMLElement>(
            `[data-bp-annotatable][data-page-index="${index}"]`,
          )
        : []
      const fromDom = Array.from(surfaces, (el) => el.textContent ?? '')
        .join(' ')
        .trim()
      if (fromDom) return fromDom
      const page = normalized.pages[index]
      return page ? pageSearchText(page) : ''
    },
    [normalized.pages],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isReaderKeyboardEvent(event.nativeEvent, rootRef.current)) return
      const shortcuts = engineShortcutsRef.current
      if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        event.preventDefault()
        stepPage(1, 'instant')
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        stepPage(-1, 'instant')
      }
      if (event.key === ' ') {
        event.preventDefault()
        stepPage(event.shiftKey ? -1 : 1, 'instant')
      }
      if (event.key === 'Home') {
        event.preventDefault()
        goToPage(0, 'instant')
      }
      if (event.key === 'End') {
        event.preventDefault()
        goToPage(Math.max(state.totalPages - 1, 0), 'instant')
      }
      if (
        (event.key === 'f' || event.key === 'F') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault()
        toggleFullscreen()
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === 'f' || event.key === 'F')
      ) {
        if (shortcuts.search) {
          event.preventDefault()
          shortcuts.search()
        }
      }
      if (
        event.key === '/' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (shortcuts.search) {
          event.preventDefault()
          shortcuts.search()
        }
      }
      if (
        (event.key === '+' || event.key === '=') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (shortcuts.zoomIn) {
          event.preventDefault()
          shortcuts.zoomIn()
        }
      }
      if (
        (event.key === '-' || event.key === '_') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (shortcuts.zoomOut) {
          event.preventDefault()
          shortcuts.zoomOut()
        }
      }
      if (
        event.key === '0' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        if (shortcuts.zoomReset) {
          event.preventDefault()
          shortcuts.zoomReset()
        }
      }
      if (
        (event.key === 'b' || event.key === 'B') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        state.totalPages > 0
      ) {
        event.preventDefault()
        updateAnnotations((list) => toggleBookmark(list, activePage))
      }
      if (
        (event.key === 'd' || event.key === 'D') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        annotate &&
        inkAvailable
      ) {
        event.preventDefault()
        setDraw({ active: !draw.active })
      }
      if (
        (event.key === 'c' || event.key === 'C') &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        fullscreen
      ) {
        event.preventDefault()
        toggleChrome()
      }
      if (event.key === '?' && !event.metaKey && !event.ctrlKey) {
        event.preventDefault()
        setShortcutsOpen(true)
      }
      if (event.key === 'Escape' && draw.active) {
        // Putting the pen down comes before closing any overlay.
        event.preventDefault()
        setDraw({ active: false })
        return
      }
      if (event.key === 'Escape') {
        // Overlays first (engine search/thumbnail sheets), then immersive.
        if (shortcuts.dismiss?.()) {
          event.preventDefault()
          return
        }
        if (cssImmersive) {
          event.preventDefault()
          setCssImmersive(false)
        }
      }
    },
    [
      stepPage,
      activePage,
      cssImmersive,
      goToPage,
      setCssImmersive,
      state.totalPages,
      toggleFullscreen,
      updateAnnotations,
      annotate,
      fullscreen,
      toggleChrome,
      setShortcutsOpen,
      draw.active,
      inkAvailable,
      setDraw,
    ],
  )

  // Clicks on dead space should arm keyboard navigation — browsers do not
  // move focus to a region just because a descendant was clicked.
  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    if (isInteractiveTarget(event.nativeEvent.target)) return
    rootRef.current?.focus({ preventScroll: true })
  }, [])

  // A pointer click leaves focus on the activated control, where arrow keys
  // would stop working — clicking Next then pressing → must turn the page.
  // Return focus to the reader root on the next frame: detail===0 means a
  // keyboard-driven activation (focus must stay), and menus restore focus to
  // their trigger after the click, which the deferral wins.
  const onClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (event.detail === 0) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (
      target.closest(
        "button, a[href], [role='menuitem'], [data-book-preview-press]",
      )
    ) {
      requestAnimationFrame(() => {
        // A trigger that just opened a popover or menu owns focus now —
        // pulling it back to the root would dismiss what it opened.
        if (target.closest('[aria-expanded="true"], [data-popup-open]')) return
        const root = rootRef.current
        // Only reclaim focus that stayed inside the reader — a click that
        // deliberately moved it elsewhere (dialog, external focus) wins.
        const active = document.activeElement
        if (
          root &&
          active instanceof HTMLElement &&
          active !== document.body &&
          !root.contains(active)
        ) {
          return
        }
        root?.focus({ preventScroll: true })
      })
    }
  }, [])

  const [dropActive, setDropActive] = useState(false)
  const dragDepthRef = useRef(0)

  const onDragEnter = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!eventHasFiles(event)) return
      event.preventDefault()
      dragDepthRef.current += 1
      if (propSource.allowPdfUpload) setDropActive(true)
    },
    [propSource.allowPdfUpload],
  )
  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!eventHasFiles(event)) return
    event.preventDefault()
  }, [])
  const onDragLeave = useCallback(() => {
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDropActive(false)
  }, [])
  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!eventHasFiles(event)) return
      // Always swallow file drops — letting the browser navigate away with
      // the PDF is the worst outcome for a reader surface.
      event.preventDefault()
      dragDepthRef.current = 0
      setDropActive(false)
      const file = Array.from(event.dataTransfer.files).find(isPdfFile)
      if (file) {
        uploadPdf(file)
        return
      }
      if (propSource.allowPdfUpload && event.dataTransfer.files.length > 0) {
        dispatch({
          type: 'engine-error',
          error: { kind: 'upload', message: 'Only PDF files can be uploaded.' },
        })
      }
    },
    [dispatch, propSource.allowPdfUpload, uploadPdf],
  )

  // The toolbar renders a slot this element fills; engines portal their
  // controls into it so the reader has one chrome bar, not two stacked rows.
  const [chromeHost, setChromeHost] = useState<HTMLElement | null>(null)

  const contextValue = useMemo<BookPreviewContextValue>(
    () => ({
      state: {
        ...state,
        mode: effectiveMode,
        pageIndex: activePage,
        appearance: activeAppearance,
        sound: activeSound,
        capabilities: {
          ...state.capabilities,
          fullscreen: true,
        },
      },
      source: normalized,
      label,
      enabledEngines: compatibleEngines,
      reducedMotion,
      reducedTransparency,
      moreContrast,
      finePointer,
      canGoPrev: pageStep ? pageStep(activePage, -1) !== null : activePage > 0,
      canGoNext: pageStep
        ? pageStep(activePage, 1) !== null
        : activePage < state.totalPages - 1,
      setMode,
      goToPage,
      nextPage,
      prevPage,
      setAppearance,
      setSound,
      typography,
      setTypography,
      retry,
      prefetchMode,
      uploadPdf,
      engineShortcutsRef,
      setPageStep,
      toggleFullscreen,
      fullscreen,
      chrome,
      shortcutsOpen,
      setShortcutsOpen,
      engineShortcutsAvailable,
      pageLayout,
      setSpreads,
      setCover,
      resume,
      dismissResume,
      minutesLeft,
      chromeHost,
      setChromeHost,
      rootRef,
      annotate,
      annotations,
      updateAnnotations,
      ai,
      companion,
      openCompanion,
      setCompanionOpen,
      setCompanionTab,
      getPageText,
      draw,
      setDraw,
      inkAvailable,
      setInkAvailable,
      share,
      sharePage,
      uploaded: Boolean(upload),
    }),
    [
      activeAppearance,
      ai,
      annotate,
      annotations,
      companion,
      compatibleEngines,
      getPageText,
      draw,
      inkAvailable,
      setDraw,
      share,
      sharePage,
      upload,
      openCompanion,
      setCompanionOpen,
      setCompanionTab,
      updateAnnotations,
      effectiveMode,
      setPageStep,
      pageStep,
      activePage,
      activeSound,
      finePointer,
      fullscreen,
      chrome,
      shortcutsOpen,
      setShortcutsOpen,
      engineShortcutsAvailable,
      pageLayout,
      setSpreads,
      setCover,
      resume,
      dismissResume,
      minutesLeft,
      goToPage,
      label,
      moreContrast,
      nextPage,
      normalized,
      prefetchMode,
      prevPage,
      chromeHost,
      reducedMotion,
      reducedTransparency,
      retry,
      setAppearance,
      setMode,
      setSound,
      setTypography,
      state,
      toggleFullscreen,
      typography,
      uploadPdf,
    ],
  )

  return (
    <TooltipProvider>
      <BookPreviewProvider value={contextValue}>
        <section
          ref={rootRef}
          className={cn(
            'book-preview focus-visible:ring-ring/60 focus-visible:ring-offset-background relative flex w-full min-w-0 flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            className,
          )}
          style={rootStyle}
          tabIndex={0}
          aria-label={label}
          aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Home End Space f b d / + - 0 Escape"
          data-reduced-motion={reducedMotion || undefined}
          data-reduced-transparency={reducedTransparency || undefined}
          data-more-contrast={moreContrast || undefined}
          data-book-preview-immersive={fullscreen || undefined}
          data-chrome-hidden={chromeHidden || undefined}
          // The reader's cursors mean something (I-beam, grab, crosshair) —
          // site-wide custom cursors step aside here.
          data-native-cursor=""
          data-layout={layout}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={chromeHandlers.onPointerMove}
          onPointerLeave={chromeHandlers.onPointerLeave}
          onPointerDownCapture={chromeHandlers.onPointerDownCapture}
          onPointerUpCapture={chromeHandlers.onPointerUpCapture}
          onFocusCapture={(event) => {
            // Tabbing into hidden chrome brings it back — keyboard users
            // must never land focus on something they cannot see.
            if (
              chromeHidden &&
              (event.target as HTMLElement).closest?.(
                '[data-book-preview-chrome]',
              )
            ) {
              showChrome()
            }
          }}
          onClick={onClick}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <BookPreviewToolbar />
          <BookPreviewViewport>
            <BookPreviewActiveEngine
              loadedEngine={loadedEngine}
              activeEngineId={activeEngine?.id}
              resetKey={`${sourceKey}:${state.engineEpoch}`}
              source={normalized}
              pageIndex={activePage}
              appearance={activeAppearance}
              soundEnabled={activeSound}
              reducedMotion={reducedMotion}
              navigationBehavior={navigationBehavior}
              persistPreferences={persistPreferences}
              viewParam={urlKeys.view}
              onPageChange={goToPage}
              onReady={handleEngineReady}
              onError={handleEngineError}
            />
            <BookPreviewBookmarkRibbon />
            <BookPreviewSideArrows />
            <BookPreviewResume />
          </BookPreviewViewport>
          <BookPreviewNavigation />
          <BookPreviewAnnotationLayer />
          <BookPreviewInkLayer />
          <BookPreviewCompanion />
          <BookPreviewChromeHandle />
          <p className="sr-only">
            Arrow keys, Page Up and Page Down turn pages while this reader is
            focused. Space moves forward, F toggles fullscreen, B bookmarks the
            page, D picks up the pen to draw on it, slash or Control F opens
            search when the active reader supports it, and plus, minus and zero
            control zoom. In fullscreen, C shows or hides the controls; question
            mark lists every shortcut. Select text to highlight it. Typing in
            fields is ignored.
          </p>
          {dropActive ? (
            <div
              className="border-primary bg-background/80 pointer-events-none absolute inset-0 z-50 flex items-center justify-center rounded-xl border-2 border-dashed backdrop-blur-sm"
              data-book-preview-drop
            >
              <p className="text-sm font-medium">Drop PDF to open</p>
            </div>
          ) : null}
        </section>
      </BookPreviewProvider>
    </TooltipProvider>
  )
}

export { pageEngine } from './engines'
