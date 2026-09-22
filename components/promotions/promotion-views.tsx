'use client'

import * as React from 'react'
import { IconArrowRight, IconArrowUpRight, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import {
  countdownVisible,
  formatTimeLeft,
  type Promotion,
  type PromotionContent,
  type PromotionTone,
} from './promotion'
import type { PromotionLinkProps } from './promotion-provider'

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

export type PreviewablePromotion = PromotionContent &
  Partial<Pick<Promotion, 'id' | 'campaign'>>

type ViewProps = {
  promotion: PreviewablePromotion
  now: number | null
  Link?: React.ComponentType<PromotionLinkProps>
  onClick?: () => void
  onDismiss?: () => void
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

function Countdown({
  promotion,
  now,
}: {
  promotion: PreviewablePromotion
  now: number | null
}) {
  if (now === null || !countdownVisible(promotion, now)) return null
  const label = formatTimeLeft(promotion.endsAt, now)
  if (!label) return null
  return (
    <span className="bg-background/15 rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums ring-1 ring-current/15">
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
        className="size-4 transition-transform duration-200 group-hover/cta:translate-x-0.5 motion-reduce:transition-none"
      />
      {cta.external ? (
        <span className="sr-only"> (opens in a new tab)</span>
      ) : null}
    </Link>
  )
}

function DismissButton({
  onDismiss,
  label,
}: {
  onDismiss?: () => void
  label: string
}) {
  if (!onDismiss) return null
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      onClick={onDismiss}
      aria-label={label}
      className="shrink-0 text-current hover:bg-current/10 hover:text-current"
    >
      <IconX aria-hidden />
    </Button>
  )
}

/* -------------------------------------------------------------------------- */

export function PromoBarView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
}: ViewProps) {
  return (
    <div
      role="region"
      aria-label={promotion.eyebrow ?? 'Announcement'}
      className={cn('w-full text-sm', promotionToneClasses[promotion.tone])}
    >
      <div className="mx-auto flex max-w-screen-xl items-center gap-3 px-4 py-2 sm:px-6">
        <p className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
          {promotion.eyebrow ? (
            <span className="font-medium opacity-80">{promotion.eyebrow}</span>
          ) : null}
          <span className="font-medium">{promotion.title}</span>
          {promotion.body ? (
            <span className="hidden opacity-80 md:inline">
              {promotion.body}
            </span>
          ) : null}
          <Countdown promotion={promotion} now={now} />
          <CtaLink
            promotion={promotion}
            Link={Link}
            onClick={onClick}
            className="underline decoration-current/40 underline-offset-4 hover:decoration-current"
          />
        </p>
        <DismissButton onDismiss={onDismiss} label="Dismiss announcement" />
      </div>
    </div>
  )
}

export function PromoCardView({
  promotion,
  now,
  Link,
  onClick,
  onDismiss,
  className,
}: ViewProps & { className?: string }) {
  const media = promotion.media
  return (
    <aside
      aria-label={promotion.eyebrow ?? promotion.title}
      className={cn(
        'relative flex overflow-hidden rounded-xl border border-border/60 text-sm',
        media ? 'flex-col sm:flex-row' : 'flex-col',
        promotionToneClasses[promotion.tone],
        className,
      )}
    >
      {media ? (
        // Plain img: the registry must not assume a framework image loader.
        // oxlint-disable-next-line nextjs/no-img-element
        <img
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          loading="lazy"
          decoding="async"
          className="aspect-[16/9] w-full object-cover sm:aspect-auto sm:w-2/5"
        />
      ) : null}
      <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
        <div className="flex items-center gap-2">
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
          <p className="leading-relaxed opacity-80">{promotion.body}</p>
        ) : null}
        <CtaLink
          promotion={promotion}
          Link={Link}
          onClick={onClick}
          className="mt-1 self-start underline decoration-current/30 underline-offset-4 hover:decoration-current"
        />
      </div>
      {onDismiss ? (
        <div className="absolute top-2 right-2">
          <DismissButton
            onDismiss={onDismiss}
            label={`Dismiss ${promotion.title}`}
          />
        </div>
      ) : null}
    </aside>
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
  Title = DefaultTitle,
  Description = DefaultDescription,
}: ViewProps & { Title?: TextComponent; Description?: TextComponent }) {
  const media = promotion.media
  return (
    <div className="flex flex-col gap-4">
      {media ? (
        // oxlint-disable-next-line nextjs/no-img-element
        <img
          src={media.src}
          alt={media.alt}
          width={media.width}
          height={media.height}
          decoding="async"
          className="aspect-[16/9] w-full rounded-lg object-cover"
        />
      ) : null}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          {promotion.eyebrow ? (
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {promotion.eyebrow}
            </span>
          ) : null}
          <span className="text-foreground">
            <Countdown promotion={promotion} now={now} />
          </span>
        </div>
        <Title className="text-lg">{promotion.title}</Title>
        {promotion.body ? <Description>{promotion.body}</Description> : null}
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {onDismiss ? (
          <Button type="button" variant="ghost" onClick={onDismiss}>
            Not now
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
