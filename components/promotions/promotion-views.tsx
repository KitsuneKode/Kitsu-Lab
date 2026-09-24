'use client'

import * as React from 'react'
import {
  IconArrowRight,
  IconArrowUpRight,
  IconCheck,
  IconCopy,
  IconMinus,
  IconX,
} from '@tabler/icons-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  countdownVisible,
  timeLeft,
  type Promotion,
  type PromotionContent,
  type PromotionTone,
} from './promotion'
import {
  usePromotionLabels,
  type PromotionLabels,
  type PromotionLinkProps,
} from './promotion-provider'

/**
 * Presentational pieces shared by the live renderers and the editor preview.
 * They take a promotion and callbacks, never the provider, so a draft can be
 * previewed exactly as it will render.
 *
 * Tones read shadcn tokens. `highlight` reads `--promo-highlight` and
 * `--promo-highlight-foreground` when a theme defines them, and falls back to
 * the accent pair, so a brand colour can be dropped in without forking.
 */
export const promotionToneClasses: Record<PromotionTone, string> = {
  neutral: 'bg-muted text-foreground',
  brand: 'bg-primary text-primary-foreground',
  highlight:
    'bg-[var(--promo-highlight,var(--accent))] text-[var(--promo-highlight-foreground,var(--accent-foreground))]',
}

/** Strong ease-out: starts fast, so an entrance feels like a response. */
export const PROMO_EASE_OUT = [0.23, 1, 0.32, 1] as const

export type PreviewablePromotion = PromotionContent &
  Partial<Pick<Promotion, 'id' | 'campaign'>>

type ViewProps = {
  promotion: PreviewablePromotion
  now: number | null
  Link?: React.ComponentType<PromotionLinkProps>
  onClick?: () => void
  onDismiss?: () => void
  onCopy?: () => void
}

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

export function countdownLabel(
  promotion: Pick<PromotionContent, 'showCountdown' | 'endsAt'>,
  now: number | null,
  labels: PromotionLabels,
): string | null {
  if (now === null || !countdownVisible(promotion, now)) return null
  const left = timeLeft(promotion.endsAt, now)
  return left ? labels.endsIn(left) : null
}

function Countdown({
  promotion,
  now,
}: {
  promotion: PreviewablePromotion
  now: number | null
}) {
  const label = countdownLabel(promotion, now, usePromotionLabels())
  if (!label) return null
  return (
    <span className="rounded-md bg-current/10 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums ring-1 ring-current/15">
      {label}
    </span>
  )
}

function CtaLink({
  promotion,
  Link = PlainLink,
  onClick,
  className,
}: Pick<ViewProps, 'promotion' | 'Link' | 'onClick'> & { className?: string }) {
  const labels = usePromotionLabels()
  const cta = promotion.cta
  if (!cta) return null
  const Icon = cta.external ? IconArrowUpRight : IconArrowRight
  return (
    <Link
      href={cta.href}
      onClick={onClick}
      className={cn(
        'group/cta inline-flex items-center gap-1 font-medium',
        className,
      )}
      {...(cta.external
        ? { target: '_blank', rel: 'noopener noreferrer' }
        : {})}
    >
      {cta.label}
      <Icon
        aria-hidden
        className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/cta:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-hover/cta:-translate-x-0.5"
      />
      {cta.external ? (
        <span className="sr-only"> {labels.opensInNewTab}</span>
      ) : null}
    </Link>
  )
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Older Safari and insecure origins: a hidden textarea still works.
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.append(area)
    area.select()
    const ok = document.execCommand('copy')
    area.remove()
    return ok
  }
}

/**
 * The code as text anyone can select, plus a copy button whose icon morphs to
 * a check. The swap is masked with a short blur so it reads as one object
 * changing, not two crossfading; reduced motion keeps only the fade.
 */
export function PromoCode({
  code,
  onCopy,
  className,
}: {
  code: string
  onCopy?: () => void
  className?: string
}) {
  const labels = usePromotionLabels()
  const reduce = useReducedMotion()
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 1600)
    return () => window.clearTimeout(timer)
  }, [copied])

  const hidden = reduce
    ? { opacity: 0 }
    : { opacity: 0, scale: 0.8, filter: 'blur(2px)' }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-dashed border-current/35 py-0.5 ps-2 pe-0.5 text-sm',
        className,
      )}
    >
      <span className="font-mono font-medium tracking-wider select-all">
        {code}
      </span>
      <button
        type="button"
        aria-label={labels.copyCode(code)}
        onClick={async () => {
          if (await writeClipboard(code)) {
            setCopied(true)
            onCopy?.()
          }
        }}
        className="relative grid size-7 place-items-center rounded-md transition-[background-color,transform] duration-150 ease-out outline-none hover:bg-current/10 focus-visible:ring-3 focus-visible:ring-current/30 active:scale-[0.96]"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            key={copied ? 'done' : 'copy'}
            initial={hidden}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={hidden}
            transition={{ duration: 0.16, ease: PROMO_EASE_OUT }}
            className="grid place-items-center"
          >
            {copied ? (
              <IconCheck aria-hidden className="size-4" />
            ) : (
              <IconCopy aria-hidden className="size-4" />
            )}
          </motion.span>
        </AnimatePresence>
      </button>
      <span role="status" className="sr-only">
        {copied ? labels.copied : ''}
      </span>
    </span>
  )
}

