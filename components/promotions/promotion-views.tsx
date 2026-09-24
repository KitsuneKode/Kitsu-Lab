'use client'

import * as React from 'react'
import {
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconClock,
  IconCopy,
  IconX,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import {
  countdownVisible,
  formatPrice,
  formatTimeLeft,
  offerBadge,
  type Promotion,
  type PromotionContent,
  type PromotionTone,
} from './promotion'
import type { PromotionLinkProps } from './promotion-provider'

/**
 * Presentational pieces shared by the live renderers, the admin preview and
 * the editor. They take a promotion and callbacks, never the provider, so a
 * draft renders exactly as it will on the site.
 *
 * Every placement is built from the same blocks (eyebrow, offer badge, price,
 * coupon, highlights, countdown, button), which is what keeps five placements
 * reading as one system.
 */

export type PreviewablePromotion = PromotionContent &
  Partial<Pick<Promotion, 'id' | 'campaign'>>

export type PromoViewProps = {
  promotion: PreviewablePromotion
  now: number | null
  Link?: React.ComponentType<PromotionLinkProps>
  onClick?: () => void
  onDismiss?: () => void
  onCopy?: () => void
  locale?: string
}

/* -------------------------------------------------------------------------- */
/*  Tones                                                                     */
/* -------------------------------------------------------------------------- */

type ToneClasses = {
  surface: string
  /** The surface's text colour alone, for controls placed over it. */
  text: string
  muted: string
  chip: string
  badge: string
  button: string
  rule: string
}

/**
 * Tones read shadcn tokens. `highlight` reads `--promo-highlight` and
 * `--promo-highlight-foreground` when a theme defines them and falls back to
 * the accent pair, so a brand colour drops in without forking the component.
 * Class strings are written out whole so Tailwind can see every one.
 */
export const promotionTones: Record<PromotionTone, ToneClasses> = {
  neutral: {
    surface: 'bg-card text-card-foreground ring-1 ring-foreground/10',
    text: 'text-card-foreground',
    muted: 'text-muted-foreground',
    chip: 'bg-foreground/[0.06] text-foreground',
    badge: 'bg-foreground text-background',
    button:
      'bg-primary text-primary-foreground hover:bg-primary/85 focus-visible:ring-ring/50',
    rule: 'border-foreground/15',
  },
  brand: {
    surface: 'bg-primary text-primary-foreground',
    text: 'text-primary-foreground',
    muted: 'text-primary-foreground/70',
    chip: 'bg-primary-foreground/12 text-primary-foreground',
    badge: 'bg-primary-foreground text-primary',
    button:
      'bg-primary-foreground text-primary hover:bg-primary-foreground/90 focus-visible:ring-primary-foreground/40',
    rule: 'border-primary-foreground/25',
  },
  highlight: {
    surface:
      'bg-[var(--promo-highlight,var(--accent))] text-[var(--promo-highlight-foreground,var(--accent-foreground))] ring-1 ring-foreground/5',
    text: 'text-[var(--promo-highlight-foreground,var(--accent-foreground))]',
    muted: 'opacity-75',
    chip: 'bg-foreground/[0.08]',
    badge: 'bg-foreground text-background',
    button:
      'bg-foreground text-background hover:bg-foreground/85 focus-visible:ring-foreground/30',
    rule: 'border-foreground/20',
  },
}

/* -------------------------------------------------------------------------- */
/*  Blocks                                                                    */
/* -------------------------------------------------------------------------- */

function PlainLink({
  href,
  className,
  children,
  onClick,
  target,
  rel,
}: PromotionLinkProps) {
  return (
    <a
      href={href}
      className={className}
      onClick={onClick}
      target={target}
      rel={rel}
    >
      {children}
    </a>
  )
}

export function PromoEyebrow({
  children,
  tone,
  className,
}: {
  children: React.ReactNode
  tone: PromotionTone
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium whitespace-nowrap',
        promotionTones[tone].chip,
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PromoOfferBadge({
  promotion,
  locale,
  className,
}: {
  promotion: PreviewablePromotion
  locale?: string
  className?: string
}) {
  const label = offerBadge(promotion.offer, locale)
  if (!label) return null
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold tracking-tight whitespace-nowrap tabular-nums',
        promotionTones[promotion.tone].badge,
        className,
      )}
    >
      {label}
    </span>
  )
}

