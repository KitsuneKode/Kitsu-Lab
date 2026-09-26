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
import { readBookPreviewPrefs, writeBookPreviewPrefs } from './prefs'
import {
  parsePageParam,
  pickAllowed,
  readUrlParam,
  resolveUrlKeys,
  writeUrlParams,
} from './url-state'
import { createInitialState, type BookPreviewAction } from './reducer'
import { isInteractiveTarget, isReaderKeyboardEvent } from './keyboard'
import { BookPreviewEngineBoundary } from './book-preview-engine-boundary'
import { useImmersiveChrome } from './hooks/use-immersive-chrome'
import { useAnnotations } from './hooks/use-annotations'
import { toggleBookmark } from './annotations'
import { BookPreviewCompanion } from './book-preview-companion'
import { BookPreviewBookmarkRibbon } from './book-preview-bookmark-ribbon'
import { BookPreviewAnnotationLayer } from './book-preview-annotation-layer'
import { BookPreviewInkLayer } from './book-preview-ink-layer'
import { shareOrCopy } from './share'
import {
  DEFAULT_TYPOGRAPHY,
  typographyVariables,
  type BookPreviewTypography,
} from './typography'
import {
  clampPageIndex,
  isEmptySource,
  normalizeSource,
  pageSearchText,
  sourceIdentity,
} from './normalize'
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
} from './book-preview-provider'
import {
  describeEngineLoadFailure,
  resolveActiveEngine,
  resolveCompatibleEngines,
  resolveEnabledEngines,
  shouldPrefetchEngines,
} from './engines'
import { BOOK_PREVIEW_APPEARANCES } from './types'
import type {
  BookPreviewAppearance,
  BookPreviewEngine,
  BookPreviewEngineProps,
  BookPreviewEngineReadyInfo,
  BookPreviewError,
  BookPreviewMode,
  BookPreviewNavigationBehavior,
  BookPreviewProps,
  BookPreviewStatus,
  NormalizedBookSource,
} from './types'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type CSSProperties,
  type Dispatch,
  type DragEvent,
  type MouseEvent,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
  type SetStateAction,
} from 'react'

const noopSubscribe = () => () => {}

function pickControlled<T>(controlled: T | undefined, fallback: T): T {
  return controlled !== undefined ? controlled : fallback
}

function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

function eventHasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}

type BookPreviewActiveEngineProps = BookPreviewEngineProps & {
  loadedEngine: {
    id: BookPreviewMode
    Component: ComponentType<BookPreviewEngineProps>
  } | null
  activeEngineId?: BookPreviewMode
  resetKey: string
}

function BookPreviewActiveEngine({
  loadedEngine,
  activeEngineId,
  resetKey,
  onError,
  ...engineProps
}: BookPreviewActiveEngineProps) {
  if (!loadedEngine || loadedEngine.id !== activeEngineId) return null
  const EngineComponent = loadedEngine.Component
  return (
    // The key carries the engine epoch: a retry must remount the engine so a
    // dead document load (parse failure, cancelled password prompt) actually
    // starts over instead of sitting inert under the loading surface.
    <BookPreviewEngineBoundary
      key={resetKey}
      engineId={activeEngineId ?? 'none'}
      resetKey={resetKey}
      onError={onError}
    >
      <EngineComponent {...engineProps} onError={onError} />
    </BookPreviewEngineBoundary>
  )
}