function IconAction({
  onAction,
  label,
  icon: Icon = IconX,
}: {
  onAction?: () => void
  label: string
  icon?: typeof IconX
}) {
  if (!onAction) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onAction}
      aria-label={label}
      className="shrink-0 text-current hover:bg-current/10 hover:text-current"
    >
      <Icon aria-hidden />
    </Button>
  )
}

/* -------------------------------------------------------------------------- */

export type PromoBarVariant = 'inline' | 'floating'

/**
 * `inline` is the classic full-width strip in the page flow. `floating` is a
 * pill docked to the bottom of the viewport: it never shifts layout (no CLS),
 * sits in the thumb zone on phones, and suits pages with a sticky header.
 */
export function PromoBarView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  onCopy,
  variant = 'inline',
}: ViewProps & { variant?: PromoBarVariant }) {
  const labels = usePromotionLabels()
  const floating = variant === 'floating'
  return (
    <div
      role="region"
      aria-label={promotion.eyebrow ?? labels.announcement}
      className={cn(
        'text-sm forced-colors:border',
        floating
          ? 'rounded-2xl shadow-lg ring-1 shadow-black/10 ring-black/5 sm:rounded-full dark:ring-white/10'
          : 'w-full border-b border-current/10',
        promotionToneClasses[promotion.tone],
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3',
          floating
            ? 'py-1.5 ps-4 pe-1.5'
            : 'mx-auto max-w-screen-xl px-4 py-2 sm:px-6',
        )}
      >
        <p
          className={cn(
            'flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1',
            !floating && 'justify-center text-center',
          )}
        >
          {promotion.eyebrow ? (
            <span className="font-medium opacity-80">{promotion.eyebrow}</span>
          ) : null}
          <span className="font-medium">{promotion.title}</span>
          {promotion.body && !floating ? (
            <span className="hidden opacity-80 md:inline">
              {promotion.body}
            </span>
          ) : null}
          <Countdown promotion={promotion} now={now} />
          {promotion.code ? (
            <PromoCode code={promotion.code} onCopy={onCopy} />
          ) : null}
          <CtaLink
            promotion={promotion}
            Link={Link}
            onClick={onClick}
            className="underline decoration-current/40 underline-offset-4 hover:decoration-current"
          />
        </p>
        <IconAction onAction={onDismiss} label={labels.dismiss} />
      </div>
    </div>
  )
}

function Media({
  media,
  className,
  eager,
}: {
  media: NonNullable<PromotionContent['media']>
  className?: string
  eager?: boolean
}) {
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
      className={cn('bg-current/5 object-cover', className)}
    />
  )
}

export function PromoCardView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  onCopy,
  className,
}: ViewProps & { className?: string }) {
  const labels = usePromotionLabels()
  const media = promotion.media
  return (
    <aside
      aria-label={promotion.eyebrow ?? promotion.title}
      className={cn(
        '@container relative overflow-hidden rounded-xl text-sm ring-1 ring-black/5 forced-colors:border dark:ring-white/10',
        promotionToneClasses[promotion.tone],
        className,
      )}
    >
      <div className={cn('flex flex-col', media && '@md:flex-row')}>
        {media ? (
          <Media
            media={media}
            className="aspect-[16/9] w-full @md:aspect-auto @md:w-2/5"
          />
        ) : null}
        <div className="flex flex-1 flex-col gap-2 p-4 @md:p-5">
          <div className="flex min-h-5 items-center gap-2 pe-8">
            {promotion.eyebrow ? (
              <span className="text-xs font-medium tracking-wide uppercase opacity-75">
                {promotion.eyebrow}
              </span>
            ) : null}
            <Countdown promotion={promotion} now={now} />
          </div>
          <p className="text-base leading-snug font-medium text-balance">
            {promotion.title}
          </p>
          {promotion.body ? (
            <p className="leading-relaxed text-pretty opacity-80">
              {promotion.body}
            </p>
          ) : null}
          {promotion.code || promotion.cta ? (
            <div className="mt-1 flex flex-wrap items-center gap-3">
              {promotion.code ? (
                <PromoCode code={promotion.code} onCopy={onCopy} />
              ) : null}
              <CtaLink
                promotion={promotion}
                Link={Link}
                onClick={onClick}
                className="underline decoration-current/30 underline-offset-4 hover:decoration-current"
              />
            </div>
          ) : null}
        </div>
      </div>
      {onDismiss ? (
        <div className="absolute end-2 top-2">
          <IconAction
            onAction={onDismiss}
            label={labels.dismissNamed(promotion.title)}
          />
        </div>
      ) : null}
    </aside>
  )
}

