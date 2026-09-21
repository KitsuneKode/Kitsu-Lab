"use client"

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
  type KeyboardEvent,
  type RefObject,
  type SetStateAction,
} from "react"
import { cn } from "@/lib/utils"
import { TooltipProvider } from "@/components/ui/tooltip"
import { stopPageTurnSounds } from "./audio"
import { BookPreviewEngineBoundary } from "./book-preview-engine-boundary"
import { BookPreviewNavigation } from "./book-preview-navigation"
import { BookPreviewProvider, type BookPreviewContextValue } from "./book-preview-provider"
import { BookPreviewToolbar } from "./book-preview-toolbar"
import { BookPreviewViewport } from "./book-preview-viewport"
import {
  describeEngineLoadFailure,
  resolveActiveEngine,
  resolveCompatibleEngines,
  resolveEnabledEngines,
  shouldPrefetchEngines,
} from "./engines"
import { isReaderKeyboardEvent } from "./keyboard"
import {
  usePrefersMoreContrast,
  usePrefersReducedMotion,
  usePrefersReducedTransparency,
  useFinePointer,
} from "./media"
import { bookPreviewMotionStyle } from "./motion"
import { clampPageIndex, isEmptySource, normalizeSource, sourceIdentity } from "./normalize"
import { createPreviewStore } from "./preview-store"
import { createInitialState, type BookPreviewAction } from "./reducer"
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
} from "./types"
import "./book-preview.css"

function pickControlled<T>(controlled: T | undefined, fallback: T): T {
  return controlled !== undefined ? controlled : fallback
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
    <BookPreviewEngineBoundary
      engineId={activeEngineId ?? "none"}
      resetKey={resetKey}
      onError={onError}
    >
      <EngineComponent {...engineProps} onError={onError} />
    </BookPreviewEngineBoundary>
  )
}

