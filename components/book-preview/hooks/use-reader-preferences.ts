'use client'

import { readBookPreviewPrefs, writeBookPreviewPrefs } from '../prefs'
import { pickAllowed, readUrlParam, writeUrlParams } from '../url-state'
import { type BookPreviewAction } from '../reducer'
import { DEFAULT_TYPOGRAPHY, type BookPreviewTypography } from '../typography'
import { BOOK_PREVIEW_APPEARANCES } from '../types'
import type {
  BookPreviewAppearance,
  BookPreviewMode,
  BookPreviewProps,
} from '../types'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type Dispatch,
} from 'react'
import { noopSubscribe } from '../reader-utils'

// Appearance and mode are "how I like my reader" settings — they belong to
// the person, not the document, so they persist globally rather than per
// source. Controlled props always win over the remembered value.
export function usePersistedPreferences({
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
export function useUrlReaderState({
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
export function useTypography({
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
