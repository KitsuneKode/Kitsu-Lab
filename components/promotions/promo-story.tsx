'use client'

import * as React from 'react'
import { Dialog } from '@base-ui/react/dialog'
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconX,
} from '@tabler/icons-react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import type { Promotion, PromotionMedia } from './promotion'
import type { PromotionLabels, PromotionLinkProps } from './promotion-provider'
import { PromoCode } from './promotion-views'
import { PromoMedia } from './promo-media'

const SLIDE_MS = 6000

export type PromoStoryProps = {
  promotion: Promotion
  open: boolean
  onClose: () => void
  onComplete: () => void
  onCopy: () => void
  labels: PromotionLabels
  Link: React.ComponentType<PromotionLinkProps>
  container?: HTMLElement | null
}

/**
 * A full-screen "what's new" story: slides with captions, segmented progress
 * at the top, tap the left third to go back and the rest to go on.
 *
 * It only ever opens because the visitor asked (the provider refuses to
 * auto-open a story), which is what earns it the whole screen. Slides move
 * on by themselves only while nobody is pressing, the tab is visible and
 * reduced motion is off; otherwise it is fully manual.
 *
 * A slide with a clip lasts as long as the clip: its segment fills only
 * while frames are playing (so buffering holds it), and the clip's end moves
 * the story on. Pause stops both, from the keyboard as well as by holding.
 */
