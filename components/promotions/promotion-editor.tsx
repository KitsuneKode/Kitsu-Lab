'use client'

import * as React from 'react'
import {
  IconAppWindow,
  IconLayoutBottombar,
  IconLayoutNavbar,
  IconLayoutSidebarRight,
  IconPictureInPicture,
} from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import {
  BODY_MAX,
  CTA_LABEL_MAX,
  EYEBROW_MAX,
  HIGHLIGHTS_MAX,
  PROMOTION_TONES,
  TERMS_MAX,
  TITLE_MAX,
  describeSchedule,
  isOverlay,
  parsePromotion,
  reviewPromotion,
  targetsRoute,
  type Promotion,
  type PromotionContent,
  type PromotionField,
  type PromotionParseOptions,
  type PromotionPlacement,
  type PromotionTone,
  type PromotionTrigger,
} from './promotion'
import { PromotionPreview } from './promotion-preview'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export type PromotionEditorOption = { value: string; label: string }

export type PromotionEditorProps = {
  /** Existing content to edit. Omit to start a new promotion. */
  initial?: Partial<PromotionContent>
  /** Pages the promotion may target. Omit to allow any path pattern. */
  routes?: readonly PromotionEditorOption[]
  /** Destinations the button may use. Omit to allow any safe link. */
  targets?: readonly PromotionEditorOption[]
  /** Named card slots on the site, e.g. hero or pricing. */
  slots?: readonly PromotionEditorOption[]
  /** Other promotions, so the review can flag overlays that compete. */
  others?: readonly Promotion[]
  /** Default currency for new offers, e.g. 'INR'. */
  currency?: string
  locale?: string
  timeZone?: string
  submitLabel?: string
  onSubmit: (content: PromotionContent) => void | Promise<void>
  onCancel?: () => void
  /** Server-side errors to show against fields, e.g. after a failed save. */
  errors?: Partial<Record<PromotionField, string>>
  className?: string
}

const PLACEMENTS: {
  value: PromotionPlacement
  label: string
  hint: string
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
}[] = [
  {
    value: 'bar',
    label: 'Announcement bar',
    hint: 'A slim line above the header',
    Icon: IconLayoutNavbar,
  },
  {
    value: 'card',
    label: 'Inline card',
    hint: 'In a slot the page reserves',
    Icon: IconAppWindow,
  },
  {
    value: 'corner',
    label: 'Corner card',
    hint: 'Floats bottom corner, never blocks',
    Icon: IconPictureInPicture,
  },
  {
    value: 'sheet',
    label: 'Side panel',
    hint: 'Room for details and an offer',
    Icon: IconLayoutSidebarRight,
  },
  {
    value: 'dialog',
    label: 'Dialog',
    hint: 'Centred and modal, the loudest',
    Icon: IconLayoutBottombar,
  },
]

const TONE_LABELS: Record<PromotionTone, string> = {
  neutral: 'Neutral',
  brand: 'Brand',
  highlight: 'Highlight',
}

const TONE_SWATCH: Record<PromotionTone, string> = {
  neutral: 'bg-card ring-1 ring-foreground/15',
  brand: 'bg-primary',
  highlight:
    'bg-[var(--promo-highlight,var(--accent))] ring-1 ring-foreground/10',
}

const NO_OTHERS: readonly Promotion[] = []

type Draft = {
  placement: PromotionPlacement
  slot: string
  trigger: PromotionTrigger
  eyebrow: string
  title: string
  body: string
  highlights: string
  tone: PromotionTone
  mediaSrc: string
  mediaAlt: string
  hasOffer: boolean
  percentOff: string
  priceAmount: string
  priceWas: string
  currency: string
  code: string
  terms: string
  ctaLabel: string
  ctaHref: string
  include: string[]
  exclude: string[]
  startsAt: string
  endsAt: string
  priority: number
  dismissMode: 'session' | 'days' | 'never-again'
  dismissDays: number
  showCountdown: boolean
}