export function PromoCountdown({
  promotion,
  now,
  className,
}: {
  promotion: PreviewablePromotion
  now: number | null
  className?: string
}) {
  if (now === null || !countdownVisible(promotion, now)) return null
  const label = formatTimeLeft(promotion.endsAt, now)
  if (!label) return null
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium whitespace-nowrap tabular-nums',
        promotionTones[promotion.tone].chip,
        className,
      )}
    >
      <IconClock aria-hidden className="size-3.5" />
      {label}
    </span>
  )
}

/** Eyebrow, offer badge and countdown, in that order, wrapping as needed. */
export function PromoMeta({
  promotion,
  now,
  locale,
  className,
}: {
  promotion: PreviewablePromotion
  now: number | null
  locale?: string
  className?: string
}) {
  const hasBadge = Boolean(offerBadge(promotion.offer, locale))
  const hasCountdown = now !== null && countdownVisible(promotion, now)
  if (!promotion.eyebrow && !hasBadge && !hasCountdown) return null
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {promotion.eyebrow ? (
        <PromoEyebrow tone={promotion.tone}>{promotion.eyebrow}</PromoEyebrow>
      ) : null}
      <PromoOfferBadge promotion={promotion} locale={locale} />
      <PromoCountdown promotion={promotion} now={now} />
    </div>
  )
}

export function PromoPrice({
  promotion,
  locale,
  size = 'md',
  className,
}: {
  promotion: PreviewablePromotion
  locale?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const price = promotion.offer?.price
  if (!price) return null
  const tones = promotionTones[promotion.tone]
  return (
    <p className={cn('flex flex-wrap items-baseline gap-x-2', className)}>
      <span
        className={cn(
          'font-semibold tracking-tight tabular-nums',
          size === 'lg' ? 'text-3xl' : size === 'md' ? 'text-2xl' : 'text-lg',
        )}
      >
        {formatPrice(price.amount, price.currency, locale)}
      </span>
      {price.was !== undefined ? (
        <span className={cn('text-sm tabular-nums line-through', tones.muted)}>
          <span className="sr-only">was </span>
          {formatPrice(price.was, price.currency, locale)}
        </span>
      ) : null}
    </p>
  )
}

/**
 * A code the visitor can copy in one tap. Copying is reported as an event so
 * a campaign can tell interest from clicks.
 */
export function PromoCoupon({
  promotion,
  onCopy,
  className,
}: {
  promotion: PreviewablePromotion
  onCopy?: () => void
  className?: string
}) {
  const code = promotion.offer?.code
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1800)
    return () => window.clearTimeout(timer)
  }, [copied])
  if (!code) return null
  const tones = promotionTones[promotion.tone]

  async function copy() {
    try {
      await navigator.clipboard.writeText(code!)
    } catch {
      // The code stays visible and selectable; nothing else to do.
    }
    setCopied(true)
    onCopy?.()
  }

  return (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-lg border border-dashed pr-1 pl-3',
        tones.rule,
        className,
      )}
    >
      <span className={cn('text-xs', tones.muted)}>Code</span>
      <span className="font-mono text-sm font-semibold tracking-wider select-all">
        {code}
      </span>
      <button
        type="button"
        onClick={copy}
        className={cn(
          'ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium outline-none focus-visible:ring-3',
          tones.chip,
        )}
      >
        {copied ? (
          <IconCheck aria-hidden className="size-3.5" />
        ) : (
          <IconCopy aria-hidden className="size-3.5" />
        )}
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? `Code ${code} copied` : ''}
      </span>
    </div>
  )
}

