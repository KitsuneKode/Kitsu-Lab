'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { IconArrowUpRight, IconPlus } from '@tabler/icons-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useBookPreviewSelector } from './book-preview-provider'
import { usePageSurfaces } from './hooks/use-page-surfaces'
import { useStableHandler } from './hooks/use-stable-handler'
import {
  hotspotSide,
  hotspotsByPage,
  type BookPreviewHotspot,
  type BookPreviewHotspotEvent,
} from './hotspots'

type Emit = (event: BookPreviewHotspotEvent) => void

/**
 * Shoppable hotspots over page faces. Portals a marker for each hotspot into
 * the page it belongs to (the same faces ink draws on), so markers ride
 * along with zoom, turns and the scroll view. Each marker is a real button:
 * Tab reaches it, Enter opens its product card, Escape closes it and puts
 * focus back. Markers step aside while the reader is drawing.
 */
export function BookPreviewHotspotLayer({
  hotspots,
  onHotspotEvent,
}: {
  hotspots: readonly BookPreviewHotspot[] | undefined
  onHotspotEvent?: Emit
}) {
  const { rootRef, drawing, totalPages } = useBookPreviewSelector((v) => ({
    rootRef: v.rootRef,
    drawing: v.draw.active,
    totalPages: v.state.totalPages,
  }))
  const pages = useMemo(
    () => hotspotsByPage(hotspots, totalPages),
    [hotspots, totalPages],
  )
  const surfaces = usePageSurfaces(rootRef, pages.size > 0)
  const emit = useStableHandler<[BookPreviewHotspotEvent], void>((event) =>
    onHotspotEvent?.(event),
  )

  return surfaces.map((surface) => {
    const list = pages.get(surface.pageIndex)
    if (!list) return null
    return createPortal(
      <div
        key={surface.pageIndex}
        data-bp-hotspots
        hidden={drawing}
        className="pointer-events-none absolute inset-0 z-[3]"
      >
        {list.map((hotspot) => (
          <HotspotMarker key={hotspot.id} hotspot={hotspot} emit={emit} />
        ))}
      </div>,
      surface.el,
      `hotspots-${surface.pageIndex}`,
    )
  })
}

function HotspotMarker({
  hotspot,
  emit,
}: {
  hotspot: BookPreviewHotspot
  emit: Emit
}) {
  const markerRef = useRef<HTMLButtonElement>(null)
  const { id, pageIndex } = hotspot

  // An impression is the marker on screen, at least half of it, once for
  // each time its page is shown.
  useEffect(() => {
    const marker = markerRef.current
    if (!marker || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        emit({ type: 'impression', hotspotId: id, pageIndex })
      },
      { threshold: 0.5 },
    )
    observer.observe(marker)
    return () => observer.disconnect()
  }, [emit, id, pageIndex])

  const name = hotspot.label ?? hotspot.title
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) emit({ type: 'open', hotspotId: id, pageIndex })
      }}
    >
      <PopoverTrigger
        ref={markerRef}
        data-bp-hotspot={id}
        aria-label={hotspot.price ? `${name}, ${hotspot.price}` : name}
        // Page coordinates are physical: a product photographed on the left
        // stays on the left in a right-to-left interface.
        style={{ left: `${hotspot.x * 100}%`, top: `${hotspot.y * 100}%` }}
        className="group/hotspot pointer-events-auto absolute size-7 -translate-x-1/2 -translate-y-1/2 rounded-full outline-none before:absolute before:-inset-2 before:content-['']"
      >
        <span
          aria-hidden
          className="bp-hotspot-halo absolute inset-0 rounded-full bg-white"
        />
        <span
          aria-hidden
          className="relative grid size-7 place-items-center rounded-full bg-neutral-950/85 text-white shadow-[0_1px_2px_rgb(0_0_0/0.3),0_6px_16px_-4px_rgb(0_0_0/0.35)] ring-2 ring-white/90 backdrop-blur-sm transition-[scale,background-color] duration-150 ease-out group-hover/hotspot:scale-110 group-hover/hotspot:bg-neutral-950 group-focus-visible/hotspot:ring-[3px] group-focus-visible/hotspot:ring-white group-focus-visible/hotspot:outline-2 group-focus-visible/hotspot:outline-offset-2 group-focus-visible/hotspot:outline-neutral-950 group-active/hotspot:scale-[0.96] group-data-[popup-open]/hotspot:bg-neutral-950 forced-colors:border forced-colors:border-[ButtonText]"
        >
          <IconPlus
            className="size-3.5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-data-[popup-open]/hotspot:rotate-45 motion-reduce:transition-none"
            stroke={2.5}
          />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side={hotspotSide(hotspot)}
        sideOffset={10}
        className="w-64 gap-0 overflow-hidden rounded-xl p-0"
      >
        <HotspotCard hotspot={hotspot} emit={emit} />
      </PopoverContent>
    </Popover>
  )
}

function HotspotCard({
  hotspot,
  emit,
}: {
  hotspot: BookPreviewHotspot
  emit: Emit
}) {
  const { image, href } = hotspot
  // A broken product photo drops out; the card still reads without it.
  const [failed, setFailed] = useState<string | null>(null)
  const showImage = image && failed !== image.src

  return (
    <>
      {showImage ? (
        <img
          src={image.src}
          alt={image.alt}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(image.src)}
          className="bg-muted aspect-[4/3] w-full object-cover outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : null}
      <div className="flex flex-col gap-1.5 p-3">
        <div className="flex items-baseline gap-3">
          <PopoverTitle className="min-w-0 flex-1 leading-snug text-balance">
            {hotspot.title}
          </PopoverTitle>
          {hotspot.price ? (
            <span className="shrink-0 font-medium tabular-nums">
              {hotspot.price}
            </span>
          ) : null}
        </div>
        {hotspot.description ? (
          <PopoverDescription className="line-clamp-3 text-pretty">
            {hotspot.description}
          </PopoverDescription>
        ) : null}
        {href ? (
          <Button
            size="sm"
            nativeButton={false}
            className="mt-1.5 w-full"
            // The link's text is the Button's children, rendered into it.
            // oxlint-disable-next-line jsx-a11y/control-has-associated-label
            render={<a href={href} />}
            onClick={() =>
              emit({
                type: 'action',
                hotspotId: hotspot.id,
                pageIndex: hotspot.pageIndex,
                href,
              })
            }
          >
            {hotspot.action ?? 'View product'}
            <IconArrowUpRight data-icon="inline-end" aria-hidden />
          </Button>
        ) : null}
      </div>
    </>
  )
}