// Native fullscreen is requested on the document, not the reader: popups
// (menus, sheets, tooltips) portal to <body>, and only the fullscreen
// element's subtree is painted — fullscreening the reader itself would make
// every one of them invisible. The reader then covers the screen with its
// own immersive layout, the same one the CSS fallback uses on iOS.
function useFullscreen(rootRef: RefObject<HTMLDivElement | null>) {
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [cssImmersive, setCssImmersive] = useState(false)
  const ownsFullscreenRef = useRef(false)

  const toggleFullscreen = useCallback(() => {
    const node = rootRef.current
    if (!node) return
    if (document.fullscreenElement) {
      void document.exitFullscreen?.().catch(() => {})
      return
    }
    if (cssImmersive) {
      setCssImmersive(false)
      return
    }
    const target = document.documentElement
    if (
      typeof target.requestFullscreen === 'function' &&
      document.fullscreenEnabled
    ) {
      ownsFullscreenRef.current = true
      void target.requestFullscreen().catch(() => {
        ownsFullscreenRef.current = false
        setCssImmersive(true)
      })
      return
    }
    setCssImmersive(true)
  }, [cssImmersive, rootRef])

  useEffect(() => {
    const onChange = () => {
      const active =
        ownsFullscreenRef.current &&
        document.fullscreenElement === document.documentElement
      if (!document.fullscreenElement) ownsFullscreenRef.current = false
      setNativeFullscreen(active)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // Leaving the page (or unmounting the reader) while it owns fullscreen
  // hands the screen back.
  useEffect(
    () => () => {
      if (ownsFullscreenRef.current && document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => {})
      }
    },
    [],
  )

  const immersive = nativeFullscreen || cssImmersive
  useEffect(() => {
    if (!immersive) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = 'hidden'
    root.setAttribute('data-book-preview-immersive', '')
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        setCssImmersive(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      root.style.overflow = previous
      root.removeAttribute('data-book-preview-immersive')
      window.removeEventListener('keydown', onKey)
    }
  }, [immersive])

  return {
    fullscreen: immersive,
    cssImmersive,
    setCssImmersive,
    toggleFullscreen,
  }
}

type LoadedEngine = {
  id: BookPreviewMode
  Component: ComponentType<BookPreviewEngineProps>
} | null

function useEngineLoader({
  normalized,
  activeEngine,
  sourceKey,
  engineEpoch,
  dispatch,
}: {
  normalized: NormalizedBookSource
  activeEngine: BookPreviewEngine | null
  sourceKey: string
  engineEpoch: number
  dispatch: Dispatch<BookPreviewAction>
}) {
  const [loadedEngine, setLoadedEngine] = useState<LoadedEngine>(null)
  const loadedRef = useRef<BookPreviewMode | null>(null)
  const normalizedRef = useRef(normalized)
  useEffect(() => {
    normalizedRef.current = normalized
  })

  useEffect(() => {
    const currentSource = normalizedRef.current
    if (isEmptySource(currentSource)) {
      dispatch({ type: 'empty' })
      return
    }
    if (!activeEngine) {
      dispatch({
        type: 'engine-unsupported',
        message: 'No compatible reader is available for this source.',
      })
      return
    }
    if (activeEngine.isSupported && !activeEngine.isSupported()) {
      dispatch({
        type: 'engine-unsupported',
        message: `${activeEngine.label} is not supported in this browser.`,
      })
      return
    }

    let cancelled = false
    const engineId = activeEngine.id
    dispatch({ type: 'engine-loading' })
    loadedRef.current = engineId
    activeEngine
      .load()
      .then((mod) => {
        if (cancelled || loadedRef.current !== engineId) return
        const EngineComponent = mod.default
        if (!EngineComponent) {
          dispatch({
            type: 'engine-error',
            error: {
              kind: 'engine-load',
              message: describeEngineLoadFailure(activeEngine.label),
            },
          })
          return
        }
        setLoadedEngine({ id: engineId, Component: EngineComponent })
      })
      .catch((error: unknown) => {
        if (cancelled || loadedRef.current !== engineId) return
        console.error(error)
        dispatch({
          type: 'engine-error',
          error: {
            kind: 'engine-load',
            message: describeEngineLoadFailure(activeEngine.label),
          },
        })
        setLoadedEngine(null)
      })
    return () => {
      cancelled = true
    }
  }, [activeEngine, sourceKey, engineEpoch, dispatch])

  return loadedEngine
}

function usePersistedPageIndex({
  sourceKey,
  storageKey,
  persistPage,
  pageParam,
  pageControlled,
  pageIndex,
  defaultPageIndex,
  status,
  totalPages,
  activePage,
  goToPage,
  dispatch,
}: {
  sourceKey: string
  /** Stable identity for localStorage (differs from sourceKey for uploads). */
  storageKey: string
  persistPage: boolean
  pageParam: string | undefined
  pageControlled: boolean
  pageIndex: number | undefined
  defaultPageIndex: number
  status: BookPreviewStatus
  totalPages: number
  activePage: number
  goToPage: (next: number, behavior?: BookPreviewNavigationBehavior) => void
  dispatch: Dispatch<BookPreviewAction>
}) {
  const sourceReady = useRef(false)
  const resetPageRef = useRef({ pageControlled, pageIndex, defaultPageIndex })
  useEffect(() => {
    resetPageRef.current = { pageControlled, pageIndex, defaultPageIndex }
  })

  // Reset only when the source itself changes. Page props live in a ref so a
  // controlled consumer's pageIndex updates do not trigger a source reset.
  useEffect(() => {
    if (!sourceReady.current) {
      sourceReady.current = true
      return
    }
    const reset = resetPageRef.current
    dispatch({
      type: 'reset-source',
      pageIndex: reset.pageControlled
        ? reset.pageIndex
        : reset.defaultPageIndex,
    })
  }, [sourceKey, dispatch])

  const restoredKeyRef = useRef<string | null>(null)
  const persistKey = `book-preview:page:${storageKey}`

  // Restore the position once the source reports ready. A deep-linked
  // ?page=N wins over the remembered position — a shared link should land on
  // the page it was shared from. Runs once per source; skipped entirely
  // while the consumer controls pageIndex.
  useEffect(() => {
    if (pageControlled || (!persistPage && !pageParam)) return
    // totalPages===0 gates this too: a password prompt reports a zero-page
    // ready state that must not consume the deep link before the document
    // is actually open.
    if (
      status !== 'ready' ||
      totalPages === 0 ||
      restoredKeyRef.current === sourceKey
    )
      return
    restoredKeyRef.current = sourceKey
    try {
      let target: number | null = pageParam
        ? parsePageParam(readUrlParam(pageParam))
        : null
      if (target === null && persistPage) {
        const raw = window.localStorage.getItem(persistKey)
        const stored = raw === null ? Number.NaN : Number.parseInt(raw, 10)
        if (stored > 0) target = stored
      }
      if (target !== null && target < Math.max(totalPages, 1)) {
        queueMicrotask(() => goToPage(target, 'instant'))
      }
    } catch {
      // localStorage or location may be unavailable (private mode, sandbox).
    }
  }, [
    persistPage,
    pageParam,
    pageControlled,
    sourceKey,
    persistKey,
    status,
    totalPages,
    goToPage,
  ])

  useEffect(() => {
    if (
      !persistPage ||
      pageControlled ||
      status !== 'ready' ||
      totalPages === 0
    )
      return
    try {
      window.localStorage.setItem(persistKey, String(activePage))
    } catch {
      // localStorage may be unavailable.
    }
  }, [persistPage, pageControlled, status, totalPages, persistKey, activePage])

  // Keep the deep link current as the reader moves. replaceState only —
  // turning pages must never spam the back stack.
  useEffect(() => {
    if (!pageParam || status !== 'ready' || totalPages === 0) return
    writeUrlParams({ [pageParam]: String(activePage + 1) })
  }, [pageParam, status, totalPages, activePage])
}

// Appearance and mode are "how I like my reader" settings — they belong to
// the person, not the document, so they persist globally rather than per
// source. Controlled props always win over the remembered value.
function usePersistedPreferences({
  enabled,
  appearanceControlled,
  modeControlled,
  activeAppearance,
  activeMode,
  dispatch,
}: {
  enabled: boolean
  appearanceControlled: boolean
  modeControlled: boolean
  activeAppearance: BookPreviewAppearance
  activeMode: BookPreviewMode
  dispatch: Dispatch<BookPreviewAction>
}) {
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!enabled || hydratedRef.current) return
    hydratedRef.current = true
    const prefs = readBookPreviewPrefs()
    if (prefs.appearance && !appearanceControlled) {
      dispatch({ type: 'set-appearance', appearance: prefs.appearance })
    }
    if (prefs.mode && !modeControlled) {
      dispatch({ type: 'set-mode', mode: prefs.mode })
    }
  }, [enabled, appearanceControlled, modeControlled, dispatch])

  useEffect(() => {
    if (!enabled) return
    writeBookPreviewPrefs({ appearance: activeAppearance, mode: activeMode })
  }, [enabled, activeAppearance, activeMode])
}