export function PromoHighlights({
  promotion,
  className,
}: {
  promotion: PreviewablePromotion
  className?: string
}) {
  const items = promotion.highlights
  if (!items?.length) return null
  return (
    <ul className={cn('grid gap-2 text-sm', className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <IconCheck
            aria-hidden
            className={cn(
              'mt-0.5 size-4 shrink-0',
              promotionTones[promotion.tone].muted,
            )}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function PromoTerms({
  promotion,
  className,
}: {
  promotion: PreviewablePromotion
  className?: string
}) {
  const terms = promotion.offer?.terms
  if (!terms) return null
  return (
    <p
      className={cn(
        'text-xs leading-relaxed',
        promotionTones[promotion.tone].muted,
        className,
      )}
    >
      {terms}
    </p>
  )
}

/** The call to action as a button-shaped link. */
export function PromoCta({
  promotion,
  Link = PlainLink,
  onClick,
  variant = 'button',
  className,
}: {
  promotion: PreviewablePromotion
  Link?: React.ComponentType<PromotionLinkProps>
  onClick?: () => void
  variant?: 'button' | 'text'
  className?: string
}) {
  const cta = promotion.cta
  if (!cta) return null
  const Icon = cta.external ? IconArrowUpRight : IconArrowRight
  const tones = promotionTones[promotion.tone]
  return (
    <Link
      href={cta.href}
      onClick={onClick}
      className={cn(
        'group/cta inline-flex items-center justify-center gap-1.5 text-sm font-medium outline-none',
        variant === 'button'
          ? cn(
              'h-10 rounded-lg px-4 transition-colors focus-visible:ring-3',
              tones.button,
            )
          : 'underline decoration-current/35 underline-offset-4 hover:decoration-current focus-visible:decoration-2',
        className,
      )}
      {...(cta.external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
    >
      {cta.label}
      <Icon
        aria-hidden
        className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
      />
      {cta.external ? (
        <span className="sr-only"> (opens in a new tab)</span>
      ) : null}
    </Link>
  )
}

export function PromoClose({
  onDismiss,
  label,
  className,
}: {
  onDismiss?: () => void
  label: string
  className?: string
}) {
  if (!onDismiss) return null
  return (
    <button
      type="button"
      onClick={onDismiss}
      aria-label={label}
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full opacity-70 transition-[opacity,background-color] outline-none hover:bg-current/10 hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-3 focus-visible:ring-current/25',
        className,
      )}
    >
      <IconX aria-hidden className="size-4" />
    </button>
  )
}

export function PromoMedia({
  promotion,
  className,
  eager,
}: {
  promotion: PreviewablePromotion
  className?: string
  eager?: boolean
}) {
  const media = promotion.media
  if (!media) return null
  return (
    // Plain img: the registry must not assume a framework image loader.
    // oxlint-disable-next-line nextjs/no-img-element
    <img
      src={media.src}
      alt={media.alt}
      width={media.width}
      height={media.height}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('block w-full object-cover', className)}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Placements                                                                */
/* -------------------------------------------------------------------------- */

/** A slim announcement. One line on desktop, two at most on a phone. */
export function PromoBarView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  locale,
}: PromoViewProps) {
  const tones = promotionTones[promotion.tone]
  return (
    <div
      role="region"
      aria-label={promotion.eyebrow ?? 'Announcement'}
      className={cn(
        '@container w-full text-sm',
        tones.surface,
        'rounded-none ring-0',
      )}
    >
      <div className="mx-auto flex min-h-11 max-w-screen-xl items-center gap-2 py-1.5 pr-2 pl-4 @xl:pl-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          {promotion.eyebrow ? (
            <PromoEyebrow
              tone={promotion.tone}
              className="hidden @xl:inline-flex"
            >
              {promotion.eyebrow}
            </PromoEyebrow>
          ) : null}
          <PromoOfferBadge promotion={promotion} locale={locale} />
          <span className="font-medium">{promotion.title}</span>
          {promotion.body ? (
            <span className={cn('hidden @4xl:inline', tones.muted)}>
              {promotion.body}
            </span>
          ) : null}
          <PromoCountdown promotion={promotion} now={now} />
          <PromoCta
            promotion={promotion}
            Link={Link}
            onClick={onClick}
            variant="text"
          />
        </div>
        <PromoClose onDismiss={onDismiss} label="Dismiss announcement" />
      </div>
    </div>
  )
}

/**
 * Inline card. With media it splits into image and content side by side on
 * wide containers; without, it is a single calm column.
 */
export function PromoCardView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  onCopy,
  locale,
  className,
}: PromoViewProps & { className?: string }) {
  const tones = promotionTones[promotion.tone]
  const media = promotion.media
  return (
    <aside
      aria-label={promotion.eyebrow ?? promotion.title}
      className={cn(
        '@container relative overflow-hidden rounded-2xl text-sm',
        tones.surface,
        className,
      )}
    >
      <div
        className={cn(
          'grid',
          media && '@lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]',
        )}
      >
        {media ? (
          <PromoMedia
            promotion={promotion}
            className="aspect-[16/9] @lg:aspect-auto @lg:h-full"
          />
        ) : null}
        <div className="flex flex-col gap-4 p-5 @md:p-6">
          <PromoMeta
            promotion={promotion}
            now={now}
            locale={locale}
            className="pr-8"
          />
          <div className="grid gap-1.5">
            <p className="text-lg leading-snug font-semibold tracking-tight text-balance @md:text-xl">
              {promotion.title}
            </p>
            {promotion.body ? (
              <p className={cn('leading-relaxed text-pretty', tones.muted)}>
                {promotion.body}
              </p>
            ) : null}
          </div>
          <PromoHighlights promotion={promotion} />
          {promotion.offer?.price || promotion.offer?.code ? (
            <div className="grid gap-3 @md:grid-cols-[auto_minmax(0,1fr)] @md:items-center">
              <PromoPrice promotion={promotion} locale={locale} />
              <PromoCoupon promotion={promotion} onCopy={onCopy} />
            </div>
          ) : null}
          {promotion.cta || promotion.offer?.terms ? (
            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
              <PromoCta promotion={promotion} Link={Link} onClick={onClick} />
              <PromoTerms promotion={promotion} className="min-w-0 flex-1" />
            </div>
          ) : null}
        </div>
      </div>
      {onDismiss ? (
        <PromoClose
          onDismiss={onDismiss}
          label={`Dismiss ${promotion.title}`}
          className="absolute top-3 right-3"
        />
      ) : null}
    </aside>
  )
}

