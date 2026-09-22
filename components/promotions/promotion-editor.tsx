'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  BODY_MAX,
  CTA_LABEL_MAX,
  EYEBROW_MAX,
  PROMOTION_PLACEMENTS,
  PROMOTION_TONES,
  TITLE_MAX,
  deliveryState,
  describeSchedule,
  parsePromotion,
  reviewPromotion,
  targetsRoute,
  type Promotion,
  type PromotionContent,
  type PromotionField,
  type PromotionParseOptions,
  type PromotionPlacement,
  type PromotionTone,
} from './promotion'
import {
  PromoBarView,
  PromoCardView,
  PromoDialogContentView,
} from './promotion-views'

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
  /** Other promotions, so the review can flag overlapping dialogs. */
  others?: readonly Promotion[]
  timeZone?: string
  submitLabel?: string
  onSubmit: (content: PromotionContent) => void | Promise<void>
  onCancel?: () => void
  /** Server-side errors to show against fields, e.g. after a failed save. */
  errors?: Partial<Record<PromotionField, string>>
  className?: string
}

type Draft = {
  placement: PromotionPlacement
  slot: string
  eyebrow: string
  title: string
  body: string
  tone: PromotionTone
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

const PLACEMENT_LABELS: Record<PromotionPlacement, string> = {
  bar: 'Announcement bar',
  card: 'Inline card',
  dialog: 'Dialog',
}

const TONE_LABELS: Record<PromotionTone, string> = {
  neutral: 'Neutral',
  brand: 'Brand',
  highlight: 'Highlight',
}

const NO_OTHERS: readonly Promotion[] = []

const STATE_LABELS = {
  scheduled: 'Scheduled',
  live: 'Live',
  ended: 'Ended',
} as const

/** `datetime-local` works in the browser's zone; convert at the edges only. */
const pad = (n: number) => String(n).padStart(2, '0')

function toLocalInput(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): number | undefined {
  if (!value) return undefined
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : undefined
}

function initialDraft(
  initial: Partial<PromotionContent> = {},
  now: number,
): Draft {
  const startsAt = initial.startsAt ?? Math.ceil(now / HOUR) * HOUR
  const endsAt = initial.endsAt ?? startsAt + 7 * DAY
  return {
    placement: initial.placement ?? 'bar',
    slot: initial.slot ?? 'default',
    eyebrow: initial.eyebrow ?? '',
    title: initial.title ?? '',
    body: initial.body ?? '',
    tone: initial.tone ?? 'neutral',
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

function toInput(draft: Draft) {
  const hasCta = draft.ctaLabel.trim() !== '' || draft.ctaHref.trim() !== ''
  return {
    placement: draft.placement,
    slot: draft.placement === 'card' ? draft.slot : undefined,
    eyebrow: draft.eyebrow,
    title: draft.title,
    body: draft.body,
    tone: draft.tone,
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

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: React.ReactNode
  error?: string
  children: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col gap-2"
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

function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={cn('tabular-nums', value.length > max && 'text-destructive')}
    >
      {value.length}/{max}
    </span>
  )
}

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

/**
 * Create or edit a promotion with a live preview.
 *
 * Owns no data: validation runs here for instant feedback, and the host saves
 * through `onSubmit` and re-validates on the server with the same
 * `parsePromotion` rules.
 */
export function PromotionEditor({
  initial,
  routes,
  targets,
  slots,
  others = NO_OTHERS,
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
    initialDraft(initial, mountedAt),
  )
  const [touched, setTouched] = React.useState(false)
  const [saving, setSaving] = React.useState(false)
  const [previewRoute, setPreviewRoute] = React.useState(
    initial?.include?.[0]?.replace(/\/\*+$/, '') || '/',
  )
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
  const result = React.useMemo(
    () => parsePromotion(toInput(draft), parseOptions),
    [draft, parseOptions],
  )
  const errors = {
    ...(touched && !result.ok ? result.errors : {}),
    ...serverErrors,
  }

  // The preview renders even while invalid, from whatever is typable so far.
  const startsAt = fromLocalInput(draft.startsAt) ?? mountedAt
  const endsAt = Math.max(
    fromLocalInput(draft.endsAt) ?? startsAt + DAY,
    startsAt + HOUR,
  )
  const preview: PromotionContent = result.ok
    ? result.value
    : {
        placement: draft.placement,
        title: draft.title.trim() || 'Your title',
        body: draft.body.trim() || undefined,
        eyebrow: draft.eyebrow.trim() || undefined,
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

  // Preview clock: scrub from a day before the start to a day after the end.
  const scrubMin = startsAt - DAY
  const scrubMax = endsAt + DAY
  const [previewAt, setPreviewAt] = React.useState<number | null>(null)
  const previewNow = Math.min(
    scrubMax,
    Math.max(scrubMin, previewAt ?? Math.max(mountedAt, startsAt)),
  )
  const state = deliveryState(
    { state: 'published', startsAt, endsAt },
    previewNow,
  )
  const onRoute = targetsRoute(preview, previewRoute)
  const warnings = result.ok
    ? reviewPromotion(result.value, others, mountedAt)
    : []

  const clock = new Intl.DateTimeFormat(undefined, {
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
      const first = Object.keys(result.errors)[0]
      document
        .getElementById(
          id(
            first === 'cta.label'
              ? 'cta-label'
              : first === 'cta.href'
                ? 'cta-href'
                : (first ?? 'title'),
          ),
        )
        ?.focus()
      return
    }
    setSaving(true)
    try {
      await onSubmit(result.value)
    } finally {
      setSaving(false)
    }
  }

  const describedBy = (name: string) =>
    errors[name as PromotionField] ? `${id(name)}-error` : undefined

  return (
    <form
      noValidate
      onSubmit={submit}
      className={cn(
        'grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]',
        className,
      )}
    >
      <div className="flex flex-col gap-6">
        <Field id={id('placement')} label="Placement" error={errors.placement}>
          <ToggleGroup
            id={id('placement')}
            value={[draft.placement]}
            onValueChange={(value) => {
              if (value[0]) set('placement', value[0] as PromotionPlacement)
            }}
            variant="outline"
            size="sm"
            className="flex-wrap"
          >
            {PROMOTION_PLACEMENTS.map((p) => (
              <ToggleGroupItem key={p} value={p}>
                {PLACEMENT_LABELS[p]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        {draft.placement === 'card' && slots && slots.length > 0 ? (
          <Field id={id('slot')} label="Slot" error={errors.slot}>
            <ToggleGroup
              id={id('slot')}
              value={[draft.slot]}
              onValueChange={(value) => {
                if (value[0]) set('slot', value[0])
              }}
              variant="outline"
              size="sm"
              className="flex-wrap"
            >
              {slots.map((s) => (
                <ToggleGroupItem key={s.value} value={s.value}>
                  {s.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        ) : null}

        <Field
          id={id('title')}
          label="Title"
          error={errors.title}
          hint={<Counter value={draft.title} max={TITLE_MAX} />}
        >
          <Input
            id={id('title')}
            value={draft.title}
            required
            aria-invalid={Boolean(errors.title) || undefined}
            aria-describedby={describedBy('title')}
            onChange={(e) => set('title', e.target.value)}
          />
        </Field>

        <Field
          id={id('body')}
          label="Message (optional)"
          error={errors.body}
          hint={<Counter value={draft.body} max={BODY_MAX} />}
        >
          <Textarea
            id={id('body')}
            value={draft.body}
            rows={3}
            aria-invalid={Boolean(errors.body) || undefined}
            aria-describedby={describedBy('body')}
            onChange={(e) => set('body', e.target.value)}
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id={id('eyebrow')}
            label="Label (optional)"
            error={errors.eyebrow}
            hint={`Short, e.g. “New batch”. ${EYEBROW_MAX} max.`}
          >
            <Input
              id={id('eyebrow')}
              value={draft.eyebrow}
              aria-invalid={Boolean(errors.eyebrow) || undefined}
              onChange={(e) => set('eyebrow', e.target.value)}
            />
          </Field>
          <Field id={id('tone')} label="Tone">
            <ToggleGroup
              id={id('tone')}
              value={[draft.tone]}
              onValueChange={(value) => {
                if (value[0]) set('tone', value[0] as PromotionTone)
              }}
              variant="outline"
              size="sm"
            >
              {PROMOTION_TONES.map((t) => (
                <ToggleGroupItem key={t} value={t}>
                  {TONE_LABELS[t]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        </div>

        <fieldset className="grid gap-6 sm:grid-cols-2">
          <legend className="sr-only">Button</legend>
          <Field
            id={id('cta-label')}
            label="Button text (optional)"
            error={errors['cta.label']}
            hint={`${CTA_LABEL_MAX} characters max.`}
          >
            <Input
              id={id('cta-label')}
              value={draft.ctaLabel}
              aria-invalid={Boolean(errors['cta.label']) || undefined}
              onChange={(e) => set('ctaLabel', e.target.value)}
            />
          </Field>
          <Field
            id={id('cta-href')}
            label="Button goes to"
            error={errors['cta.href']}
          >
            {targets ? (
              <select
                id={id('cta-href')}
                value={draft.ctaHref}
                aria-invalid={Boolean(errors['cta.href']) || undefined}
                onChange={(e) => set('ctaHref', e.target.value)}
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:border-destructive dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
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
                aria-invalid={Boolean(errors['cta.href']) || undefined}
                onChange={(e) => set('ctaHref', e.target.value)}
              />
            )}
          </Field>
        </fieldset>

        <Field
          id={id('include')}
          label="Show on"
          error={errors.include}
          hint="Nothing selected means every page."
        >
          <RoutePicker
            id={id('include')}
            options={routes}
            value={draft.include}
            invalid={Boolean(errors.include)}
            onChange={(next) => set('include', next)}
          />
        </Field>

        <Field id={id('exclude')} label="Never show on" error={errors.exclude}>
          <RoutePicker
            id={id('exclude')}
            options={routes}
            value={draft.exclude}
            invalid={Boolean(errors.exclude)}
            onChange={(next) => set('exclude', next)}
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field id={id('startsAt')} label="Starts" error={errors.startsAt}>
            <Input
              id={id('startsAt')}
              type="datetime-local"
              value={draft.startsAt}
              aria-invalid={Boolean(errors.startsAt) || undefined}
              onChange={(e) => set('startsAt', e.target.value)}
            />
          </Field>
          <Field id={id('endsAt')} label="Ends" error={errors.endsAt}>
            <Input
              id={id('endsAt')}
              type="datetime-local"
              value={draft.endsAt}
              aria-invalid={Boolean(errors.endsAt) || undefined}
              onChange={(e) => set('endsAt', e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            id={id('priority')}
            label={`Priority · ${draft.priority}`}
            error={errors.priority}
            hint="Higher wins when two promotions compete for the same place."
          >
            <Slider
              id={id('priority')}
              className="w-full"
              min={0}
              max={100}
              step={5}
              value={[draft.priority]}
              onValueChange={(value) =>
                set('priority', Array.isArray(value) ? (value[0] ?? 50) : value)
              }
            />
          </Field>
          <Field
            id={id('dismiss')}
            label="After dismissing"
            error={errors.dismiss}
          >
            <div className="flex items-center gap-2">
              <select
                id={id('dismiss')}
                value={draft.dismissMode}
                onChange={(e) =>
                  set('dismissMode', e.target.value as Draft['dismissMode'])
                }
                className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 flex-1 rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
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

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="accent-primary size-4"
            checked={draft.showCountdown}
            onChange={(e) => set('showCountdown', e.target.checked)}
          />
          Show “Ends in …” during the last 14 days
        </label>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : submitLabel}
          </Button>
          {onCancel ? (
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>

      <section
        aria-label="Preview"
        className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start"
      >
        <div className="border-border/60 flex flex-col gap-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-medium">Preview</span>
            <Badge variant={state === 'live' ? 'default' : 'secondary'}>
              {STATE_LABELS[state as keyof typeof STATE_LABELS] ?? state}
              {!onRoute ? ' · not on this page' : ''}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label
                htmlFor={id('preview-route')}
                className="text-muted-foreground text-xs"
              >
                Page
              </Label>
              <Input
                id={id('preview-route')}
                value={previewRoute}
                onChange={(e) => setPreviewRoute(e.target.value || '/')}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span
                className="text-muted-foreground text-xs font-medium"
                id={id('preview-at')}
              >
                At · {clock.format(previewNow)}
              </span>
              <Slider
                aria-labelledby={id('preview-at')}
                min={scrubMin}
                max={scrubMax}
                step={HOUR}
                value={[previewNow]}
                onValueChange={(value) =>
                  setPreviewAt(
                    Array.isArray(value) ? (value[0] ?? null) : value,
                  )
                }
                className="mt-2 w-full"
              />
            </div>
          </div>

          <div
            className={cn(
              'overflow-hidden rounded-lg border border-dashed border-border bg-background transition-opacity',
              (state !== 'live' || !onRoute) && 'opacity-40',
            )}
          >
            {preview.placement === 'bar' ? (
              <PromoBarView
                promotion={preview}
                now={previewNow}
                onDismiss={() => {}}
              />
            ) : preview.placement === 'card' ? (
              <div className="p-4">
                <PromoCardView promotion={preview} now={previewNow} />
              </div>
            ) : (
              <div className="flex justify-center bg-black/5 p-6">
                <div className="bg-popover text-popover-foreground ring-foreground/10 w-full max-w-sm rounded-xl p-4 shadow-lg ring-1">
                  <PromoDialogContentView
                    promotion={preview}
                    now={previewNow}
                    onDismiss={() => {}}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <dl className="border-border/60 grid gap-2 rounded-xl border p-4 text-sm">
          <div>
            <dt className="text-muted-foreground">When</dt>
            <dd>
              {describeSchedule(startsAt, endsAt, { timeZone })}
              {timeZone ? (
                <span className="text-muted-foreground"> · {timeZone}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Where</dt>
            <dd>
              {draft.include.length ? draft.include.join(', ') : 'Every page'}
              {draft.exclude.length ? (
                <span className="text-muted-foreground">
                  {' '}
                  · never on {draft.exclude.join(', ')}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        {warnings.length > 0 ? (
          <ul className="grid gap-2 text-sm" aria-label="Review notes">
            {warnings.map((warning) => (
              <li
                key={warning.code}
                className="border-border/60 bg-muted/50 text-muted-foreground rounded-lg border px-3 py-2"
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