// Mode and paper live in the query string when the host opts in, so a shared
// link or a refresh opens the reader exactly as it was left. The URL wins over
// remembered preferences (it is the more specific intent) and is applied
// through the public actions, so controlled hosts hear about it too.
function useUrlReaderState({
  modeKey,
  appearanceKey,
  activeMode,
  activeAppearance,
  enabledModes,
  setMode,
  setAppearance,
}: {
  modeKey: string | undefined
  appearanceKey: string | undefined
  activeMode: BookPreviewMode
  activeAppearance: BookPreviewAppearance
  enabledModes: readonly BookPreviewMode[]
  setMode: (mode: BookPreviewMode) => void
  setAppearance: (appearance: BookPreviewAppearance) => void
}) {
  const hydratedRef = useRef(false)
  // Values read from the URL that have not landed in state yet — the write
  // effect holds off until they do, or it would clobber the link it just read.
  const pendingRef = useRef<{
    mode?: BookPreviewMode
    appearance?: BookPreviewAppearance
  }>({})

  useEffect(() => {
    if (hydratedRef.current) return
    hydratedRef.current = true
    const mode = pickAllowed(readUrlParam(modeKey), enabledModes)
    const appearance = pickAllowed(
      readUrlParam(appearanceKey),
      BOOK_PREVIEW_APPEARANCES,
    )
    // Applied even when it matches the current value: the remembered
    // preference was dispatched by an earlier effect this same commit, so the
    // value seen here is stale — and the link must win over the preference.
    if (mode) {
      pendingRef.current.mode = mode
      setMode(mode)
    }
    if (appearance) {
      pendingRef.current.appearance = appearance
      setAppearance(appearance)
    }
  }, [
    activeAppearance,
    activeMode,
    appearanceKey,
    enabledModes,
    modeKey,
    setAppearance,
    setMode,
  ])

  useEffect(() => {
    const pending = pendingRef.current
    if (pending.mode && pending.mode !== activeMode) return
    if (pending.appearance && pending.appearance !== activeAppearance) return
    pendingRef.current = {}
    writeUrlParams({
      ...(modeKey ? { [modeKey]: activeMode } : {}),
      ...(appearanceKey ? { [appearanceKey]: activeAppearance } : {}),
    })
  }, [activeAppearance, activeMode, appearanceKey, modeKey])
}