/**
 * A small floating card for a bottom corner. It never blocks the page, so it
 * suits a quiet nudge: a launch, a code, a last day.
 */
export function PromoCornerView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  onCopy,
  locale,
  className,
}: PromoViewProps & { className?: string }) {
  const tones = promotionTones[promotion.tone]
  return (
    <aside
      aria-label={promotion.eyebrow ?? promotion.title}
      className={cn(
        'relative w-[min(calc(100vw-2rem),22rem)] overflow-hidden rounded-2xl text-sm shadow-xl shadow-black/10',
        tones.surface,
        className,
      )}
    >
      {promotion.media ? (
        <PromoMedia
          promotion={promotion}
          className="aspect-[2/1] object-top max-sm:hidden"
        />
      ) : null}
      <div className="flex flex-col gap-3 p-4">
        <PromoMeta
          promotion={promotion}
          now={now}
          locale={locale}
          className="pr-8"
        />
        <div className="grid gap-1">
          <p className="text-base leading-snug font-semibold tracking-tight text-balance">
            {promotion.title}
          </p>
          {promotion.body ? (
            <p
              className={cn(
                'line-clamp-3 leading-relaxed max-sm:line-clamp-2',
                tones.muted,
              )}
            >
              {promotion.body}
            </p>
          ) : null}
        </div>
        <PromoPrice promotion={promotion} locale={locale} size="sm" />
        <PromoCoupon promotion={promotion} onCopy={onCopy} />
        <PromoCta
          promotion={promotion}
          Link={Link}
          onClick={onClick}
          className="w-full"
        />
        <PromoTerms promotion={promotion} />
      </div>
      <PromoClose
        onDismiss={onDismiss}
        label={`Dismiss ${promotion.title}`}
        className={cn(
          'absolute top-2.5 right-2.5',
          promotion.media &&
            'bg-background/80 text-foreground opacity-100 backdrop-blur-sm max-sm:bg-transparent max-sm:text-current max-sm:backdrop-blur-none',
        )}
      />
    </aside>
  )
}

type TextComponent = React.ComponentType<{
  className?: string
  children?: React.ReactNode
}>