/**
 * The toast's face: a compact card for a corner of the screen. No focus is
 * taken and nothing behind it is blocked, so it can wait politely.
 */
export function PromoToastView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  onMinimize,
  onCopy,
  className,
}: ViewProps & { onMinimize?: () => void; className?: string }) {
  const labels = usePromotionLabels()
  const media = promotion.media
  return (
    <div
      className={cn(
        'relative flex gap-3 rounded-2xl bg-popover p-3 text-sm text-popover-foreground shadow-xl ring-1 shadow-black/10 ring-black/5 forced-colors:border dark:ring-white/10',
        className,
      )}
    >
      {promotion.tone !== 'neutral' ? (
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-3 start-0 w-1 rounded-e-full',
            promotion.tone === 'brand'
              ? 'bg-primary'
              : 'bg-[var(--promo-highlight,var(--accent-foreground))]',
          )}
        />
      ) : null}
      {media ? (
        <Media
          media={media}
          eager
          className="size-16 shrink-0 rounded-lg sm:size-20"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1 ps-1">
        <div className="flex min-h-5 items-center gap-2 pe-14">
          {promotion.eyebrow ? (
            <span className="text-muted-foreground truncate text-xs font-medium">
              {promotion.eyebrow}
            </span>
          ) : null}
          <Countdown promotion={promotion} now={now} />
        </div>
        <p className="leading-snug font-medium text-balance">
          {promotion.title}
        </p>
        {promotion.body ? (
          <p className="text-muted-foreground line-clamp-2 leading-relaxed">
            {promotion.body}
          </p>
        ) : null}
        {promotion.code || promotion.cta ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {promotion.code ? (
              <PromoCode code={promotion.code} onCopy={onCopy} />
            ) : null}
            {promotion.cta ? (
              <Button
                size="sm"
                nativeButton={false}
                render={
                  <CtaLink
                    promotion={promotion}
                    Link={Link}
                    onClick={onClick}
                  />
                }
              />
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="absolute end-1.5 top-1.5 flex">
        <IconAction
          onAction={onMinimize}
          label={labels.minimize}
          icon={IconMinus}
        />
        <IconAction
          onAction={onDismiss}
          label={labels.dismissNamed(promotion.title)}
        />
      </div>
    </div>
  )
}

type TextComponent = React.ComponentType<{
  className?: string
  children?: React.ReactNode
}>

function DefaultTitle({ children }: { children?: React.ReactNode }) {
  return <p className="text-lg font-medium">{children}</p>
}

function DefaultDescription({ children }: { children?: React.ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>
}

/**
 * The inside of the dialog or sheet; the surface itself is chosen by
 * PromoDialog, which passes its own Title and Description so the popup is
 * labelled for assistive technology.
 */
export function PromoDialogContentView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  onCopy,
  Title = DefaultTitle,
  Description = DefaultDescription,
}: ViewProps & { Title?: TextComponent; Description?: TextComponent }) {
  const labels = usePromotionLabels()
  const media = promotion.media
  return (
    <div className="flex flex-col gap-4">
      {media ? (
        <Media
          media={media}
          eager
          className="aspect-[16/9] w-full rounded-lg"
        />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <div className="flex min-h-5 items-center gap-2">
          {promotion.eyebrow ? (
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {promotion.eyebrow}
            </span>
          ) : null}
          <span className="text-foreground">
            <Countdown promotion={promotion} now={now} />
          </span>
        </div>
        <Title className="text-lg leading-snug text-balance">
          {promotion.title}
        </Title>
        {promotion.body ? (
          <Description className="text-pretty">{promotion.body}</Description>
        ) : null}
        {promotion.code ? (
          <PromoCode
            code={promotion.code}
            onCopy={onCopy}
            className="mt-2 self-start"
          />
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onDismiss ? (
          <Button type="button" variant="ghost" onClick={onDismiss}>
            {labels.notNow}
          </Button>
        ) : null}
        {promotion.cta ? (
          <Button
            nativeButton={false}
            render={
              <CtaLink
                promotion={promotion}
                Link={Link}
                onClick={onClick}
                className="gap-1"
              />
            }
          />
        ) : null}
      </div>
    </div>
  )
}
