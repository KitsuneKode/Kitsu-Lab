"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import { hasFullscreenSupport } from "./capabilities"

function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return () => {}
      }
      const media = window.matchMedia(query)
      media.addEventListener("change", onChange)
      return () => media.removeEventListener("change", onChange)
    },
    [query]
  )
  const getSnapshot = useCallback(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false
    }
    return window.matchMedia(query).matches
  }, [query])
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)")
}

export function usePrefersReducedTransparency(): boolean {
  return useMediaQuery("(prefers-reduced-transparency: reduce)")
}

export function usePrefersMoreContrast(): boolean {
  return useMediaQuery("(prefers-contrast: more)")
}

export function useFinePointer(): boolean {
  return useMediaQuery("(hover: hover) and (pointer: fine)")
}

export function useNarrowLayout(): boolean {
  return useMediaQuery("(max-width: 40rem)")
}

export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)")
}

export function useFullscreenSupport(): boolean {
  // Static per page load — no subscription needed. Server snapshot is false so
  // SSR/hydration never renders a fullscreen affordance that can't work.
  return useSyncExternalStore(
    () => () => {},
    () => hasFullscreenSupport(),
    () => false
  )
}

export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === "visible")
    update()
    document.addEventListener("visibilitychange", update)
    return () => document.removeEventListener("visibilitychange", update)
  }, [])

  return visible
}
