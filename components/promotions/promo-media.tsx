'use client'

import * as React from 'react'
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
} from '@tabler/icons-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import type { PromotionMedia } from './promotion'
import { usePromotionLabels } from './promotion-provider'

/** Save-Data, where the browser exposes it. */
function subscribeSaveData(onChange: () => void) {
  const connection = (
    navigator as Navigator & {
      connection?: EventTarget & { saveData?: boolean }
    }
  ).connection
  connection?.addEventListener('change', onChange)
  return () => connection?.removeEventListener('change', onChange)
}
function readSaveData() {
  return Boolean(
    (navigator as Navigator & { connection?: { saveData?: boolean } })
      .connection?.saveData,
  )
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/**
 * A promotion's picture: the still, and its silent clip when there is one.
 *
 * The still paints first and never leaves, so there is no black frame and
 * nothing shifts. The clip fades in over it once it is really playing, and
 * plays only while at least half of it is on screen, the tab is visible and
 * the surface says it is `active` (the showing slide, an open side card).
 * Reduced motion and Save-Data keep the still until the visitor presses play.
 *
 * Anything that moves for more than five seconds gets a pause control
 * (WCAG 2.2.2), and a visitor's own pause or play always wins.
 */
export function PromoMedia({
  media,
  className,
  imageClassName,
  aspect,
  fit = 'cover',
  eager = false,
  active = true,
  playback = 'loop',
  controls = true,
  onEnded,
  onPlayingChange,
  onDuration,
  onFallback,
}: {
  media: PromotionMedia
  /** Size the frame here (aspect ratio, width); the picture fills it. */
  className?: string
  imageClassName?: string
  /** CSS aspect-ratio for the frame, so nothing shifts while loading. */
  aspect?: string
  /** `contain` letterboxes, for frames whose shape differs from the media. */
  fit?: 'cover' | 'contain'
  /** Load the still at once (dialogs, sheets, the first slide). */
  eager?: boolean
  /** False pauses the clip, e.g. a slide that is not showing. */
  active?: boolean
  /** `loop` for ambient media; `once` plays through and calls `onEnded`. */
  playback?: 'loop' | 'once'
  controls?: boolean
  onEnded?: () => void
  /** Whether frames are advancing, e.g. to hold a story's progress bar. */
  onPlayingChange?: (playing: boolean) => void
  onDuration?: (seconds: number) => void
  /**
   * The clip will not play (it failed, or autoplay was refused) and the
   * still stands in, e.g. so a story times the slide itself instead of
   * waiting for an end that never comes.
   */
  onFallback?: () => void
}) {
  const labels = usePromotionLabels()
  const reduce = useReducedMotion()
  const saveData = React.useSyncExternalStore(
    subscribeSaveData,
    readSaveData,
    () => false,
  )
  const tabHidden = React.useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'hidden',
    () => false,
  )
  const frame = React.useRef<HTMLDivElement>(null)
  const video = React.useRef<HTMLVideoElement>(null)
  const [onScreen, setOnScreen] = React.useState(false)
  // null follows the rules above; a press is the visitor's decision.
  const [choice, setChoice] = React.useState<'play' | 'pause' | null>(null)
  const [started, setStarted] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  // Autoplay can be refused (Low Power Mode, a browser policy): the control
  // then offers Play, and pressing it is the gesture that is allowed to.
  const [refused, setRefused] = React.useState(false)
  const [stillFailed, setStillFailed] = React.useState(false)
  // A reused instance (a side-card pager, a gallery) can be handed another
  // picture: everything learned about the old one starts over. Adjusting
  // state during render avoids painting a frame with the old state.
  const [forSrc, setForSrc] = React.useState(media.src)
  if (forSrc !== media.src) {
    setForSrc(media.src)
    setChoice(null)
    setStarted(false)
    setFailed(false)
    setRefused(false)
    setStillFailed(false)
  }
  // Surfaces pass these inline; a ref keeps playback from re-running each render.
  const callbacks = React.useRef({
    onEnded,
    onPlayingChange,
    onDuration,
    onFallback,
  })
  React.useLayoutEffect(() => {
    callbacks.current = { onEnded, onPlayingChange, onDuration, onFallback }
  })

  const clip = failed ? undefined : media.video
  const autoplay = !reduce && !saveData
  const wantsPlay =
    Boolean(clip) &&
    active &&
    onScreen &&
    !tabHidden &&
    (choice === null ? autoplay && !refused : choice === 'play')

  React.useEffect(() => {
    const element = frame.current
    if (!clip || !element || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(Boolean(entry?.isIntersecting)),
      { threshold: 0.5 },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [clip])

  React.useEffect(() => {
    const element = video.current
    if (!element) return
    if (wantsPlay) {
      // Autoplay can still be refused (Low Power Mode); the still stays.
      element.play().catch((error: unknown) => {
        // AbortError only means a pause interrupted the request.
        if ((error as { name?: string } | null)?.name !== 'AbortError') {
          setRefused(true)
          callbacks.current.onFallback?.()
        }
        callbacks.current.onPlayingChange?.(false)
      })
    } else element.pause()
  }, [wantsPlay])

  // A clip that plays once starts over each time its surface comes back.
  React.useEffect(() => {
    const element = video.current
    if (!element || playback !== 'once' || !active) return
    element.currentTime = 0
  }, [active, playback])

  const imageLoading = eager ? 'eager' : 'lazy'
  return (
    <div
      ref={frame}
      data-slot="promo-media"
      data-playing={wantsPlay || undefined}
      style={aspect ? { aspectRatio: aspect } : undefined}
      className={cn('relative isolate overflow-hidden bg-current/5', className)}
    >
      {/* Plain img: the registry must not assume a framework image loader. */}
      {/* oxlint-disable-next-line nextjs/no-img-element */}
      <img
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        loading={imageLoading}
        decoding="async"
        draggable={false}
        // A broken still leaves the tinted frame, never a broken-image icon.
        onError={() => setStillFailed(true)}
        className={cn(
          'size-full select-none',
          fit === 'contain' ? 'object-contain' : 'object-cover',
          stillFailed && 'invisible',
          imageClassName,
        )}
      />
      {clip ? (
        <video
          // Changing <source> children does not reload a video; a new
          // element per picture does.
          key={media.src}
          ref={video}
          // The still carries the description; the clip only animates it.
          aria-hidden
          tabIndex={-1}
          muted
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          loop={playback === 'loop'}
          // Nothing downloads until the clip is asked to play.
          preload="none"
          width={media.width}
          height={media.height}
          onPlaying={() => {
            setStarted(true)
            callbacks.current.onPlayingChange?.(true)
          }}
          onPause={() => callbacks.current.onPlayingChange?.(false)}
          onWaiting={() => callbacks.current.onPlayingChange?.(false)}
          onEnded={() => {
            callbacks.current.onPlayingChange?.(false)
            callbacks.current.onEnded?.()
          }}
          onLoadedMetadata={(event) => {
            const seconds = event.currentTarget.duration
            if (Number.isFinite(seconds) && seconds > 0)
              callbacks.current.onDuration?.(seconds)
          }}
          onError={() => {
            setFailed(true)
            callbacks.current.onFallback?.()
          }}
          className={cn(
            'pointer-events-none absolute inset-0 size-full transition-opacity',
            fit === 'contain' ? 'object-contain' : 'object-cover',
            'duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
            started ? 'opacity-100' : 'opacity-0',
          )}
        >
          {clip.sources.map((source) => (
            <source key={source.src} src={source.src} type={source.type} />
          ))}
        </video>
      ) : null}
      {clip && controls ? (
        <ClipControl
          playing={wantsPlay}
          label={wantsPlay ? labels.pause : labels.play}
          onToggle={() => {
            setRefused(false)
            setChoice(wantsPlay ? 'pause' : 'play')
          }}
        />
      ) : null}
    </div>
  )
}

/** Pause and play, in the corner where video controls live. */
function ClipControl({
  playing,
  label,
  onToggle,
}: {
  playing: boolean
  label: string
  onToggle: () => void
}) {
  const reduce = useReducedMotion()
  const hidden = reduce
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.25, filter: 'blur(4px)' }
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        // Inside a card or a story tap zone, the press is only for the clip.
        event.stopPropagation()
        onToggle()
      }}
      className="absolute end-2 bottom-2 z-10 grid size-8 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-md transition-[background-color,transform] duration-150 ease-out outline-none before:absolute before:-inset-1 before:content-[''] hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white active:scale-[0.96] forced-colors:border"
    >
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={playing ? 'pause' : 'play'}
          initial={hidden}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          exit={hidden}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          className="grid place-items-center"
        >
          {playing ? (
            <IconPlayerPauseFilled aria-hidden className="size-3.5" />
          ) : (
            // Optically centred: a play triangle's mass sits left of its box.
            <IconPlayerPlayFilled
              aria-hidden
              className="size-3.5 translate-x-px"
            />
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  )
}
