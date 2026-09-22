import type { BookPreviewCapabilities } from './types'

export const DEFAULT_CAPABILITIES: BookPreviewCapabilities = {
  pagination: true,
  spreads: false,
  curl: false,
  zoom: false,
  loupe: false,
  search: false,
  speech: false,
  fullscreen: true,
  download: false,
  upload: false,
  appearance: true,
  sound: true,
  thumbnails: false,
  webgl: false,
}

export function mergeCapabilities(
  base: BookPreviewCapabilities,
  patch: Partial<BookPreviewCapabilities>,
): BookPreviewCapabilities {
  return { ...base, ...patch }
}

export function capabilitiesEqual(
  left: BookPreviewCapabilities,
  right: BookPreviewCapabilities,
): boolean {
  const keys = Object.keys(left) as Array<keyof BookPreviewCapabilities>
  return keys.every((key) => left[key] === right[key])
}

let webglSupport: boolean | null = null

export function hasWebGLSupport(): boolean {
  if (typeof document === 'undefined') return false
  if (webglSupport !== null) return webglSupport
  try {
    const canvas = document.createElement('canvas')
    webglSupport = Boolean(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl'),
    )
    return webglSupport
  } catch {
    webglSupport = false
    return false
  }
}

export function hasSpeechSupport(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export function hasFullscreenSupport(): boolean {
  return typeof document !== 'undefined' && Boolean(document.fullscreenEnabled)
}

export function hasAudioSupport(): boolean {
  if (typeof window === 'undefined') return false
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  return Boolean(AudioContextClass)
}
