'use client'

import * as React from 'react'
import {
  IconChevronLeft,
  IconChevronRight,
  IconMinus,
  IconSparkles,
  IconX,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import type { Promotion } from './promotion'
import { usePromotions } from './promotion-provider'
import { PromoCode, countdownLabel } from './promotion-views'

const CARD_WIDTH = 288
const STRIP = 56

/** Observes an element's size, or the window when none is given. */
function subscribeResize(target: HTMLElement | null, onChange: () => void) {
  if (target && typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(onChange)
    observer.observe(target)
    return () => observer.disconnect()
  }
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

/**
 * Free space on the card's side of the content. With a `content` element it
 * measures the real gap (content need not be centred); otherwise it assumes
 * a centred column `contentWidth` wide.
 */
function useGutter(
  contentWidth: number,
  container: HTMLElement | null | undefined,
  content: React.RefObject<HTMLElement | null> | undefined,
) {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const offs = [subscribeResize(container ?? null, onChange)]
      if (content?.current)
        offs.push(subscribeResize(content.current, onChange))
      return () => offs.forEach((off) => off())
    },
    [container, content],
  )
  return React.useSyncExternalStore(
    subscribe,
    () => {
      const frame = container?.getBoundingClientRect() ?? {
        left: 0,
        right: window.innerWidth,
        width: window.innerWidth,
      }
      const element = content?.current
      if (!element) return Math.max(0, (frame.width - contentWidth) / 2)
      const box = element.getBoundingClientRect()
      const rtl = getComputedStyle(element).direction === 'rtl'
      return Math.max(0, rtl ? box.left - frame.left : frame.right - box.right)
    },
    () => 0,
  )
}

/**
 * The "what's on" card that sits beside the page, as on many payment and
 * banking dashboards, without covering it.
 *
 * - **Docked** when the margin beside your content column (`contentWidth`)
 *   has room: a full card lives in empty space and covers nothing.
 * - **Peeking** when it does not: only a 56px strip with a thumbnail shows
 *   at the screen edge. Hover, focus or a tap slides the card out (transform
 *   only, on the drawer curve); leaving slides it back.
 * - Several live side cards become a small pager, one at a time.
 *
 * On phones it stays out of the way by default (`mobile="hide"`); the
 * offers inbox is the better home there.
 */
