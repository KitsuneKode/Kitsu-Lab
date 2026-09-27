'use client'

import * as React from 'react'
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import type { Promotion, PromotionMedia } from './promotion'
import { PromoMedia } from './promo-media'
import {
  useImpression,
  usePromotionLabels,
  usePromotions,
} from './promotion-provider'

/** How long a chapter without a clip stays before the next. */
const STILL_MS = 6000

export type ShowcaseChapter = {
  id: string
  /** Short tab label, e.g. "Ink". */
  label: string
  title: string
  body?: string
  media: PromotionMedia
  /** Optional action under the active chapter. */
  action?: React.ReactNode
}

const REDUCE = '(prefers-reduced-motion: reduce)'
function subscribeReduce(onChange: () => void) {
  const query = window.matchMedia(REDUCE)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}

/**
 * A feature showcase: one large frame and a row of chapters, each chapter a
 * clip that explains one thing. The active chapter's bar fills while its
 * clip plays, and the clip's end moves to the next chapter, so the pace is
 * the footage's own. Chapters without a clip hold for six seconds.
 *
 * It only moves while nobody is reading it: hovering or focusing inside
 * holds it, a hidden tab pauses it, and reduced motion never advances it
 * (each clip then has its own Play). A clip that fails or whose autoplay is
 * refused is timed like a still, so it can never stall. One Pause control
 * stops everything, from the keyboard as well.
 *
 * Chapters are real tabs: arrow keys move between them, Home and End jump.
 */