// Reading typography is the reader's own taste, like appearance: remembered
// globally when preferences persist, applied as CSS variables on the root so
// every text surface (page leaves, the premier text view) picks it up without
// prop drilling or re-rendering engines.
function useTypography({
  persist,
  defaultTypography,
  onTypographyChange,
}: {
  persist: boolean
  defaultTypography: Partial<BookPreviewTypography> | undefined
  onTypographyChange: BookPreviewProps['onTypographyChange']
}) {
  // The remembered settings are read during render once hydrated (the server
  // snapshot is false, so SSR markup stays deterministic); a choice made in
  // this session overrides them.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  )
  const stored = useMemo(
    () => (persist && hydrated ? readBookPreviewPrefs().typography : undefined),
    [hydrated, persist],
  )
  const [chosen, setChosen] = useState<BookPreviewTypography | null>(null)
  const typography = useMemo<BookPreviewTypography>(
    () => chosen ?? stored ?? { ...DEFAULT_TYPOGRAPHY, ...defaultTypography },
    [chosen, defaultTypography, stored],
  )
  const setTypography = useCallback(
    (next: BookPreviewTypography) => {
      setChosen(next)
      if (persist) writeBookPreviewPrefs({ typography: next })
      onTypographyChange?.(next)
    },
    [onTypographyChange, persist],
  )
  return { typography, setTypography }
}

