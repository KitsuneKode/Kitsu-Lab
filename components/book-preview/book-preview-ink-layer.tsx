'use client'

import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { useBookPreviewSelector } from './book-preview-provider'
import { useStableHandler } from './hooks/use-stable-handler'
import {
  IconArrowBackUp,
  IconEraser,
  IconHighlight,
  IconPencil,
  IconX,
} from '@tabler/icons-react'
import {
  createAnnotationId,
  removeAnnotation,
  upsertAnnotation,
  type BookPreviewInk,
} from './annotations'
import {
  INK_COLORS,
  INK_SWATCHES,
  INK_WIDTHS,
  flattenInk,
  inkHit,
  inkPath,
  pushInkPoint,
  toPagePoint,
  unflattenInk,
  type InkPoint,
} from './ink'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react'

const INK_SURFACE_SELECTOR = '[data-bp-inkable]'
/** Eraser reach in page-width units — about a fingertip on a phone page. */
const ERASER_RADIUS = 0.018

type Surface = { el: HTMLElement; pageIndex: number }

function sameSurfaces(a: Surface[], b: Surface[]) {
  return (
    a.length === b.length &&
    a.every(
      (item, index) =>
        item.el === b[index].el && item.pageIndex === b[index].pageIndex,
    )
  )
}

/**
 * Freehand ink over page faces. Engines opt a page-sized element in with
 * `data-bp-inkable` + `data-page-index`; this layer portals an SVG into each
 * one. Strokes are stored page-relative (see ink.ts), so they follow the page
 * through zoom, view switches and devices.
 *
 * At rest the SVG ignores the pointer — text stays selectable and links
 * clickable. In draw mode it captures pointers natively (engine swipe and
 * pinch handlers never see them), draws the live stroke by writing the path
 * straight to the DOM, and commits one annotation on lift. Once a stylus
 * touches the page, finger contacts are ignored: palm rejection.
 */
export function BookPreviewInkLayer() {
  const {
    annotate,
    annotations,
    updateAnnotations,
    rootRef,
    draw,
    setDraw,
    setInkAvailable,
  } = useBookPreviewSelector((v) => ({
    annotate: v.annotate,
    annotations: v.annotations,
    updateAnnotations: v.updateAnnotations,
    rootRef: v.rootRef,
    draw: v.draw,
    setDraw: v.setDraw,
    setInkAvailable: v.setInkAvailable,
  }))
  const [surfaces, setSurfaces] = useState<Surface[]>([])
  const createdRef = useRef<string[]>([])
  // Mirrors createdRef's length for the undo button — refs are not read
  // during render.
  const [undoDepth, setUndoDepth] = useState(0)
  const sawPenRef = useRef(false)

  // Discover inkable faces as engines mount, swap, and window them.
  useEffect(() => {
    const root = rootRef.current
    if (!annotate || !root) return
    let frame = 0
    const scan = () => {
      frame = 0
      const next: Surface[] = []
      for (const el of root.querySelectorAll<HTMLElement>(
        INK_SURFACE_SELECTOR,
      )) {
        const pageIndex = Number.parseInt(el.dataset.pageIndex ?? '', 10)
        if (Number.isFinite(pageIndex) && pageIndex >= 0) {
          next.push({ el, pageIndex })
        }
      }
      setSurfaces((current) => (sameSurfaces(current, next) ? current : next))
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scan)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-page-index', 'data-bp-inkable'],
    })
    return () => {
      observer.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [annotate, rootRef])

  const hasSurfaces = surfaces.length > 0
  useEffect(() => {
    setInkAvailable(hasSurfaces)
  }, [hasSurfaces, setInkAvailable])

  // A view without inkable faces (the flip book, the text view) leaves draw
  // mode rather than stranding the reader in it.
  useEffect(() => {
    if (!hasSurfaces && draw.active) setDraw({ active: false })
  }, [draw.active, hasSurfaces, setDraw])

  const strokesByPage = useMemo(() => {
    const map = new Map<number, BookPreviewInk[]>()
    for (const item of annotations) {
      if (item.kind !== 'ink') continue
      const list = map.get(item.pageIndex) ?? []
      list.push(item)
      map.set(item.pageIndex, list)
    }
    return map
  }, [annotations])

  const commitStroke = useCallback(
    (stroke: BookPreviewInk) => {
      createdRef.current.push(stroke.id)
      setUndoDepth(createdRef.current.length)
      updateAnnotations((list) => upsertAnnotation(list, stroke))
    },
    [updateAnnotations],
  )

  const erase = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return
      updateAnnotations((list) => list.filter((item) => !ids.includes(item.id)))
    },
    [updateAnnotations],
  )

  const undo = useCallback(() => {
    const present = new Set(annotations.map((item) => item.id))
    while (createdRef.current.length > 0) {
      const id = createdRef.current.pop()
      if (id && present.has(id)) {
        updateAnnotations((list) => removeAnnotation(list, id))
        break
      }
    }
    setUndoDepth(createdRef.current.length)
  }, [annotations, updateAnnotations])

  // Mod+Z undoes the last stroke while drawing.
  useEffect(() => {
    const root = rootRef.current
    if (!draw.active || !root) return
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
    }
    root.addEventListener('keydown', onKey)
    return () => root.removeEventListener('keydown', onKey)
  }, [draw.active, rootRef, undo])

  if (!annotate) return null

  return (
    <>
      {surfaces.map((surface) =>
        createPortal(
          <InkSurface
            key={`${surface.pageIndex}`}
            host={surface.el}
            pageIndex={surface.pageIndex}
            strokes={strokesByPage.get(surface.pageIndex) ?? []}
            active={draw.active}
            tool={draw.tool}
            color={draw.color}
            sawPenRef={sawPenRef}
            onStroke={commitStroke}
            onErase={erase}
          />,
          surface.el,
          `ink-${surface.pageIndex}`,
        ),
      )}
      {draw.active ? (
        <InkToolbar canUndo={undoDepth > 0} onUndo={undo} />
      ) : null}
    </>
  )
}