const pad = (n: number) => String(n).padStart(2, '0')

/** `datetime-local` works in the browser's zone; convert at the edges only. */
function toLocalInput(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

const numberOrUndefined = (value: string) =>
  value.trim() === '' ? undefined : Number(value)

function initialDraft(
  initial: Partial<PromotionContent> = {},
  now: number,
  currency: string,
): Draft {
  const startsAt = initial.startsAt ?? Math.ceil(now / HOUR) * HOUR
  const endsAt = initial.endsAt ?? startsAt + 7 * DAY
  const offer = initial.offer
  return {
    placement: initial.placement ?? 'bar',
    slot: initial.slot ?? 'default',
    trigger: initial.trigger ?? 'engaged',
    eyebrow: initial.eyebrow ?? '',
    title: initial.title ?? '',
    body: initial.body ?? '',
    highlights: (initial.highlights ?? []).join('\n'),
    tone: initial.tone ?? 'neutral',
    mediaSrc: initial.media?.src ?? '',
    mediaAlt: initial.media?.alt ?? '',
    hasOffer: Boolean(offer),
    percentOff: offer?.percentOff?.toString() ?? '',
    priceAmount: offer?.price?.amount.toString() ?? '',
    priceWas: offer?.price?.was?.toString() ?? '',
    currency: offer?.price?.currency ?? currency,
    code: offer?.code ?? '',
    terms: offer?.terms ?? '',
    ctaLabel: initial.cta?.label ?? '',
    ctaHref: initial.cta?.href ?? '',
    include: initial.include ?? [],
    exclude: initial.exclude ?? [],
    startsAt: toLocalInput(startsAt),
    endsAt: toLocalInput(endsAt),
    priority: initial.priority ?? 50,
    dismissMode: initial.dismiss?.mode ?? 'days',
    dismissDays: initial.dismiss?.mode === 'days' ? initial.dismiss.days : 7,
    showCountdown: initial.showCountdown ?? false,
  }
}

function toInput(draft: Draft, mediaSize?: { width: number; height: number }) {
  const hasCta = draft.ctaLabel.trim() !== '' || draft.ctaHref.trim() !== ''
  const priceAmount = numberOrUndefined(draft.priceAmount)
  return {
    placement: draft.placement,
    slot: draft.placement === 'card' ? draft.slot : undefined,
    trigger: isOverlay(draft.placement) ? draft.trigger : undefined,
    eyebrow: draft.eyebrow,
    title: draft.title,
    body: draft.body,
    highlights: draft.highlights
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
    tone: draft.tone,
    media: draft.mediaSrc.trim()
      ? {
          src: draft.mediaSrc.trim(),
          alt: draft.mediaAlt,
          width: mediaSize?.width ?? 1200,
          height: mediaSize?.height ?? 675,
        }
      : undefined,
    offer: draft.hasOffer
      ? {
          percentOff: numberOrUndefined(draft.percentOff),
          price:
            priceAmount !== undefined
              ? {
                  amount: priceAmount,
                  was: numberOrUndefined(draft.priceWas),
                  currency: draft.currency,
                }
              : undefined,
          code: draft.code,
          terms: draft.terms,
        }
      : undefined,
    cta: hasCta ? { label: draft.ctaLabel, href: draft.ctaHref } : undefined,
    include: draft.include,
    exclude: draft.exclude,
    startsAt: fromLocalInput(draft.startsAt),
    endsAt: fromLocalInput(draft.endsAt),
    priority: draft.priority,
    dismiss:
      draft.dismissMode === 'days'
        ? { mode: 'days', days: draft.dismissDays }
        : { mode: draft.dismissMode },
    showCountdown: draft.showCountdown,
  }
}

/* -------------------------------------------------------------------------- */
/*  Small form pieces                                                         */
/* -------------------------------------------------------------------------- */

function Field({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string
  label: string
  hint?: React.ReactNode
  error?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      data-invalid={error ? true : undefined}
    >
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

function Section({
  title,
  description,
  children,
  aside,
}: {
  title: string
  description?: string
  children: React.ReactNode
  aside?: React.ReactNode
}) {
  return (
    <fieldset className="border-border grid gap-5 border-t pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="grid gap-1">
          <legend className="text-sm font-semibold">{title}</legend>
          {description ? (
            <p className="text-muted-foreground text-sm">{description}</p>
          ) : null}
        </div>
        {aside}
      </div>
      {children}
    </fieldset>
  )
}

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={cn('tabular-nums', value.length > max && 'text-destructive')}
    >
      {value.length}/{max}
    </span>
  )
}

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: React.ReactNode }[]
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="bg-muted inline-flex flex-wrap gap-1 rounded-lg p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
            value === option.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