// The shell owns uploaded documents: a picked or dropped File becomes an
// object URL merged into the normalized source, so every engine reads it
// through the same pdfUrl path — an upload made in pdf mode keeps working in
// scroll or curl. The URL is revoked on replace, on source change, and on
// unmount, all through one cleanup path.
function useUploadedPdf({
  sourceKey,
  allowUpload,
  dispatch,
}: {
  sourceKey: string
  allowUpload: boolean
  dispatch: Dispatch<BookPreviewAction>
}) {
  const [upload, setUpload] = useState<{
    url: string
    name: string
    /** Stable across uploads of the same file — the object URL is not. */
    fingerprint: string
    /** Kept so Share can hand the file itself to the share sheet — a link
        cannot carry a document that only exists on this device. */
    file: File
  } | null>(null)

  const uploadPdf = useCallback(
    (file: File) => {
      if (!allowUpload) return
      if (!isPdfFile(file)) {
        dispatch({
          type: 'engine-error',
          error: { kind: 'upload', message: 'Only PDF files can be uploaded.' },
        })
        return
      }
      setUpload({
        url: URL.createObjectURL(file),
        name: file.name,
        fingerprint: `${file.name}|${file.size}|${file.lastModified}`,
        file,
      })
    },
    [allowUpload, dispatch],
  )

  // Revokes the previous upload's URL whenever it is replaced and on unmount.
  useEffect(() => {
    return () => {
      if (upload) URL.revokeObjectURL(upload.url)
    }
  }, [upload])

  // A new consumer source drops whatever document the reader opened itself —
  // adjusted during render (the React-recommended alternative to an effect).
  const [lastSourceKey, setLastSourceKey] = useState(sourceKey)
  if (lastSourceKey !== sourceKey) {
    setLastSourceKey(sourceKey)
    setUpload(null)
  }

  return { upload, uploadPdf }
}

// The public action surface: each callback notifies the controlled listener
// and only dispatches to internal state when that prop is uncontrolled.
function useBookPreviewActions({
  modeControlled,
  pageControlled,
  appearanceControlled,
  soundControlled,
  activePage,
  totalPages,
  dispatch,
  setNavigationBehavior,
  onModeChange,
  onPageChange,
  onAppearanceChange,
  onSoundChange,
  onCapabilitiesChange,
}: {
  modeControlled: boolean
  pageControlled: boolean
  appearanceControlled: boolean
  soundControlled: boolean
  activePage: number
  totalPages: number
  dispatch: Dispatch<BookPreviewAction>
  setNavigationBehavior: Dispatch<SetStateAction<BookPreviewNavigationBehavior>>
  onModeChange: BookPreviewProps['onModeChange']
  onPageChange: BookPreviewProps['onPageChange']
  onAppearanceChange: BookPreviewProps['onAppearanceChange']
  onSoundChange: BookPreviewProps['onSoundChange']
  onCapabilitiesChange: BookPreviewProps['onCapabilitiesChange']
}) {
  const setMode = useCallback(
    (next: BookPreviewMode) => {
      if (!modeControlled) dispatch({ type: 'set-mode', mode: next })
      onModeChange?.(next)
    },
    [modeControlled, onModeChange, dispatch],
  )

  const goToPage = useCallback(
    (next: number, behavior: BookPreviewNavigationBehavior = 'animated') => {
      const clamped = clampPageIndex(next, Math.max(totalPages, 1))
      setNavigationBehavior(behavior)
      if (!pageControlled) dispatch({ type: 'set-page', pageIndex: clamped })
      onPageChange?.(clamped)
    },
    [onPageChange, pageControlled, totalPages, setNavigationBehavior, dispatch],
  )

  const nextPage = useCallback(
    () => goToPage(activePage + 1),
    [activePage, goToPage],
  )
  const prevPage = useCallback(
    () => goToPage(activePage - 1),
    [activePage, goToPage],
  )

  const setAppearance = useCallback(
    (next: BookPreviewAppearance) => {
      if (!appearanceControlled)
        dispatch({ type: 'set-appearance', appearance: next })
      onAppearanceChange?.(next)
    },
    [appearanceControlled, onAppearanceChange, dispatch],
  )

  const setSound = useCallback(
    (next: boolean) => {
      if (!soundControlled) dispatch({ type: 'set-sound', sound: next })
      onSoundChange?.(next)
    },
    [onSoundChange, soundControlled, dispatch],
  )

  const retry = useCallback(() => dispatch({ type: 'retry' }), [dispatch])

  const handleEngineReady = useCallback(
    (info: BookPreviewEngineReadyInfo) => {
      dispatch({
        type: 'engine-ready',
        totalPages: info.totalPages,
        capabilities: info.capabilities,
        contents: info.contents,
      })
      onCapabilitiesChange?.(info.capabilities)
    },
    [onCapabilitiesChange, dispatch],
  )

  const handleEngineError = useCallback(
    (error: BookPreviewError) => {
      dispatch({ type: 'engine-error', error })
    },
    [dispatch],
  )

  return {
    setMode,
    goToPage,
    nextPage,
    prevPage,
    setAppearance,
    setSound,
    retry,
    handleEngineReady,
    handleEngineError,
  }
}