export function PromoSideCard({
  contentWidth = 1200,
  mobile = 'hide',
  container,
  content,
  className,
}: {
  /** Your main content element; measured for the real free space beside it. */
  content?: React.RefObject<HTMLElement | null>
  /** Width of your main content column, used to find free margin space. */
  contentWidth?: number
  mobile?: 'hide' | 'peek'
  /** Measure this element instead of the window (a demo frame). */
  container?: HTMLElement | null
  className?: string
}) {
  const { sides, dialog, sheetOpen, now, dismiss, report, labels, Link } =
    usePromotions()
  // Step aside while a modal surface owns the screen.
  const yielding = Boolean(dialog) || sheetOpen
  const gutter = useGutter(contentWidth, container, content)
  const [index, setIndex] = React.useState(0)
  const [hovered, setHovered] = React.useState(false)
  const [focused, setFocused] = React.useState(false)
  const [pinned, setPinned] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const root = React.useRef<HTMLDivElement>(null)

  const promotion: Promotion | undefined =
    sides[Math.min(index, sides.length - 1)]
  const docked = !collapsed && gutter >= CARD_WIDTH + 24
  const open = docked || hovered || focused || pinned

  const reported = React.useRef(new Set<string>())
  React.useEffect(() => {
    if (!promotion || !open || reported.current.has(promotion.id)) return
    reported.current.add(promotion.id)
    report('impression', promotion)
  }, [promotion, open, report])

  // A tap outside puts a pinned card back.
  React.useEffect(() => {
    if (!pinned) return
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPinned(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [pinned])

  if (!promotion) return null
  const image = promotion.gallery?.[0] ?? promotion.media
  const ends = countdownLabel(promotion, now, labels)

  return (
    <div
      ref={root}
      role="complementary"
      aria-label={labels.whatsOn}
      inert={yielding}
      data-slot="promo-side-card"
      data-state={docked ? 'docked' : open ? 'open' : 'peek'}
      onPointerEnter={(event) => {
        if (event.pointerType === 'mouse') setHovered(true)
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setHovered(false)
      }}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setFocused(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !docked) {
          setPinned(false)
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
      }}
      style={
        {
          width: CARD_WIDTH,
          '--promo-peek': `${CARD_WIDTH - STRIP}px`,
        } as React.CSSProperties
      }
      className={cn(
        // One explicit transform for both states: Tailwind's translate
        // utilities use the separate `translate` property and would stack.
        'fixed end-0 top-1/2 z-30 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none print:hidden',
        open
          ? '[transform:translate(-0.75rem,-50%)] rtl:[transform:translate(0.75rem,-50%)]'
          : '[transform:translate(var(--promo-peek),-50%)] rtl:[transform:translate(calc(var(--promo-peek)*-1),-50%)]',
        mobile === 'hide' && 'max-sm:hidden',
        yielding && 'pointer-events-none opacity-0',
        className,
      )}
    >
      <div className="bg-popover text-popover-foreground flex overflow-hidden rounded-[calc(var(--promo-radius,0.75rem)+0.25rem)] text-sm shadow-xl ring-1 ring-black/5 dark:ring-white/10">
        {/* The strip: all that shows while peeking, and the image column when open. */}
        <button
          type="button"
          aria-label={labels.restore(promotion.title)}
          aria-expanded={open}
          onClick={() => {
            if (collapsed) setCollapsed(false)
            setPinned((p) => !p)
          }}
          className="focus-visible:ring-ring/50 relative flex w-14 shrink-0 flex-col items-center gap-2 py-3 outline-none focus-visible:ring-3 focus-visible:ring-inset"
        >
          {image ? (
            // oxlint-disable-next-line nextjs/no-img-element
            <img
              src={image.src}
              alt=""
              width={40}
              height={40}
              decoding="async"
              className="size-10 rounded-lg bg-current/5 object-cover"
            />
          ) : (
            <span className="bg-primary/10 text-primary grid size-10 place-items-center rounded-lg">
              <IconSparkles aria-hidden className="size-5" />
            </span>
          )}
          {sides.length > 1 ? (
            <span className="text-muted-foreground text-[0.6875rem] font-medium tabular-nums">
              {index + 1}/{sides.length}
            </span>
          ) : null}
          {promotion.tone !== 'neutral' ? (
            <span
              aria-hidden
              className={cn(
                'absolute inset-y-3 start-0 w-0.5 rounded-e-full',
                promotion.tone === 'brand'
                  ? 'bg-primary'
                  : 'bg-[var(--promo-highlight,var(--primary))]',
              )}
            />
          ) : null}
        </button>

        <div
          inert={!open}
          className={cn(
            'flex min-w-0 flex-1 flex-col gap-1.5 py-3 pe-3 transition-opacity duration-200 ease-out',
            !open && 'opacity-0',
          )}
        >
          <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
            <span
              className="bg-primary size-1.5 shrink-0 rounded-full"
              aria-hidden
            />
            <span className="truncate font-medium">
              {promotion.eyebrow ?? labels.whatsOn}
            </span>
            <span className="ms-auto flex shrink-0">
              {!docked ? null : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={labels.minimize}
                  onClick={() => setCollapsed(true)}
                >
                  <IconMinus aria-hidden />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={labels.dismissNamed(promotion.title)}
                onClick={() => {
                  dismiss(promotion)
                  setIndex(0)
                }}
              >
                <IconX aria-hidden />
              </Button>
            </span>
          </div>
          <p className="[font-family:var(--promo-display,inherit)] leading-snug font-medium text-balance">
            {promotion.title}
          </p>
          {promotion.body ? (
            <p className="text-muted-foreground line-clamp-3 text-pretty">
              {promotion.body}
            </p>
          ) : null}
          {ends ? (
            <span className="text-muted-foreground text-xs tabular-nums">
              {ends}
            </span>
          ) : null}
          {promotion.code ? (
            <PromoCode
              code={promotion.code}
              reveal={promotion.revealCode}
              onReveal={() => report('reveal', promotion)}
              onCopy={() => report('copy', promotion)}
              className="mt-1 self-start"
            />
          ) : null}
          <div className="mt-1 flex items-center gap-2">
            {promotion.cta ? (
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <Link
                    href={promotion.cta.href}
                    onClick={() => report('click', promotion)}
                    {...(promotion.cta.external
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {promotion.cta.label}
                  </Link>
                }
              />
            ) : null}
            {sides.length > 1 ? (
              <span className="ms-auto flex">
                {([-1, 1] as const).map((step) => (
                  <Button
                    key={step}
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={step === -1 ? labels.previous : labels.next}
                    onClick={() =>
                      setIndex((i) => (i + step + sides.length) % sides.length)
                    }
                  >
                    {step === -1 ? (
                      <IconChevronLeft
                        aria-hidden
                        className="rtl:-scale-x-100"
                      />
                    ) : (
                      <IconChevronRight
                        aria-hidden
                        className="rtl:-scale-x-100"
                      />
                    )}
                  </Button>
                ))}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
