'use client'

import * as React from 'react'
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react'
import { useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import type { PromotionMedia } from './promotion'

/**
 * A native scroll-snap carousel: the browser does the swiping, momentum and
 * snapping, so it feels right on every device and costs no JavaScript per
 * frame. We only add what scroll-snap lacks: previous and next buttons (for
 * pointers, gated behind hover), dots, arrow keys, and which slide is showing.
 *
 * It never advances on its own: moving content steals attention and is hard
 * to read, so the visitor stays in control.
 */
export function PromoGallery({
  images,
  className,
  aspect = '16 / 9',
  label = 'Images',
  eager = false,
  onSlide,
}: {
  images: readonly PromotionMedia[]
  className?: string
  /** CSS aspect-ratio for every slide, so nothing shifts while loading. */
  aspect?: string
  /** Accessible name for the carousel region. */
  label?: string
  /** Load the first image eagerly (dialogs, sheets). */
  eager?: boolean
  onSlide?: (index: number) => void
}) {
  const reduce = useReducedMotion()
  const scroller = React.useRef<HTMLDivElement>(null)
  const slides = React.useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = React.useState(0)
  const onSlideRef = React.useRef(onSlide)
  React.useLayoutEffect(() => {
    onSlideRef.current = onSlide
  })

  React.useEffect(() => {
    const root = scroller.current
    if (!root || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const index = slides.current.indexOf(entry.target as HTMLDivElement)
          if (index >= 0) {
            setActive(index)
            onSlideRef.current?.(index)
          }
        }
      },
      { root, threshold: 0.6 },
    )
    for (const slide of slides.current) if (slide) observer.observe(slide)
    return () => observer.disconnect()
  }, [images])

  const go = (index: number) => {
    const target = slides.current[(index + images.length) % images.length]
    target?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'start',
    })
  }

  if (images.length === 0) return null
  if (images.length === 1) {
    const image = images[0]!
    return (
      // oxlint-disable-next-line nextjs/no-img-element
      <img
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        style={{ aspectRatio: aspect }}
        className={cn('w-full bg-current/5 object-cover', className)}
      />
    )
  }

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      className={cn(
        'group/gallery relative isolate overflow-hidden',
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
          event.preventDefault()
          const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
          const forward = (event.key === 'ArrowRight') !== rtl
          go(active + (forward ? 1 : -1))
        }
      }}
    >
      <div
        ref={scroller}
        tabIndex={0}
        className="focus-visible:ring-ring/50 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain outline-none [scrollbar-width:none] focus-visible:ring-3 focus-visible:ring-inset [&::-webkit-scrollbar]:hidden"
      >
        {images.map((image, index) => (
          <div
            key={`${image.src}-${index}`}
            ref={(node) => {
              slides.current[index] = node
            }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} / ${images.length}`}
            className="w-full shrink-0 snap-start snap-always"
          >
            {/* oxlint-disable-next-line nextjs/no-img-element */}
            <img
              src={image.src}
              alt={image.alt}
              width={image.width}
              height={image.height}
              loading={eager && index === 0 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
              style={{ aspectRatio: aspect }}
              className="w-full bg-current/5 object-cover select-none"
            />
          </div>
        ))}
      </div>

      <span
        aria-hidden
        className="absolute start-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[0.6875rem] font-medium text-white tabular-nums backdrop-blur-sm"
      >
        {active + 1}/{images.length}
      </span>

      {(['prev', 'next'] as const).map((which) => (
        <button
          key={which}
          type="button"
          aria-label={which === 'prev' ? 'Previous image' : 'Next image'}
          onClick={() => go(active + (which === 'prev' ? -1 : 1))}
          className={cn(
            'absolute top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-white/85 text-black opacity-0 shadow-md ring-1 ring-black/5 backdrop-blur-sm transition-[opacity,transform] duration-150 ease-out outline-none focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-ring/60 active:scale-[0.96] [@media(hover:hover)]:group-hover/gallery:opacity-100',
            which === 'prev' ? 'start-2' : 'end-2',
          )}
        >
          {which === 'prev' ? (
            <IconChevronLeft aria-hidden className="size-4 rtl:-scale-x-100" />
          ) : (
            <IconChevronRight aria-hidden className="size-4 rtl:-scale-x-100" />
          )}
        </button>
      ))}

      <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {images.map((image, index) => (
          <button
            key={`dot-${image.src}-${index}`}
            type="button"
            aria-label={`Image ${index + 1} of ${images.length}`}
            aria-current={index === active ? 'true' : undefined}
            onClick={() => go(index)}
            className="grid size-4 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <span
              className={cn(
                'block h-1.5 rounded-full bg-white shadow-sm transition-[width,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                index === active ? 'w-3.5 opacity-100' : 'w-1.5 opacity-60',
              )}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