// Warm requested engine chunks while the browser is idle so a mode switch
// feels instant, but never spend metered/slow connections on speculation.
function usePrefetchEngines({
  prefetchModes,
  prefetchMode,
}: {
  prefetchModes: BookPreviewMode[] | undefined
  prefetchMode: (next: BookPreviewMode) => void
}) {
  const prefetchedRef = useRef(new Set<BookPreviewMode>())
  useEffect(() => {
    const wants = prefetchModes ?? []
    if (wants.length === 0) return
    const conn = (
      navigator as {
        connection?: { saveData?: boolean; effectiveType?: string }
      }
    ).connection
    if (
      conn?.saveData ||
      conn?.effectiveType === 'slow-2g' ||
      conn?.effectiveType === '2g'
    ) {
      return
    }
    const run = () => {
      for (const modeId of wants) {
        if (prefetchedRef.current.has(modeId)) continue
        prefetchedRef.current.add(modeId)
        prefetchMode(modeId)
      }
    }
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(run, { timeout: 4000 })
      return () => window.cancelIdleCallback(id)
    }
    const timer = setTimeout(run, 1500)
    return () => clearTimeout(timer)
  }, [prefetchMode, prefetchModes])
}

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
  const { chromeHidden, showChrome, hideForReading, chromeHandlers } =
    useImmersiveChrome({
      enabled: fullscreen,
      rootRef,
    })

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

  const {
    setMode,
    goToPage,
    nextPage,
    prevPage,
    setAppearance,
    setSound,
    retry,
    handleEngineReady,
    handleEngineError,
  } = useBookPreviewActions({
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
  usePersistedPageIndex({
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
        goToPage(activePage + 1, 'instant')
      }
      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        event.preventDefault()
        goToPage(activePage - 1, 'instant')
      }
      if (event.key === ' ') {
        event.preventDefault()
        goToPage(activePage + (event.shiftKey ? -1 : 1), 'instant')
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
      activePage,
      cssImmersive,
      goToPage,
      setCssImmersive,
      state.totalPages,
      toggleFullscreen,
      updateAnnotations,
      annotate,
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
      canGoPrev: activePage > 0,
      canGoNext: activePage < state.totalPages - 1,
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
      toggleFullscreen,
      fullscreen,
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
      activePage,
      activeSound,
      finePointer,
      fullscreen,
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
          </BookPreviewViewport>
          <BookPreviewNavigation />
          <BookPreviewAnnotationLayer />
          <BookPreviewInkLayer />
          <BookPreviewCompanion />
          <p className="sr-only">
            Arrow keys, Page Up and Page Down turn pages while this reader is
            focused. Space moves forward, F toggles fullscreen, B bookmarks the
            page, D picks up the pen to draw on it, slash or Control F opens
            search when the active reader supports it, and plus, minus and zero
            control zoom. Select text to highlight it. Typing in fields is
            ignored.
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