function InkSurface({
  host,
  pageIndex,
  strokes,
  active,
  tool,
  color,
  sawPenRef,
  onStroke,
  onErase,
}: {
  host: HTMLElement
  pageIndex: number
  strokes: BookPreviewInk[]
  active: boolean
  tool: 'pen' | 'marker' | 'eraser'
  color: BookPreviewInk['color']
  sawPenRef: RefObject<boolean>
  onStroke: (stroke: BookPreviewInk) => void
  onErase: (ids: string[]) => void
}) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const liveRef = useRef<SVGPathElement | null>(null)
  // Stable identities: the listener effect must not tear down (and drop the
  // in-progress stroke) just because the notebook changed mid-gesture.
  const commitStroke = useStableHandler(onStroke)
  const eraseStrokes = useStableHandler(onErase)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const stateRef = useRef({ tool, color, strokes, pageIndex })
  useEffect(() => {
    stateRef.current = { tool, color, strokes, pageIndex }
  })

  useEffect(() => {
    const measure = () =>
      setSize((current) =>
        current.width === host.clientWidth &&
        current.height === host.clientHeight
          ? current
          : { width: host.clientWidth, height: host.clientHeight },
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [host])

  useEffect(() => {
    const svg = svgRef.current
    if (!active || !svg) return
    let drawing: {
      id: number
      points: InkPoint[]
      rect: DOMRect
      aspect: number
    } | null = null
    let erased = new Set<string>()

    const eraseAt = (point: InkPoint, aspect: number) => {
      const hits = stateRef.current.strokes
        .filter(
          (stroke) =>
            !erased.has(stroke.id) &&
            inkHit(stroke.points, stroke.width, point, ERASER_RADIUS, aspect),
        )
        .map((stroke) => stroke.id)
      if (hits.length === 0) return
      for (const id of hits) erased.add(id)
      eraseStrokes(hits)
    }

    const paintLive = () => {
      const live = liveRef.current
      if (!live || !drawing) return
      live.setAttribute(
        'd',
        inkPath(drawing.points, drawing.rect.width, drawing.rect.height),
      )
    }

    const onDown = (event: PointerEvent) => {
      // The page is ink now: no engine swipe, pinch, pan or text selection.
      event.stopPropagation()
      event.preventDefault()
      if (event.pointerType === 'pen') sawPenRef.current = true
      if (event.pointerType === 'touch' && sawPenRef.current) return
      if (drawing) return
      const rect = svg.getBoundingClientRect()
      const aspect = rect.width / Math.max(rect.height, 1)
      const point = toPagePoint(event.clientX, event.clientY, rect)
      svg.setPointerCapture(event.pointerId)
      drawing = { id: event.pointerId, points: [point], rect, aspect }
      erased = new Set()
      if (stateRef.current.tool === 'eraser') {
        eraseAt(point, aspect)
        return
      }
      paintLive()
    }

    const onMove = (event: PointerEvent) => {
      if (!drawing || event.pointerId !== drawing.id) return
      event.stopPropagation()
      // Coalesced events keep fast strokes smooth on 120Hz pens.
      const samples = event.getCoalescedEvents?.() ?? [event]
      for (const sample of samples.length > 0 ? samples : [event]) {
        const point = toPagePoint(sample.clientX, sample.clientY, drawing.rect)
        if (stateRef.current.tool === 'eraser') {
          eraseAt(point, drawing.aspect)
        } else {
          pushInkPoint(drawing.points, point, drawing.aspect)
        }
      }
      if (stateRef.current.tool !== 'eraser') paintLive()
    }

    const finish = (event: PointerEvent, commit: boolean) => {
      if (!drawing || event.pointerId !== drawing.id) return
      event.stopPropagation()
      const done = drawing
      drawing = null
      liveRef.current?.setAttribute('d', '')
      const { tool: current, color: ink, pageIndex: page } = stateRef.current
      if (!commit || current === 'eraser') return
      const now = Date.now()
      commitStroke({
        id: createAnnotationId(),
        kind: 'ink',
        pageIndex: page,
        tool: current,
        color: ink,
        width: INK_WIDTHS[current],
        points: flattenInk(done.points),
        createdAt: now,
        updatedAt: now,
      })
    }
    const onUp = (event: PointerEvent) => finish(event, true)
    const onCancel = (event: PointerEvent) => finish(event, false)
    const swallow = (event: Event) => event.stopPropagation()

    svg.addEventListener('pointerdown', onDown)
    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerup', onUp)
    svg.addEventListener('pointercancel', onCancel)
    svg.addEventListener('click', swallow)
    return () => {
      svg.removeEventListener('pointerdown', onDown)
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerup', onUp)
      svg.removeEventListener('pointercancel', onCancel)
      svg.removeEventListener('click', swallow)
    }
  }, [active, commitStroke, eraseStrokes, sawPenRef])

  const { width, height } = size
  const lightPaper = host.dataset.bpInkPaper === 'light'
  const liveWidth =
    tool === 'eraser' ? 0 : INK_WIDTHS[tool] * Math.max(width, 1)

  return (
    <svg
      ref={svgRef}
      aria-hidden
      data-bp-ink-surface
      data-active={active || undefined}
      data-tool={active ? tool : undefined}
      className={cn(
        'absolute inset-0 z-30 size-full overflow-visible',
        active ? 'pointer-events-auto touch-none' : 'pointer-events-none',
      )}
      style={lightPaper ? { color: 'rgb(24 24 27)' } : undefined}
      viewBox={`0 0 ${Math.max(width, 1)} ${Math.max(height, 1)}`}
    >
      {width > 0
        ? strokes.map((stroke) => (
            <path
              key={stroke.id}
              d={inkPath(unflattenInk(stroke.points), width, height)}
              fill="none"
              stroke={INK_SWATCHES[stroke.color].stroke}
              strokeWidth={stroke.width * width}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={stroke.tool === 'marker' ? 0.38 : 1}
              style={
                stroke.tool === 'marker'
                  ? { mixBlendMode: 'multiply' }
                  : undefined
              }
            />
          ))
        : null}
      <path
        ref={liveRef}
        fill="none"
        stroke={INK_SWATCHES[color].stroke}
        strokeWidth={liveWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={tool === 'marker' ? 0.38 : 1}
      />
    </svg>
  )
}

/** The floating pen case: tool, ink, undo, done. */
function InkToolbar({
  canUndo,
  onUndo,
}: {
  canUndo: boolean
  onUndo: () => void
}) {
  const { draw, setDraw } = useBookPreviewSelector((v) => ({
    draw: v.draw,
    setDraw: v.setDraw,
  }))
  return (
    <div
      role="toolbar"
      aria-label="Drawing tools"
      data-book-preview-ink-toolbar
      className="bg-popover text-popover-foreground ring-foreground/10 absolute bottom-24 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full p-1.5 shadow-lg ring-1"
    >
      <ToolButton
        label="Pen"
        pressed={draw.tool === 'pen'}
        onClick={() => setDraw({ tool: 'pen' })}
      >
        <IconPencil />
      </ToolButton>
      <ToolButton
        label="Marker"
        pressed={draw.tool === 'marker'}
        onClick={() => setDraw({ tool: 'marker' })}
      >
        <IconHighlight />
      </ToolButton>
      <ToolButton
        label="Eraser"
        pressed={draw.tool === 'eraser'}
        onClick={() => setDraw({ tool: 'eraser' })}
      >
        <IconEraser />
      </ToolButton>
      <span aria-hidden className="bg-border mx-1 h-5 w-px" />
      <div
        role="group"
        aria-label="Ink colour"
        className="flex items-center gap-1"
      >
        {INK_COLORS.map((ink) => (
          <button
            key={ink}
            type="button"
            aria-label={`${INK_SWATCHES[ink].label} ink`}
            aria-pressed={draw.color === ink}
            onClick={() =>
              setDraw({
                color: ink,
                tool: draw.tool === 'eraser' ? 'pen' : draw.tool,
              })
            }
            data-book-preview-press
            className={cn(
              'focus-visible:ring-ring/60 text-foreground size-7 rounded-full border border-black/10 outline-none focus-visible:ring-2 sm:size-6',
              draw.color === ink && 'ring-foreground ring-2 ring-offset-1',
            )}
            style={{ background: INK_SWATCHES[ink].stroke }}
          />
        ))}
      </div>
      <span aria-hidden className="bg-border mx-1 h-5 w-px" />
      <ToolButton label="Undo (mod+Z)" disabled={!canUndo} onClick={onUndo}>
        <IconArrowBackUp />
      </ToolButton>
      <ToolButton
        label="Done drawing (Esc)"
        onClick={() => setDraw({ active: false })}
      >
        <IconX />
      </ToolButton>
    </div>
  )
}

function ToolButton({
  label,
  pressed,
  disabled,
  onClick,
  children,
}: {
  label: string
  pressed?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant={pressed ? 'secondary' : 'ghost'}
      size="icon-sm"
      aria-label={label}
      aria-pressed={pressed}
      title={label}
      disabled={disabled}
      onClick={onClick}
      data-book-preview-press
      className="min-h-9 min-w-9 rounded-full sm:min-h-8 sm:min-w-8"
    >
      {children}
    </Button>
  )
}
