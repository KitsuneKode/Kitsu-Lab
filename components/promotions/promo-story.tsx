'use client'

import * as React from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { IconX } from '@tabler/icons-react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import type { Promotion, PromotionMedia } from './promotion'
import type { PromotionLabels, PromotionLinkProps } from './promotion-provider'
import { PromoCode } from './promotion-views'

const SLIDE_MS = 6000

/**
 * A full-screen "what's new" story: slides with captions, segmented progress
 * at the top, tap the left third to go back and the rest to go on.
 *
 * It only ever opens because the visitor asked (the provider refuses to
 * auto-open a story), which is what earns it the whole screen. Slides move
 * on by themselves only while nobody is pressing, the tab is visible and
 * reduced motion is off; otherwise it is fully manual.
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
}: {
  promotion: Promotion
  open: boolean
  onClose: () => void
  onComplete: () => void
  onCopy: () => void
  labels: PromotionLabels
  Link: React.ComponentType<PromotionLinkProps>
  container?: HTMLElement | null
}) {
  const reduce = useReducedMotion()
  const slides: PromotionMedia[] = promotion.gallery?.length
    ? promotion.gallery
    : promotion.media
      ? [promotion.media]
      : []
  const [index, setIndex] = React.useState(0)
  const [held, setHeld] = React.useState(false)
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
          {slide ? (
            // oxlint-disable-next-line nextjs/no-img-element
            <img
              key={slide.src + index}
              src={slide.src}
              alt={slide.alt}
              width={slide.width}
              height={slide.height}
              decoding="async"
              className="animate-in fade-in-0 absolute inset-0 size-full object-cover duration-300 motion-reduce:animate-none"
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
                  onAnimationEnd={i === index ? () => go(1) : undefined}
                  className={cn(
                    'block h-full origin-left rounded-full bg-white rtl:origin-right',
                    i < index && 'scale-x-100',
                    i > index && 'scale-x-0',
                    i === index && !running && 'scale-x-100',
                  )}
                  style={
                    i === index && running
                      ? {
                          animation: `promo-story-fill ${SLIDE_MS}ms linear forwards`,
                          animationPlayState:
                            held || hidden ? 'paused' : 'running',
                        }
                      : undefined
                  }
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
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ms-auto text-white hover:bg-white/15 hover:text-white"
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
