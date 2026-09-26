'use client'

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react'
import {
  IconBook2,
  IconColumns2,
  IconLayoutGrid,
  IconSearch,
  IconZoomIn,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { BookPreviewPageView } from '../book-preview-page'
import { playPageTurnSound } from '../audio'
import { DEFAULT_CAPABILITIES } from '../capabilities'
import { usePageArrival } from '../hooks/use-page-arrival'
import { usePageGesture } from '../hooks/use-page-gesture'
import { useStableHandler } from '../hooks/use-stable-handler'
import { useBookPreview } from '../book-preview-provider'
import { pageSearchText } from '../normalize'
import { useFinePointer } from '../media'
import type { BookPreviewEngineProps, BookPreviewPage } from '../types'

type ViewMode = 'spread' | 'page' | 'thumbs'

const LOUPE_SIZE = 160
const LOUPE_ZOOM = 2

// The lens follows the pointer through direct transform writes — a moving
// magnifier must not re-render the page tree every frame.
function useSpreadLoupe(
  available: boolean,
  stageRef: RefObject<HTMLDivElement | null>,
) {
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)
  const stageRectRef = useRef<DOMRect | null>(null)
  const lensRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  if (!available && (enabled || visible)) {
    setEnabled(false)
    setVisible(false)
  }

  const move = (clientX: number, clientY: number) => {
    const rect = stageRectRef.current
    const lens = lensRef.current
    const content = contentRef.current
    if (!rect || !lens || !content) return
    const x = clientX - rect.left
    const y = clientY - rect.top
    lens.style.transform = `translate3d(${x - LOUPE_SIZE / 2}px, ${y - LOUPE_SIZE / 2}px, 0)`
    content.style.transform = `translate(${-x * LOUPE_ZOOM + LOUPE_SIZE / 2}px, ${-y * LOUPE_ZOOM + LOUPE_SIZE / 2}px) scale(${LOUPE_ZOOM})`
  }

  const onPointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || !stageRef.current) return
    stageRectRef.current = stageRef.current.getBoundingClientRect()
    const content = contentRef.current
    if (content) {
      content.style.width = `${stageRectRef.current.width}px`
      content.style.height = `${stageRectRef.current.height}px`
    }
    move(event.clientX, event.clientY)
    setVisible(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled) return
    move(event.clientX, event.clientY)
  }

  const onPointerLeave = () => setVisible(false)

  const toggle = () => {
    setEnabled((value) => !value)
    setVisible(false)
  }

  return {
    enabled,
    visible,
    lensRef,
    contentRef,
    toggle,
    onPointerEnter,
    onPointerMove,
    onPointerLeave,
  }
}