const selectClass =
  'h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30'

function RoutePicker({
  id,
  options,
  value,
  onChange,
  invalid,
}: {
  id: string
  options?: readonly PromotionEditorOption[]
  value: string[]
  onChange: (next: string[]) => void
  invalid?: boolean
}) {
  if (!options) {
    return (
      <Input
        id={id}
        value={value.join(', ')}
        aria-invalid={invalid || undefined}
        placeholder="/, /courses/*"
        onChange={(event) =>
          onChange(
            event.target.value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
      />
    )
  }
  return (
    <div id={id} role="group" className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const checked = value.includes(option.value)
        return (
          <label
            key={option.value}
            className={cn(
              'inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors select-none has-focus-visible:ring-3 has-focus-visible:ring-ring/50',
              checked
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input hover:bg-muted',
            )}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={checked}
              onChange={() =>
                onChange(
                  checked
                    ? value.filter((v) => v !== option.value)
                    : [...value, option.value],
                )
              }
            />
            {option.label}
          </label>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Editor                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Create or edit a promotion, seeing it where it will appear.
 *
 * The form is grouped the way a campaign is planned: where it goes, what it
 * says, what it offers, where the button leads, who sees it and when. The
 * preview beside it places the draft on a mock page, on a desktop or a phone,
 * at any page and time, and says whether it would show there and why not.
 *
 * Owns no data: validation runs here for instant feedback, and the host saves
 * through `onSubmit` and re-validates on the server with `parsePromotion`.
 */
export function PromotionEditor({
  initial,
  routes,
  targets,
  slots,
  others = NO_OTHERS,
  currency = 'USD',
  locale,
  timeZone,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
  errors: serverErrors,
  className,
}: PromotionEditorProps) {
  const uid = React.useId()
  const id = (name: string) => `${uid}-${name}`
  const [mountedAt] = React.useState(() => Date.now())
  const [draft, setDraft] = React.useState<Draft>(() =>
    initialDraft(initial, mountedAt, currency),
  )
  const [touched, setTouched] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  // Open the preview on a page the promotion actually targets, so a draft
  // for "/courses/*" is not first shown as "not on this page".
  const [previewRoute, setPreviewRoute] = React.useState(() => {
    const candidates = (routes ?? [])
      .map((r) => r.value)
      .filter((value) => !value.includes('*'))
    const include = initial?.include ?? []
    const exclude = initial?.exclude ?? []
    return (
      candidates.find((path) => targetsRoute({ include, exclude }, path)) ??
      include[0]?.replace(/\/\*+$/, '') ??
      '/'
    )
  })
  const [previewAt, setPreviewAt] = React.useState<number | null>(null)
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }))

  const parseOptions = React.useMemo<PromotionParseOptions>(
    () => ({
      ...(targets
        ? { isAllowedHref: (href) => targets.some((t) => t.value === href) }
        : {}),
      ...(routes
        ? { isAllowedRoute: (route) => routes.some((r) => r.value === route) }
        : {}),
    }),
    [routes, targets],
  )
  // An existing image keeps its intrinsic size; new ones assume 16:9.
  const [mediaSize] = React.useState(() =>
    initial?.media
      ? { width: initial.media.width, height: initial.media.height }
      : undefined,
  )
  const result = React.useMemo(
    () => parsePromotion(toInput(draft, mediaSize), parseOptions),
    [draft, mediaSize, parseOptions],
  )
  const errors = {
    ...(touched && !result.ok ? result.errors : {}),
    ...serverErrors,
  }

  // The preview renders even while invalid, from whatever is usable so far.
  const startsAt = fromLocalInput(draft.startsAt) ?? mountedAt
  const endsAt = Math.max(
    fromLocalInput(draft.endsAt) ?? startsAt + DAY,
    startsAt + HOUR,
  )
  const preview: PromotionContent = result.ok
    ? result.value
    : {
        placement: draft.placement,
        title: draft.title.trim() || 'Your headline goes here',
        body: draft.body.trim() || undefined,
        eyebrow: draft.eyebrow.trim() || undefined,
        highlights: draft.highlights
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .slice(0, HIGHLIGHTS_MAX),
        tone: draft.tone,
        cta:
          draft.ctaLabel.trim() && draft.ctaHref.trim()
            ? { label: draft.ctaLabel.trim(), href: draft.ctaHref.trim() }
            : undefined,
        include: draft.include,
        exclude: draft.exclude,
        startsAt,
        endsAt,
        priority: draft.priority,
        dismiss: { mode: 'session' },
        showCountdown: draft.showCountdown,
      }

  const scrubMin = startsAt - DAY
  const scrubMax = endsAt + DAY
  const previewNow = Math.min(
    scrubMax,
    Math.max(scrubMin, previewAt ?? Math.max(mountedAt, startsAt)),
  )
  const warnings = result.ok
    ? reviewPromotion(result.value, others, mountedAt)
    : []
  const overlay = isOverlay(draft.placement)
  const errorCount =
    touched && !result.ok ? Object.keys(result.errors).length : 0

  const clock = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  })

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (!result.ok) {
      const first = Object.keys(result.errors)[0] ?? 'title'
      document.getElementById(id(first.replace('.', '-')))?.focus()
      return
    }
    setSaving(true)
    try {
      await onSubmit(result.value)
    } finally {
      setSaving(false)
    }
  }

  const invalid = (name: PromotionField) => Boolean(errors[name]) || undefined

  return (
    <form
      noValidate
      onSubmit={submit}
      className={cn(
        'grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]',
        className,
      )}
    >
      <div className="grid gap-8">
        <Section
          title="Placement"
          description="Where it appears and how much it asks of the visitor."
        >
          <div
            role="radiogroup"
            aria-label="Placement"
            className="grid gap-2 sm:grid-cols-2"
          >
            {PLACEMENTS.map(({ value, label, hint, Icon }) => {
              const checked = draft.placement === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => set('placement', value)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    checked
                      ? 'border-primary bg-primary/[0.04] ring-1 ring-primary'
                      : 'border-border hover:bg-muted/60',
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      'mt-0.5 size-5 shrink-0',
                      checked ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-muted-foreground text-xs">
                      {hint}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {draft.placement === 'card' && slots && slots.length > 0 ? (
            <Field id={id('slot')} label="Slot" error={errors.slot}>
              <select
                id={id('slot')}
                value={draft.slot}
                onChange={(e) => set('slot', e.target.value)}
                className={selectClass}
              >
                {slots.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {overlay ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium">Opens</span>
              <Segmented
                label="When it opens"
                value={draft.trigger}
                onChange={(value) => set('trigger', value)}
                options={[
                  { value: 'engaged', label: 'After they engage' },
                  { value: 'exit-intent', label: 'When they go to leave' },
                ]}
              />
              <p className="text-muted-foreground text-xs">
                {draft.trigger === 'exit-intent'
                  ? 'On desktop, when the pointer heads for the tabs. Phones fall back to engagement.'
                  : 'After a few seconds on the page and some scrolling, never on arrival.'}
              </p>
            </div>
          ) : null}
        </Section>

        <Section title="Message" description="Short, specific and true.">
          <Field
            id={id('title')}
            label="Headline"
            error={errors.title}
            hint={<Counter value={draft.title} max={TITLE_MAX} />}
          >
            <Input
              id={id('title')}
              value={draft.title}
              required
              aria-invalid={invalid('title')}
              onChange={(e) => set('title', e.target.value)}
            />
          </Field>
          <Field
            id={id('body')}
            label="Supporting line (optional)"
            error={errors.body}
            hint={<Counter value={draft.body} max={BODY_MAX} />}
          >
            <Textarea
              id={id('body')}
              value={draft.body}
              rows={2}
              aria-invalid={invalid('body')}
              onChange={(e) => set('body', e.target.value)}
            />
          </Field>
          <Field
            id={id('eyebrow')}
            label="Label (optional)"
            error={errors.eyebrow}
            hint={`A word or two, e.g. “New batch”. ${EYEBROW_MAX} max.`}
          >
            <Input
              id={id('eyebrow')}
              value={draft.eyebrow}
              aria-invalid={invalid('eyebrow')}
              onChange={(e) => set('eyebrow', e.target.value)}
            />
          </Field>
          <div className="grid gap-2">
            <span className="text-sm font-medium">Tone</span>
            <Segmented
              label="Tone"
              value={draft.tone}
              onChange={(value) => set('tone', value)}
              options={PROMOTION_TONES.map((tone) => ({
                value: tone,
                label: (
                  <>
                    <span
                      aria-hidden
                      className={cn('size-3 rounded-full', TONE_SWATCH[tone])}
                    />
                    {TONE_LABELS[tone]}
                  </>
                ),
              }))}
            />
          </div>
          {draft.placement !== 'bar' ? (
            <Field
              id={id('highlights')}
              label="Key points (optional)"
              error={errors.highlights}
              hint={`One per line, up to ${HIGHLIGHTS_MAX}.`}
            >
              <Textarea
                id={id('highlights')}
                value={draft.highlights}
                rows={3}
                aria-invalid={invalid('highlights')}
                onChange={(e) => set('highlights', e.target.value)}
              />
            </Field>
          ) : null}
          {draft.placement !== 'bar' ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id={id('media')}
                label="Image URL (optional)"
                error={errors.media}
              >
                <Input
                  id={id('media')}
                  value={draft.mediaSrc}
                  placeholder="/images/launch.webp"
                  aria-invalid={invalid('media')}
                  onChange={(e) => set('mediaSrc', e.target.value)}
                />
              </Field>
              <Field id={id('media-alt')} label="Image description">
                <Input
                  id={id('media-alt')}
                  value={draft.mediaAlt}
                  disabled={!draft.mediaSrc.trim()}
                  onChange={(e) => set('mediaAlt', e.target.value)}
                />
              </Field>
            </div>
          ) : null}
        </Section>

        <Section
          title="Offer"
          description="Structured, so every placement shows it the same way."
          aside={
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="accent-primary size-4"
                checked={draft.hasOffer}
                onChange={(e) => set('hasOffer', e.target.checked)}
              />
              Has an offer
            </label>
          }
        >
          {draft.hasOffer ? (
            <>
              {errors.offer ? (
                <p className="text-destructive text-xs">{errors.offer}</p>
              ) : null}
              <div className="grid gap-5 sm:grid-cols-4">
                <Field
                  id={id('offer-percentOff')}
                  label="% off"
                  error={errors['offer.percentOff']}
                >
                  <Input
                    id={id('offer-percentOff')}
                    inputMode="numeric"
                    value={draft.percentOff}
                    aria-invalid={invalid('offer.percentOff')}
                    onChange={(e) => set('percentOff', e.target.value)}
                  />
                </Field>
                <Field
                  id={id('offer-price')}
                  label="Price now"
                  error={errors['offer.price']}
                >
                  <Input
                    id={id('offer-price')}
                    inputMode="decimal"
                    value={draft.priceAmount}
                    aria-invalid={invalid('offer.price')}
                    onChange={(e) => set('priceAmount', e.target.value)}
                  />
                </Field>
                <Field id={id('offer-was')} label="Was">
                  <Input
                    id={id('offer-was')}
                    inputMode="decimal"
                    value={draft.priceWas}
                    onChange={(e) => set('priceWas', e.target.value)}
                  />
                </Field>
                <Field id={id('offer-currency')} label="Currency">
                  <Input
                    id={id('offer-currency')}
                    value={draft.currency}
                    maxLength={3}
                    onChange={(e) =>
                      set('currency', e.target.value.toUpperCase())
                    }
                  />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  id={id('offer-code')}
                  label="Code (optional)"
                  error={errors['offer.code']}
                  hint="Visitors copy it in one tap."
                >
                  <Input
                    id={id('offer-code')}
                    value={draft.code}
                    className="font-mono uppercase"
                    aria-invalid={invalid('offer.code')}
                    onChange={(e) => set('code', e.target.value.toUpperCase())}
                  />
                </Field>
                <Field
                  id={id('offer-terms')}
                  label="Terms"
                  error={errors['offer.terms']}
                  hint={<Counter value={draft.terms} max={TERMS_MAX} />}
                >
                  <Input
                    id={id('offer-terms')}
                    value={draft.terms}
                    placeholder="New enrolments only, until 30 Sep."
                    aria-invalid={invalid('offer.terms')}
                    onChange={(e) => set('terms', e.target.value)}
                  />
                </Field>
              </div>
            </>
          ) : null}
        </Section>

        <Section title="Button">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id={id('cta-label')}
              label="Button text"
              error={errors['cta.label']}
              hint={`${CTA_LABEL_MAX} characters max.`}
            >
              <Input
                id={id('cta-label')}
                value={draft.ctaLabel}
                aria-invalid={invalid('cta.label')}
                onChange={(e) => set('ctaLabel', e.target.value)}
              />
            </Field>
            <Field
              id={id('cta-href')}
              label="Goes to"
              error={errors['cta.href']}
            >
              {targets ? (
                <select
                  id={id('cta-href')}
                  value={draft.ctaHref}
                  aria-invalid={invalid('cta.href')}
                  onChange={(e) => set('ctaHref', e.target.value)}
                  className={selectClass}
                >
                  <option value="">No button</option>
                  {targets.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  id={id('cta-href')}
                  value={draft.ctaHref}
                  placeholder="/courses or https://…"
                  aria-invalid={invalid('cta.href')}
                  onChange={(e) => set('ctaHref', e.target.value)}
                />
              )}
            </Field>
          </div>
        </Section>

        <Section
          title="Audience"
          description="Nothing selected means every page."
        >
          <Field id={id('include')} label="Show on" error={errors.include}>
            <RoutePicker
              id={id('include')}
              options={routes}
              value={draft.include}
              invalid={Boolean(errors.include)}
              onChange={(next) => set('include', next)}
            />
          </Field>
          <Field id={id('exclude')} label="Never on" error={errors.exclude}>
            <RoutePicker
              id={id('exclude')}
              options={routes}
              value={draft.exclude}
              invalid={Boolean(errors.exclude)}
              onChange={(next) => set('exclude', next)}
            />
          </Field>
        </Section>

        <Section title="Schedule">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={id('startsAt')} label="Starts" error={errors.startsAt}>
              <Input
                id={id('startsAt')}
                type="datetime-local"
                value={draft.startsAt}
                aria-invalid={invalid('startsAt')}
                onChange={(e) => set('startsAt', e.target.value)}
              />
            </Field>
            <Field id={id('endsAt')} label="Ends" error={errors.endsAt}>
              <Input
                id={id('endsAt')}
                type="datetime-local"
                value={draft.endsAt}
                aria-invalid={invalid('endsAt')}
                onChange={(e) => set('endsAt', e.target.value)}
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={draft.showCountdown}
              onChange={(e) => set('showCountdown', e.target.checked)}
            />
            Show “Ends in …” during the last 14 days
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              id={id('priority')}
              label={`Priority · ${draft.priority}`}
              error={errors.priority}
              hint="Higher wins when promotions compete for the same place."
            >
              <Slider
                id={id('priority')}
                className="w-full"
                min={0}
                max={100}
                step={5}
                value={[draft.priority]}
                onValueChange={(value) =>
                  set(
                    'priority',
                    Array.isArray(value) ? (value[0] ?? 50) : value,
                  )
                }
              />
            </Field>
            <Field
              id={id('dismiss')}
              label="After it is dismissed"
              error={errors.dismiss}
            >
              <div className="flex items-center gap-2">
                <select
                  id={id('dismiss')}
                  value={draft.dismissMode}
                  onChange={(e) =>
                    set('dismissMode', e.target.value as Draft['dismissMode'])
                  }
                  className={selectClass}
                >
                  <option value="session">Hide for this visit</option>
                  <option value="days">Hide for some days</option>
                  <option value="never-again">Never show again</option>
                </select>
                {draft.dismissMode === 'days' ? (
                  <Input
                    aria-label="Days"
                    type="number"
                    min={1}
                    max={365}
                    className="w-20"
                    value={draft.dismissDays}
                    onChange={(e) => set('dismissDays', Number(e.target.value))}
                  />
                ) : null}
              </div>
            </Field>
          </div>
        </Section>

        <div className="border-border flex flex-wrap items-center gap-3 border-t pt-6">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {errorCount > 0 ? (
            <p role="alert" className="text-destructive text-sm">
              {errorCount === 1
                ? 'One field needs attention.'
                : `${errorCount} fields need attention.`}
            </p>
          ) : null}
        </div>
      </div>

      <section aria-label="Preview" className="grid gap-4 lg:sticky lg:top-6">
        <PromotionPreview
          promotion={preview}
          now={previewNow}
          pathname={previewRoute}
          locale={locale}
          timeZone={timeZone}
        />

        <div className="bg-muted/50 grid gap-3 rounded-xl p-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label
              htmlFor={id('preview-route')}
              className="text-muted-foreground text-xs"
            >
              Preview page
            </Label>
            {routes ? (
              <select
                id={id('preview-route')}
                value={previewRoute}
                onChange={(e) => setPreviewRoute(e.target.value)}
                className={selectClass}
              >
                {routes
                  .filter((r) => !r.value.includes('*'))
                  .map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label} ({r.value})
                    </option>
                  ))}
              </select>
            ) : (
              <Input
                id={id('preview-route')}
                value={previewRoute}
                onChange={(e) => setPreviewRoute(e.target.value || '/')}
              />
            )}
          </div>
          <div className="grid gap-1.5">
            <span
              className="text-muted-foreground text-xs font-medium"
              id={id('preview-at')}
            >
              Preview time · {clock.format(previewNow)}
            </span>
            <Slider
              aria-labelledby={id('preview-at')}
              min={scrubMin}
              max={scrubMax}
              step={HOUR}
              value={[previewNow]}
              onValueChange={(value) =>
                setPreviewAt(Array.isArray(value) ? (value[0] ?? null) : value)
              }
              className="mt-2 w-full"
            />
          </div>
          <p className="text-muted-foreground text-xs sm:col-span-2">
            <span className="text-foreground font-medium">Runs </span>
            {describeSchedule(startsAt, endsAt, { timeZone, locale })}
            {timeZone ? ` · ${timeZone}` : ''}.{' '}
            <span className="text-foreground font-medium">Shows on </span>
            {draft.include.length ? draft.include.join(', ') : 'every page'}
            {draft.exclude.length
              ? `, never on ${draft.exclude.join(', ')}`
              : ''}
            .
          </p>
        </div>

        {warnings.length > 0 ? (
          <ul className="grid gap-2 text-sm" aria-label="Review notes">
            {warnings.map((warning) => (
              <li
                key={warning.code}
                className="text-foreground rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2"
              >
                {warning.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </form>
  )
}