function DefaultTitle({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return <p className={className}>{children}</p>
}

function DefaultDescription({
  className,
  children,
}: {
  className?: string
  children?: React.ReactNode
}) {
  return <p className={className}>{children}</p>
}

/**
 * The inside of a side sheet or a dialog. The surface itself comes from the
 * renderer, which passes its own Title and Description so the popup is
 * labelled for assistive technology. Overlays always sit on the neutral
 * popover surface; the tone only colours the badge.
 *
 * `layout="panel"` gives the sheet a pinned footer, so the button stays in
 * reach however long the details run.
 */
export function PromoOverlayContent({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  onCopy,
  locale,
  layout = 'dialog',
  Title = DefaultTitle,
  Description = DefaultDescription,
}: PromoViewProps & {
  layout?: 'dialog' | 'panel'
  Title?: TextComponent
  Description?: TextComponent
}) {
  const neutral = { ...promotion, tone: 'neutral' as const }
  // Without an image, a brand or highlight tone gives the overlay a coloured
  // header, so it carries the campaign's voice instead of a blank top.
  const banner = !promotion.media && promotion.tone !== 'neutral'
  const heading = (
    <div className="grid gap-3">
      <PromoMeta
        promotion={banner ? promotion : neutral}
        now={now}
        locale={locale}
      />
      <div className="grid gap-2">
        <Title
          className={cn(
            'text-xl leading-snug font-semibold tracking-tight text-balance',
            banner ? 'text-current' : 'text-foreground',
          )}
        >
          {promotion.title}
        </Title>
        {promotion.body ? (
          <Description
            className={cn(
              'text-sm leading-relaxed text-pretty',
              banner
                ? cn('text-current', promotionTones[promotion.tone].muted)
                : 'text-muted-foreground',
            )}
          >
            {promotion.body}
          </Description>
        ) : null}
      </div>
    </div>
  )
  const details =
    promotion.highlights?.length ||
    promotion.offer?.price ||
    promotion.offer?.code ? (
      <div className="flex flex-col gap-4">
        <PromoHighlights promotion={neutral} />
        {promotion.offer?.price || promotion.offer?.code ? (
          <div className="bg-muted/60 grid gap-3 rounded-xl p-3">
            <PromoPrice promotion={neutral} locale={locale} />
            <PromoCoupon promotion={neutral} onCopy={onCopy} />
          </div>
        ) : null}
      </div>
    ) : null
  const bannerClass = cn(
    'p-5 pr-12 @sm:p-6 @sm:pr-12',
    promotionTones[promotion.tone].surface,
    'ring-0',
  )
  const content = banner ? (
    details
  ) : (
    <div className="flex flex-col gap-4">
      {heading}
      {details}
    </div>
  )

  const closeButton = onDismiss ? (
    <PromoClose
      onDismiss={onDismiss}
      label="Close"
      className={cn(
        'absolute top-3 right-3 z-10',
        promotion.media &&
          'bg-background/80 text-foreground opacity-100 backdrop-blur-sm',
        !promotion.media &&
          (banner ? promotionTones[promotion.tone].text : 'text-foreground'),
      )}
    />
  ) : null

  const actions = (
    <div className="grid gap-2">
      <div className="flex flex-col-reverse gap-2 @sm:flex-row @sm:items-center @sm:justify-end">
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 h-10 rounded-lg px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-3"
          >
            Not now
          </button>
        ) : null}
        <PromoCta
          promotion={neutral}
          Link={Link}
          onClick={onClick}
          className={layout === 'panel' ? '@sm:flex-1' : undefined}
        />
      </div>
      <PromoTerms promotion={neutral} />
    </div>
  )

  if (layout === 'panel') {
    return (
      <div className="@container relative flex h-full min-h-0 flex-col">
        {closeButton}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {promotion.media ? (
            <PromoMedia
              promotion={promotion}
              className="aspect-[16/10]"
              eager
            />
          ) : null}
          {banner ? <div className={bannerClass}>{heading}</div> : null}
          {content ? <div className="p-5 @sm:p-6">{content}</div> : null}
        </div>
        <div className="border-border border-t p-4 @sm:px-6">{actions}</div>
      </div>
    )
  }

  return (
    <div className="@container relative flex flex-col">
      {closeButton}
      {promotion.media ? (
        <PromoMedia
          promotion={promotion}
          className="aspect-[16/9] rounded-t-xl"
          eager
        />
      ) : null}
      {banner ? (
        <div className={cn(bannerClass, 'rounded-t-xl')}>{heading}</div>
      ) : null}
      <div className="flex flex-col gap-5 p-5 @sm:p-6">
        {content}
        {actions}
      </div>
    </div>
  )
}