function SpreadControls({
  viewMode,
  loupeAvailable,
  loupeEnabled,
  query,
  onViewModeChange,
  onToggleLoupe,
  onQueryChange,
}: {
  viewMode: ViewMode
  loupeAvailable: boolean
  loupeEnabled: boolean
  query: string
  onViewModeChange: (mode: ViewMode) => void
  onToggleLoupe: () => void
  onQueryChange: (query: string) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          value={[viewMode]}
          onValueChange={(value) => {
            if (value[0]) onViewModeChange(value[0] as ViewMode)
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Spread layout"
        >
          <ToggleGroupItem value="spread" aria-label="Two-page spread">
            <IconColumns2 />
            Spread
          </ToggleGroupItem>
          <ToggleGroupItem value="page" aria-label="Single page">
            <IconBook2 />
            Page
          </ToggleGroupItem>
          <ToggleGroupItem value="thumbs" aria-label="Thumbnails">
            <IconLayoutGrid />
            Thumbnails
          </ToggleGroupItem>
        </ToggleGroup>
        {loupeAvailable ? (
          <Button
            type="button"
            variant={loupeEnabled ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={loupeEnabled}
            aria-label="Toggle magnifying loupe"
            onClick={onToggleLoupe}
            data-book-preview-press
          >
            <IconZoomIn data-icon="inline-start" />
            Loupe
          </Button>
        ) : null}
      </div>
      <div className="relative min-w-[12rem] flex-1">
        <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search pages"
          className="pl-8"
          aria-label="Search pages"
        />
      </div>
    </div>
  )
}

function ThumbsGrid({
  items,
  pages,
  appearance,
  onOpen,
}: {
  items: BookPreviewPage[]
  pages: BookPreviewPage[]
  appearance: BookPreviewEngineProps['appearance']
  onOpen: (index: number) => void
}) {
  return (
    <div className="grid max-h-[32rem] grid-cols-2 gap-3 overflow-auto sm:grid-cols-3 md:grid-cols-4">
      {items.map((page, index) => (
        <button
          key={page.id}
          type="button"
          data-book-preview-thumb
          // Stagger is decorative, so it is capped: past ~12 thumbnails the
          // delay would outlast the grid being useful, and it must never
          // gate interaction.
          style={
            {
              '--book-preview-thumb-delay': `${Math.min(index, 12) * 40}ms`,
            } as CSSProperties
          }
          className="hover:border-foreground/40 overflow-hidden rounded-md border text-left transition-colors duration-150 ease-out"
          onClick={() => onOpen(pages.findIndex((item) => item.id === page.id))}
          data-book-preview-press
        >
          <div className="h-40">
            <BookPreviewPageView page={page} appearance={appearance} />
          </div>
        </button>
      ))}
    </div>
  )
}

function SpreadPages({
  viewMode,
  pageIndex,
  pages,
  left,
  right,
  appearance,
}: {
  viewMode: ViewMode
  pageIndex: number
  pages: BookPreviewPage[]
  left: BookPreviewPage | undefined
  right: BookPreviewPage | undefined
  appearance: BookPreviewEngineProps['appearance']
}) {
  if (viewMode === 'page') {
    return (
      <div className="h-[min(22rem,66svh)] w-[min(14rem,86cqw)] sm:h-[min(32rem,72svh)] sm:w-[22rem] lg:h-[min(40rem,76svh)] lg:w-[26rem]">
        {pages[pageIndex] ? (
          <BookPreviewPageView
            page={pages[pageIndex]}
            appearance={appearance}
          />
        ) : null}
      </div>
    )
  }
  return (
    <>
      <div className="hidden h-[22rem] w-[14rem] border-r sm:block sm:h-[min(32rem,72svh)] sm:w-[20rem] lg:h-[min(40rem,76svh)] lg:w-[25rem]">
        {left ? (
          <BookPreviewPageView page={left} appearance={appearance} isLeftPage />
        ) : null}
      </div>
      <div className="h-[min(22rem,66svh)] w-[min(14rem,86cqw)] sm:h-[min(32rem,72svh)] sm:w-[20rem] lg:h-[min(40rem,76svh)] lg:w-[25rem]">
        {right ? (
          <BookPreviewPageView page={right} appearance={appearance} />
        ) : left ? (
          <BookPreviewPageView page={left} appearance={appearance} />
        ) : null}
      </div>
    </>
  )
}

function LoupeOverlay({
  visible,
  lensRef,
  contentRef,
  left,
  right,
  appearance,
}: {
  visible: boolean
  lensRef: RefObject<HTMLDivElement | null>
  contentRef: RefObject<HTMLDivElement | null>
  left: BookPreviewPage | undefined
  right: BookPreviewPage | undefined
  appearance: BookPreviewEngineProps['appearance']
}) {
  return (
    <div
      ref={lensRef}
      className={cn(
        'pointer-events-none absolute top-0 left-0 overflow-hidden rounded-full border-2 border-foreground shadow-xl transition-opacity duration-150 ease-out',
        visible ? 'opacity-100' : 'opacity-0',
      )}
      style={{ width: LOUPE_SIZE, height: LOUPE_SIZE }}
      aria-hidden
    >
      <div
        ref={contentRef}
        className="absolute top-0 left-0"
        style={{ transformOrigin: 'top left' }}
      >
        <div className="flex">
          {left ? (
            <div className="h-[32rem] w-[20rem] shrink-0">
              <BookPreviewPageView
                page={left}
                appearance={appearance}
                isLeftPage
              />
            </div>
          ) : null}
          {right ? (
            <div className="h-[32rem] w-[20rem] shrink-0">
              <BookPreviewPageView page={right} appearance={appearance} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function SpreadEngine({
  source,
  pageIndex,
  appearance,
  soundEnabled,
  reducedMotion,
  navigationBehavior,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('spread')
  const [query, setQuery] = useState('')
  const stageRef = useRef<HTMLDivElement | null>(null)
  const finePointer = useFinePointer()
  const pages = source.pages
  const evenIndex = pageIndex - (pageIndex % 2)
  const left = pages[evenIndex]
  const right = pages[evenIndex + 1]
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)

  // Direction of travel for the enter animation.
  // Keyed to the spread, not the page: stepping to the facing page changes
  // nothing on screen and must not replay the arrival drift.
  const arrival = usePageArrival(
    viewMode === 'page' ? pageIndex : evenIndex,
    reducedMotion || navigationBehavior === 'instant',
  )

  const matches = useMemo(() => {
    const value = query.trim().toLowerCase()
    if (!value) return []
    return pages.filter((page) =>
      pageSearchText(page).toLowerCase().includes(value),
    )
  }, [pages, query])

  const loupeAvailable = Boolean(finePointer) && viewMode !== 'thumbs'
  const loupe = useSpreadLoupe(loupeAvailable, stageRef)

  useEffect(() => {
    if (pages.length === 0) {
      reportError({
        kind: 'empty',
        message: 'The spread reader needs page data.',
      })
      return
    }
    reportReady({
      totalPages: pages.length,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        spreads: true,
        search: true,
        loupe: finePointer,
        thumbnails: true,
        download: Boolean(source.downloadUrl),
      },
    })
  }, [finePointer, pages.length, reportError, reportReady, source.downloadUrl])

  // Two pages on screen turn two at a time — a one-page step would land on
  // the facing page, already visible, and every other swipe would look dead.
  const stride = viewMode === 'spread' ? 2 : 1
  const from = viewMode === 'spread' ? evenIndex : pageIndex
  const prevTarget = from - stride >= 0 ? from - stride : null
  const nextTarget = from + stride < pages.length ? from + stride : null
  const { setPageStep } = useBookPreview()
  useEffect(() => {
    if (viewMode !== 'spread') return
    const count = pages.length
    setPageStep((at, direction) => {
      const target = at - (at % 2) + direction * 2
      return target >= 0 && target < count ? target : null
    })
    return () => setPageStep(null)
  }, [pages.length, setPageStep, viewMode])

  const { surfaceRef } = usePageGesture({
    enabled: viewMode !== 'thumbs',
    reducedMotion,
    canGoPrev: prevTarget !== null,
    canGoNext: nextTarget !== null,
    onCommitPrev: () => {
      if (prevTarget === null) return
      if (soundEnabled) playPageTurnSound()
      onPageChange(prevTarget)
    },
    onCommitNext: () => {
      if (nextTarget === null) return
      if (soundEnabled) playPageTurnSound()
      onPageChange(nextTarget)
    },
  })

  // Keyed by view, not by page: a per-page key remounted the stage on every
  // turn, re-decoding its images — a blank frame, a flash.
  const stageKey = viewMode

  return (
    <div
      data-book-preview-engine-frame
      className="flex h-full w-full flex-col gap-3 p-4"
    >
      <SpreadControls
        viewMode={viewMode}
        loupeAvailable={loupeAvailable}
        loupeEnabled={loupe.enabled}
        query={query}
        onViewModeChange={setViewMode}
        onToggleLoupe={loupe.toggle}
        onQueryChange={setQuery}
      />
      {query ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {matches.length} matching pages
        </p>
      ) : null}
      {viewMode === 'thumbs' ? (
        <ThumbsGrid
          items={query ? matches : pages}
          pages={pages}
          appearance={appearance}
          onOpen={(index) => {
            onPageChange(index)
            setViewMode('spread')
          }}
        />
      ) : (
        <div
          ref={(node) => {
            stageRef.current = node
            surfaceRef.current = node
          }}
          className="relative flex min-h-[min(22rem,66svh)] touch-pan-y items-center justify-center select-none sm:min-h-[min(28rem,72svh)] lg:min-h-[min(36rem,78svh)]"
          style={{ touchAction: 'pan-y' }}
          onPointerEnter={loupe.onPointerEnter}
          onPointerMove={loupe.onPointerMove}
          onPointerLeave={loupe.onPointerLeave}
        >
          <div
            key={stageKey}
            {...arrival}
            className="flex overflow-hidden rounded-md border shadow-lg"
          >
            <SpreadPages
              viewMode={viewMode}
              pageIndex={pageIndex}
              pages={pages}
              left={left}
              right={right}
              appearance={appearance}
            />
          </div>
          {loupe.enabled ? (
            <LoupeOverlay
              visible={loupe.visible}
              lensRef={loupe.lensRef}
              contentRef={loupe.contentRef}
              left={left}
              right={right}
              appearance={appearance}
            />
          ) : null}
        </div>
      )}
    </div>
  )
}
