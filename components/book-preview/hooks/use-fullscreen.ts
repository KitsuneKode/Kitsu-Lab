'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

// Native fullscreen is requested on the document, not the reader: popups
// (menus, sheets, tooltips) portal to <body>, and only the fullscreen
// element's subtree is painted — fullscreening the reader itself would make
// every one of them invisible. The reader then covers the screen with its
// own immersive layout, the same one the CSS fallback uses on iOS.
export function useFullscreen(rootRef: RefObject<HTMLDivElement | null>) {
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