export function PromoStory({
  promotion,
  open,
  onClose,
  onComplete,
  onCopy,
  labels,
  Link,
  container,
}: PromoStoryProps) {
  const reduce = useReducedMotion()
  const slides: PromotionMedia[] = promotion.gallery?.length
    ? promotion.gallery
    : promotion.media
      ? [promotion.media]
      : []
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const [stills, setStills] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  )
  // The dialog keeps the story mounted after it closes, and a story is meant
  // to be watched again: every opening starts from the first slide.
  const [wasOpen, setWasOpen] = React.useState(open)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setIndex(0)
      setPaused(false)
    }
  }
  const [held, setHeld] = React.useState(false)
  // The showing clip's length and whether it is playing, for its segment.
  const [clip, setClip] = React.useState<{
    index: number
    seconds: number | null
    playing: boolean
  }>({ index: -1, seconds: null, playing: false })
  const [hidden, setHidden] = React.useState(false)
  const last = index >= slides.length - 1
  // The current segment's own CSS animation is the clock: pausing it pauses
  // the story, and its end moves to the next slide, so they never drift.
  const running = open && !reduce && slides.length > 1 && !last

  React.useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  const go = (step: 1 | -1) =>
    setIndex((i) => Math.min(slides.length - 1, Math.max(0, i + step)))
  const slide = slides[index]
  const slideKey = slide ? slide.src + index : ''
  // A clip that will not play is timed like a still, so the story never stalls.
  const isClip = Boolean(slide?.video) && !stills.has(slideKey)
  const clipNow = clip.index === index ? clip : null
  const stopped = held || hidden || paused
  // Anything moving on its own offers a pause: the timer or the clip.
  const moving = running || (isClip && !reduce)
  const segmentStyle = (): React.CSSProperties | undefined => {
    if (!running) return undefined
    if (!isClip)
      return {
        animation: `promo-story-fill ${SLIDE_MS}ms linear forwards`,
        animationPlayState: stopped ? 'paused' : 'running',
      }
    // Until the clip reports its length the segment waits at the start.
    const ms = (clipNow?.seconds ?? SLIDE_MS / 1000) * 1000
    return {
      animation: `promo-story-fill ${ms}ms linear forwards`,
      animationPlayState: clipNow?.playing && !stopped ? 'running' : 'paused',
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/85 transition-opacity duration-300 ease-out data-ending-style:opacity-0 data-ending-style:duration-200 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-md" />
        <Dialog.Popup
          data-slot="promo-story"
          onKeyDown={(event) => {
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              const rtl =
                getComputedStyle(event.currentTarget).direction === 'rtl'
              go((event.key === 'ArrowRight') !== rtl ? 1 : -1)
            }
          }}
          className="fixed inset-0 z-50 m-auto flex h-full w-full flex-col overflow-hidden bg-black text-white transition-[opacity,scale] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] outline-none data-ending-style:scale-[0.98] data-ending-style:opacity-0 data-ending-style:duration-200 data-starting-style:scale-[0.96] data-starting-style:opacity-0 motion-reduce:transition-opacity sm:[aspect-ratio:9/16] sm:h-[min(52rem,calc(100%-2rem))] sm:w-auto sm:rounded-[calc(var(--promo-radius,0.75rem)+0.5rem)]"
        >
          {slide && slide.width > slide.height ? (
            // Landscape media in a portrait story: letterbox it over a
            // blurred copy of itself, so nothing is cropped away and the
            // copy below always sits on a dark, quiet ground.
            // oxlint-disable-next-line nextjs/no-img-element
            <img
              key={`backdrop-${slide.src}`}
              src={slide.src}
              alt=""
              aria-hidden
              decoding="async"
              className="absolute inset-0 size-full scale-125 object-cover opacity-50 blur-2xl"
            />
          ) : null}
          {slide ? (
            <PromoMedia
              key={slide.src + index}
              fit={slide.width > slide.height ? 'contain' : 'cover'}
              media={slide}
              eager
              controls={false}
              active={open && !held && !paused}
              playback={running ? 'once' : 'loop'}
              onDuration={(seconds) =>
                setClip((c) => ({ ...c, index, seconds }))
              }
              onPlayingChange={(playing) =>
                setClip((c) =>
                  c.index === index
                    ? { ...c, playing }
                    : { index, seconds: null, playing },
                )
              }
              onEnded={running ? () => go(1) : undefined}
              onFallback={() =>
                setStills((previous) => new Set(previous).add(slideKey))
              }
              className="animate-in fade-in-0 absolute inset-0 size-full bg-transparent duration-300 motion-reduce:animate-none"
            />
          ) : null}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgb(0_0_0/0.55),transparent_22%,transparent_50%,rgb(0_0_0/0.8))]"
          />

          {/* Segmented progress: done, current (filling), to come. */}
          <div className="relative flex gap-1 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            {slides.map((s, i) => (
              <span
                key={s.src + i}
                className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30"
              >
                <span
                  key={i === index ? `run-${index}` : undefined}
                  // A clip's own end moves the story on; the bar only shows it.
                  onAnimationEnd={
                    i === index && !isClip ? () => go(1) : undefined
                  }
                  className={cn(
                    'block h-full origin-left rounded-full bg-white rtl:origin-right',
                    i < index && 'scale-x-100',
                    i > index && 'scale-x-0',
                    i === index && !running && 'scale-x-100',
                  )}
                  style={i === index ? segmentStyle() : undefined}
                />
              </span>
            ))}
          </div>
          <style>{`@keyframes promo-story-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>

          <div className="relative flex items-center gap-2 px-4 pt-3">
            {promotion.eyebrow ? (
              <span className="text-xs font-medium text-white/85">
                {promotion.eyebrow}
              </span>
            ) : null}
            {moving ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={paused ? labels.play : labels.pause}
                onClick={() => setPaused((p) => !p)}
                className="ms-auto text-white hover:bg-white/15 hover:text-white"
              >
                {paused ? (
                  <IconPlayerPlayFilled
                    aria-hidden
                    className="translate-x-px"
                  />
                ) : (
                  <IconPlayerPauseFilled aria-hidden />
                )}
              </Button>
            ) : null}
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className={cn(
                    'text-white hover:bg-white/15 hover:text-white',
                    !moving && 'ms-auto',
                  )}
                />
              }
            >
              <IconX aria-hidden />
              <span className="sr-only">{labels.dismiss}</span>
            </Dialog.Close>
          </div>

          {/* Tap zones: back on the first third, on everywhere else. Holding pauses. */}
          <div
            className="relative flex-1"
            onPointerDown={() => setHeld(true)}
            onPointerUp={() => setHeld(false)}
            onPointerLeave={() => setHeld(false)}
          >
            <button
              type="button"
              aria-label={labels.previous}
              disabled={index === 0}
              onClick={() => go(-1)}
              className="absolute inset-y-0 start-0 w-1/3 outline-none focus-visible:bg-white/5"
            />
            <button
              type="button"
              aria-label={labels.next}
              disabled={last}
              onClick={() => go(1)}
              className="absolute inset-y-0 end-0 w-2/3 outline-none focus-visible:bg-white/5"
            />
          </div>

          <div className="relative flex flex-col gap-2 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            {slide?.caption ? (
              <p
                key={index}
                aria-live="polite"
                className="animate-in fade-in-0 slide-in-from-bottom-1 text-sm text-white/85 duration-300 motion-reduce:animate-none"
              >
                {slide.caption}
              </p>
            ) : null}
            <Dialog.Title className="[font-family:var(--promo-display,inherit)] text-2xl leading-tight font-medium text-balance">
              {promotion.title}
            </Dialog.Title>
            {promotion.body ? (
              <Dialog.Description className="text-sm text-pretty text-white/80">
                {promotion.body}
              </Dialog.Description>
            ) : null}
            {promotion.code ? (
              <PromoCode
                code={promotion.code}
                reveal={promotion.revealCode}
                onCopy={onCopy}
                className="mt-1 self-start text-white"
              />
            ) : null}
            {promotion.cta ? (
              <Button
                size="lg"
                nativeButton={false}
                className="mt-2 bg-white text-black hover:bg-white/90"
                render={
                  <Link
                    href={promotion.cta.href}
                    onClick={onComplete}
                    {...(promotion.cta.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {promotion.cta.label}
                  </Link>
                }
              />
            ) : null}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