export function Showcase({
  chapters,
  label,
  className,
  onChapter,
}: {
  chapters: readonly ShowcaseChapter[]
  /** Accessible name for the tab list, e.g. "What's new". */
  label: string
  className?: string
  /** Called when a chapter becomes active (for impressions). */
  onChapter?: (chapter: ShowcaseChapter) => void
}) {
  const labels = usePromotionLabels()
  // The server cannot know the preference, so hydrate as it rendered and
  // switch after: reading it during the first client render would mismatch.
  const reduce = React.useSyncExternalStore(
    subscribeReduce,
    () => window.matchMedia(REDUCE).matches,
    () => false,
  )
  const baseId = React.useId()
  const tabs = React.useRef<(HTMLButtonElement | null)[]>([])
  const [active, setActive] = React.useState(0)
  const [paused, setPaused] = React.useState(false)
  const [held, setHeld] = React.useState(false)
  const [clip, setClip] = React.useState({
    index: -1,
    seconds: null as number | null,
    playing: false,
  })
  const [stills, setStills] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  )
  const hidden = React.useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState === 'hidden',
    () => false,
  )

  const count = chapters.length
  const current = chapters[Math.min(active, count - 1)]
  const latest = React.useRef({ onChapter, current })
  React.useLayoutEffect(() => {
    latest.current = { onChapter, current }
  })
  // Keyed by id: chapters may be rebuilt every render.
  const currentId = current?.id
  React.useEffect(() => {
    const { onChapter: report, current: chapter } = latest.current
    if (chapter) report?.(chapter)
  }, [currentId])

  if (!current) return null

  const advancing = !reduce && count > 1
  const stopped = paused || held || hidden
  const isClip = Boolean(current.media.video) && !stills.has(active)
  const clipNow = clip.index === active ? clip : null
  const next = () => setActive((i) => (i + 1) % count)

  const select = (index: number, focus = false) => {
    const target = (index + count) % count
    setActive(target)
    if (focus) tabs.current[target]?.focus()
  }

  // Roving focus between tabs, mirrored for right-to-left.
  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight'
    const back = rtl ? 'ArrowRight' : 'ArrowLeft'
    const keys: Record<string, number> = {
      [forward]: active + 1,
      ArrowDown: active + 1,
      [back]: active - 1,
      ArrowUp: active - 1,
      Home: 0,
      End: count - 1,
    }
    const target = keys[event.key]
    if (target === undefined) return
    event.preventDefault()
    select(target, true)
  }

  // The active bar is the clock: its animation runs only while the clip
  // plays (or, for a still, while nothing holds it).
  const fill = (): React.CSSProperties | undefined => {
    if (!advancing) return undefined
    const ms = isClip ? (clipNow?.seconds ?? STILL_MS / 1000) * 1000 : STILL_MS
    const running = isClip ? Boolean(clipNow?.playing) && !stopped : !stopped
    return {
      animation: `promo-showcase-fill ${ms}ms linear forwards`,
      animationPlayState: running ? 'running' : 'paused',
    }
  }

  return (
    <section
      aria-roledescription="showcase"
      aria-label={label}
      data-slot="promo-showcase"
      className={cn('@container', className)}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHeld(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setHeld(false)
      }}
      onFocus={() => setHeld(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setHeld(false)
      }}
    >
      <style>{`@keyframes promo-showcase-fill{from{transform:scaleX(0)}to{transform:scaleX(1)}}`}</style>
      {/*
        Container queries, not viewport ones: a showcase in a narrow column
        or a device frame lays out for the space it actually has.
      */}
      <div className="grid gap-5 @2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] @2xl:items-center @2xl:gap-10">
        {/* The frame: every chapter's media stacked, the active one shown. */}
        <div className="relative isolate aspect-[16/10] overflow-hidden rounded-[calc(var(--promo-radius,0.75rem)+0.25rem)] bg-current/5 outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10">
          {chapters.map((chapter, index) => (
            <div
              key={chapter.id}
              id={`${baseId}-panel-${index}`}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${index}`}
              aria-hidden={index !== active}
              inert={index !== active}
              className={cn(
                'absolute inset-0 transition-opacity duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                index === active ? 'opacity-100' : 'opacity-0',
              )}
            >
              {/* The tab names the chapter; its copy is read here. */}
              <span className="sr-only">
                {chapter.title}
                {chapter.body ? `. ${chapter.body}` : ''}
              </span>
              <PromoMedia
                media={chapter.media}
                eager={index === 0}
                active={index === active && !paused}
                playback={advancing ? 'once' : 'loop'}
                // One Pause for the whole showcase; reduced motion gets each
                // clip's own Play, since nothing advances by itself there.
                controls={!advancing}
                className="size-full bg-transparent"
                onDuration={(seconds) =>
                  setClip((c) => ({ ...c, index, seconds }))
                }
                onPlayingChange={(playing) =>
                  setClip((c) =>
                    c.index === index
                      ? { ...c, playing }
                      : { index, seconds: c.seconds, playing },
                  )
                }
                onEnded={advancing && index === active ? next : undefined}
                onFallback={() =>
                  setStills((previous) => new Set(previous).add(index))
                }
              />
            </div>
          ))}
          {advancing ? (
            <button
              type="button"
              aria-label={paused ? labels.play : labels.pause}
              title={paused ? labels.play : labels.pause}
              onClick={() => setPaused((p) => !p)}
              className="absolute end-3 bottom-3 z-10 grid size-9 place-items-center rounded-full bg-black/45 text-white ring-1 ring-white/15 backdrop-blur-md transition-[background-color,transform] duration-150 ease-out outline-none hover:bg-black/65 focus-visible:ring-2 focus-visible:ring-white active:scale-[0.96]"
            >
              {paused ? (
                <IconPlayerPlayFilled
                  aria-hidden
                  className="size-4 translate-x-px"
                />
              ) : (
                <IconPlayerPauseFilled aria-hidden className="size-4" />
              )}
            </button>
          ) : null}
        </div>

        {/* Chapters: a scrolling row on phones, a list beside the frame on wide screens. */}
        <div className="flex min-w-0 flex-col gap-3">
          <div
            role="tablist"
            aria-label={label}
            aria-orientation="horizontal"
            className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] @2xl:mx-0 @2xl:flex-col @2xl:gap-1 @2xl:overflow-visible @2xl:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {chapters.map((chapter, index) => {
              const selected = index === active
              return (
                <button
                  key={chapter.id}
                  ref={(node) => {
                    tabs.current[index] = node
                  }}
                  id={`${baseId}-tab-${index}`}
                  type="button"
                  role="tab"
                  aria-labelledby={`${baseId}-label-${index}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${index}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(index)}
                  onKeyDown={onTabKey}
                  className={cn(
                    'group/chapter relative flex w-[min(78cqw,18rem)] shrink-0 snap-start flex-col gap-1 rounded-[var(--promo-radius,0.75rem)] px-4 py-3 text-start outline-none transition-[background-color] duration-200 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 @2xl:w-auto',
                    selected ? 'bg-muted' : 'hover:bg-muted/50',
                  )}
                >
                  <span
                    id={`${baseId}-label-${index}`}
                    className={cn(
                      'text-sm font-medium transition-colors duration-200',
                      selected ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {chapter.label}
                  </span>
                  {/* The active chapter opens to its copy; the grid row animates its height. */}
                  <span
                    aria-hidden
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none',
                      selected
                        ? 'grid-rows-[1fr] opacity-100'
                        : 'grid-rows-[0fr] opacity-0',
                    )}
                  >
                    <span className="flex min-h-0 flex-col gap-1 overflow-hidden">
                      <span className="[font-family:var(--promo-display,inherit)] text-base leading-snug font-medium text-balance">
                        {chapter.title}
                      </span>
                      {chapter.body ? (
                        <span className="text-muted-foreground text-sm text-pretty">
                          {chapter.body}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {advancing ? (
                    <span
                      aria-hidden
                      className="bg-foreground/10 absolute inset-x-4 bottom-1.5 h-0.5 overflow-hidden rounded-full"
                    >
                      <span
                        key={selected ? `run-${index}-${active}` : undefined}
                        onAnimationEnd={selected && !isClip ? next : undefined}
                        className={cn(
                          'bg-foreground block h-full origin-left rounded-full rtl:origin-right',
                          !selected && 'scale-x-0',
                        )}
                        style={selected ? fill() : undefined}
                      />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
          {/* The active chapter's action, right under its tab list. */}
          {current.action ? <div>{current.action}</div> : null}
        </div>
      </div>
    </section>
  )
}

/** One promotion as a chapter; only records with media can take part. */
function toChapter(promotion: Promotion): ShowcaseChapter | null {
  const media = promotion.media ?? promotion.gallery?.[0]
  if (!media) return null
  return {
    id: promotion.id,
    label: promotion.eyebrow ?? promotion.title,
    title: promotion.title,
    body: promotion.body,
    media,
  }
}

/**
 * The showcase filled from a card slot: every live card in `slot` with
 * media becomes a chapter (eyebrow as its tab label). Each chapter counts
 * its impression when it is the one showing, and its CTA sits under it.
 */
export function PromoShowcase({
  slot = 'showcase',
  label = 'What’s new',
  className,
  fallback = null,
}: {
  slot?: string
  label?: string
  className?: string
  fallback?: React.ReactNode
}) {
  const { cards, report, Link, pathname } = usePromotions()
  const promotions = cards(slot)
  const byId = new Map(promotions.map((p) => [p.id, p]))
  const chapters = promotions.flatMap((promotion) => {
    const chapter = toChapter(promotion)
    if (!chapter) return []
    const cta = promotion.cta
    return [
      {
        ...chapter,
        action: cta ? (
          <Link
            href={cta.href}
            onClick={() => report('click', promotion)}
            className="text-foreground decoration-foreground/30 hover:decoration-foreground inline-flex items-center gap-1 px-4 text-sm font-medium underline underline-offset-4 transition-[text-decoration-color] duration-150"
            {...(cta.external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : {})}
          >
            {cta.label}
          </Link>
        ) : undefined,
      },
    ]
  })
  const [shown, setShown] = React.useState<Promotion | null>(null)
  const onImpression = React.useCallback(
    (p: Promotion) => report('impression', p),
    [report],
  )
  // Each chapter is counted when it is the one showing, and visible.
  const ref = useImpression(shown, onImpression, pathname)

  if (chapters.length === 0) return <>{fallback}</>
  return (
    <div
      ref={(node) => {
        ref.current = node
      }}
      data-promo-slot={slot}
      className={className}
    >
      <Showcase
        chapters={chapters}
        label={label}
        onChapter={(chapter) => setShown(byId.get(chapter.id) ?? null)}
      />
    </div>
  )
}