function useFullscreen(rootRef: RefObject<HTMLDivElement | null>) {
  const [nativeFullscreen, setNativeFullscreen] = useState(false)
  const [cssImmersive, setCssImmersive] = useState(false)

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
    if (typeof node.requestFullscreen === "function" && document.fullscreenEnabled) {
      void node.requestFullscreen().catch(() => setCssImmersive(true))
      return
    }
    setCssImmersive(true)
  }, [cssImmersive, rootRef])

  useEffect(() => {
    const onChange = () => setNativeFullscreen(Boolean(document.fullscreenElement === rootRef.current))
    document.addEventListener("fullscreenchange", onChange)
    return () => document.removeEventListener("fullscreenchange", onChange)
  }, [rootRef])

  useEffect(() => {
    if (!cssImmersive) return
    const root = document.documentElement
    const previous = root.style.overflow
    root.style.overflow = "hidden"
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setCssImmersive(false)
    }
    window.addEventListener("keydown", onKey)
    return () => {
      root.style.overflow = previous
      window.removeEventListener("keydown", onKey)
    }
  }, [cssImmersive])

  return {
    fullscreen: nativeFullscreen || cssImmersive,
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
      dispatch({ type: "empty" })
      return
    }
    if (!activeEngine) {
      dispatch({
        type: "engine-unsupported",
        message: "No compatible reader is available for this source.",
      })
      return
    }
    if (activeEngine.isSupported && !activeEngine.isSupported()) {
      dispatch({
        type: "engine-unsupported",
        message: `${activeEngine.label} is not supported in this browser.`,
      })
      return
    }

    let cancelled = false
    const engineId = activeEngine.id
    dispatch({ type: "engine-loading" })
    loadedRef.current = engineId
    activeEngine
      .load()
      .then((mod) => {
        if (cancelled || loadedRef.current !== engineId) return
        const EngineComponent = mod.default
        if (!EngineComponent) {
          dispatch({
            type: "engine-error",
            error: {
              kind: "engine-load",
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
          type: "engine-error",
          error: {
            kind: "engine-load",
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
  persistPage,
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
  persistPage: boolean
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
      type: "reset-source",
      pageIndex: reset.pageControlled ? reset.pageIndex : reset.defaultPageIndex,
    })
  }, [sourceKey, dispatch])

  const restoredKeyRef = useRef<string | null>(null)
  const persistKey = `book-preview:page:${sourceKey}`

  // Restore the remembered page once the source reports ready. Runs once per
  // source; skipped entirely while the consumer controls pageIndex.
  useEffect(() => {
    if (!persistPage || pageControlled) return
    if (status !== "ready" || restoredKeyRef.current === sourceKey) return
    restoredKeyRef.current = sourceKey
    try {
      const raw = window.localStorage.getItem(persistKey)
      const stored = raw === null ? Number.NaN : Number.parseInt(raw, 10)
      if (stored > 0 && stored < Math.max(totalPages, 1)) {
        queueMicrotask(() => goToPage(stored, "instant"))
      }
    } catch {
      // localStorage may be unavailable (private mode, sandboxed iframe).
    }
  }, [persistPage, pageControlled, sourceKey, persistKey, status, totalPages, goToPage])

  useEffect(() => {
    if (!persistPage || pageControlled || status !== "ready") return
    try {
      window.localStorage.setItem(persistKey, String(activePage))
    } catch {
      // localStorage may be unavailable.
    }
  }, [persistPage, pageControlled, status, persistKey, activePage])
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
  onModeChange: BookPreviewProps["onModeChange"]
  onPageChange: BookPreviewProps["onPageChange"]
  onAppearanceChange: BookPreviewProps["onAppearanceChange"]
  onSoundChange: BookPreviewProps["onSoundChange"]
  onCapabilitiesChange: BookPreviewProps["onCapabilitiesChange"]
}) {
  const setMode = useCallback(
    (next: BookPreviewMode) => {
      if (!modeControlled) dispatch({ type: "set-mode", mode: next })
      onModeChange?.(next)
    },
    [modeControlled, onModeChange, dispatch]
  )

  const goToPage = useCallback(
    (next: number, behavior: BookPreviewNavigationBehavior = "animated") => {
      const clamped = clampPageIndex(next, Math.max(totalPages, 1))
      setNavigationBehavior(behavior)
      if (!pageControlled) dispatch({ type: "set-page", pageIndex: clamped })
      onPageChange?.(clamped)
    },
    [onPageChange, pageControlled, totalPages, setNavigationBehavior, dispatch]
  )

  const nextPage = useCallback(() => goToPage(activePage + 1), [activePage, goToPage])
  const prevPage = useCallback(() => goToPage(activePage - 1), [activePage, goToPage])

  const setAppearance = useCallback(
    (next: BookPreviewAppearance) => {
      if (!appearanceControlled) dispatch({ type: "set-appearance", appearance: next })
      onAppearanceChange?.(next)
    },
    [appearanceControlled, onAppearanceChange, dispatch]
  )

  const setSound = useCallback(
    (next: boolean) => {
      if (!soundControlled) dispatch({ type: "set-sound", sound: next })
      onSoundChange?.(next)
    },
    [onSoundChange, soundControlled, dispatch]
  )

  const retry = useCallback(() => dispatch({ type: "retry" }), [dispatch])

  const handleEngineReady = useCallback(
    (info: BookPreviewEngineReadyInfo) => {
      dispatch({
        type: "engine-ready",
        totalPages: info.totalPages,
        capabilities: info.capabilities,
      })
      onCapabilitiesChange?.(info.capabilities)
    },
    [onCapabilitiesChange, dispatch]
  )

  const handleEngineError = useCallback(
    (error: BookPreviewError) => {
      dispatch({ type: "engine-error", error })
    },
    [dispatch]
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
      navigator as { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection
    if (conn?.saveData || conn?.effectiveType === "slow-2g" || conn?.effectiveType === "2g") {
      return
    }
    const run = () => {
      for (const modeId of wants) {
        if (prefetchedRef.current.has(modeId)) continue
        prefetchedRef.current.add(modeId)
        prefetchMode(modeId)
      }
    }
    if ("requestIdleCallback" in window) {
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
  label = "Book preview",
  engines,
  enabledModes,
  defaultMode = "page",
  mode,
  onModeChange,
  defaultPageIndex = 0,
  pageIndex,
  onPageChange,
  persistPage = false,
  defaultAppearance = "system",
  appearance,
  onAppearanceChange,
  defaultSound = false,
  sound,
  onSoundChange,
  prefetchModes,
  onCapabilitiesChange,
  onError,
  onStatusChange,
}: BookPreviewProps) {
  const normalized = useMemo(() => normalizeSource(source), [source])
  const sourceKey = sourceIdentity(normalized)
  const enabledEngines = useMemo(
    () => resolveEnabledEngines(engines, enabledModes),
    [engines, enabledModes]
  )
  const modeControlled = mode !== undefined
  const pageControlled = pageIndex !== undefined
  const appearanceControlled = appearance !== undefined
  const soundControlled = sound !== undefined

  const initialResolution = resolveActiveEngine({
    requestedMode: mode ?? defaultMode,
    engines: enabledEngines,
    source: normalized,
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
      })
    )
  )
  const state = useSyncExternalStore(store.subscribe, store.getState, store.getState)
  const dispatch = store.dispatch
  const [navigationBehavior, setNavigationBehavior] =
    useState<BookPreviewNavigationBehavior>("animated")
  const rootRef = useRef<HTMLDivElement | null>(null)

  const reducedMotion = usePrefersReducedMotion()
  const reducedTransparency = usePrefersReducedTransparency()
  const moreContrast = usePrefersMoreContrast()
  const finePointer = useFinePointer()
  const { fullscreen, cssImmersive, setCssImmersive, toggleFullscreen } =
    useFullscreen(rootRef)

  const activeMode = pickControlled(mode, state.mode)
  const activePage = pickControlled(pageIndex, state.pageIndex)
  const activeAppearance = pickControlled(appearance, state.appearance)
  const activeSound = pickControlled(sound, state.sound)
  const compatibleEngines = useMemo(
    () => resolveCompatibleEngines(enabledEngines, normalized),
    [enabledEngines, normalized]
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
    [enabledEngines]
  )

  // Runs before useEngineLoader so a source change dispatches reset-source
  // first and the loader's status transition (loading/empty/unsupported)
  // lands last, matching the pre-extraction effect order.
  usePersistedPageIndex({
    sourceKey,
    persistPage,
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

  // Register the prop listeners on the store and replay the current snapshot —
  // the same emissions the previous mount/dep-driven effects produced. From
  // here on, store.dispatch notifies them inline with each state transition.
  useEffect(() => {
    store.setListeners({ onStatusChange, onError })
    store.emitCurrent()
  }, [store, onStatusChange, onError])

  useEffect(() => () => stopPageTurnSounds(), [])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!isReaderKeyboardEvent(event.nativeEvent, rootRef.current)) return
      if (event.key === "ArrowRight") {
        event.preventDefault()
        goToPage(activePage + 1, "instant")
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault()
        goToPage(activePage - 1, "instant")
      }
      if (event.key === "Home") {
        event.preventDefault()
        goToPage(0, "instant")
      }
      if (event.key === "End") {
        event.preventDefault()
        goToPage(Math.max(state.totalPages - 1, 0), "instant")
      }
      if (event.key === "Escape" && cssImmersive) {
        event.preventDefault()
        setCssImmersive(false)
      }
    },
    [activePage, cssImmersive, goToPage, setCssImmersive, state.totalPages]
  )

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
      retry,
      prefetchMode,
      toggleFullscreen,
      fullscreen,
    }),
    [
      activeAppearance,
      compatibleEngines,
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
      reducedMotion,
      reducedTransparency,
      retry,
      setAppearance,
      setMode,
      setSound,
      state,
      toggleFullscreen,
    ]
  )

  return (
    <TooltipProvider>
      <BookPreviewProvider value={contextValue}>
        <div
          ref={rootRef}
          className={cn(
            "book-preview flex w-full min-w-0 flex-col gap-4 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            className
          )}
          style={bookPreviewMotionStyle as CSSProperties}
          tabIndex={0}
          role="region"
          aria-label={label}
          aria-keyshortcuts="ArrowLeft ArrowRight Home End"
          data-reduced-motion={reducedMotion || undefined}
          data-reduced-transparency={reducedTransparency || undefined}
          data-more-contrast={moreContrast || undefined}
          data-book-preview-immersive={fullscreen || undefined}
          onKeyDown={onKeyDown}
        >
          <BookPreviewToolbar />
          <BookPreviewViewport>
            <BookPreviewActiveEngine
              loadedEngine={loadedEngine}
              activeEngineId={activeEngine?.id}
              resetKey={sourceKey}
              source={normalized}
              pageIndex={activePage}
              appearance={activeAppearance}
              soundEnabled={activeSound}
              reducedMotion={reducedMotion}
              navigationBehavior={navigationBehavior}
              onPageChange={goToPage}
              onReady={handleEngineReady}
              onError={handleEngineError}
            />
          </BookPreviewViewport>
          <BookPreviewNavigation />
          <p className="sr-only">
            Arrow keys turn pages while this reader is focused. Typing in fields is ignored.
          </p>
        </div>
      </BookPreviewProvider>
    </TooltipProvider>
  )
}

export { pageEngine } from "./engines"
