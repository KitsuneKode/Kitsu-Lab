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
  CODE_MAX,
  DIALOG_PRESENTATIONS,
  COUNTDOWN_MAX_DAYS,
  CTA_LABEL_MAX,
  EYEBROW_MAX,
  HOLDOUT_MAX,
  PROMOTION_PLACEMENTS,
  PROMOTION_TONES,
  TITLE_MAX,
  VARIANTS_MAX,
  deliveryState,
  describeSchedule,
  fromZonedInput,
  parsePromotion,
  reviewPromotion,
  targetsRoute,
  type DialogPresentation,
  type Promotion,
  type PromotionContent,
  type PromotionField,
  type PromotionParseOptions,
  type PromotionPlacement,
  type PromotionTone,
} from './promotion'
import {
  HAS_FREQUENCY,
  OPENS_ON_EVENT,
  initialDraft,
  names,
  toInput,
  type Draft,
  type DraftVariant,
} from './promotion-editor-draft'
import {
  PromoBarView,
  PromoCardView,
  PromoDialogContentView,
  PromoToastView,
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
  /** Id of the record being edited, so it is not compared with itself. */
  editingId?: string
  /**
   * The zone dates are entered and shown in, e.g. `Asia/Kolkata`. Defaults to
   * the browser's. The date inputs follow it, not the reviewer's laptop.
   */
  timeZone?: string
  submitLabel?: string
  onSubmit: (content: PromotionContent) => void | Promise<void>
  onCancel?: () => void
  /**
   * Segment names your site passes to the provider (`member`, `plan:pro`),
   * suggested in the audience fields. `new` and `returning` are built in.
   */
  segments?: readonly string[]
  /** Server-side errors to show against fields, e.g. after a failed save. */
  errors?: Partial<Record<PromotionField, string>>
  className?: string
}

const PLACEMENT_LABELS: Record<PromotionPlacement, string> = {
  bar: 'Announcement bar',
  card: 'Inline card',
  toast: 'Toast',
  sheet: 'Offer sheet',
  side: 'Side card',
  spotlight: 'Spotlight',
  dialog: 'Dialog',
}

const PLACEMENT_HINTS: Record<PromotionPlacement, string> = {
  bar: 'A strip above the header. Quiet, seen by everyone.',
  card: 'Sits inside a page slot you name. Never interrupts.',
  toast: 'A small card in the corner after a few seconds. Folds to a chip.',
  sheet: 'Waits behind a tab on the screen edge; opens only when asked.',
  side: 'Sits in the page margin on wide screens, peeks from the edge elsewhere.',
  spotlight:
    'Points at one feature on the page, once, and gets out of the way.',
  dialog: 'Interrupts once per visit, after engagement. Use sparingly.',
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

/** Label, control, hint and error laid out together, with the ids wired for assistive tech. */
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
      <Label id={`${id}-label`} htmlFor={id}>
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-destructive text-xs" role="alert">
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

/** Characters used against the limit; turns red past it. */
function Counter({ value, max }: { value: string; max: number }) {
  return (
    <span
      className={cn('tabular-nums', value.length > max && 'text-destructive')}
    >
      {value.length}/{max}
    </span>
  )
}

/** Include/exclude routes: toggle chips for the host's known routes, or a comma-separated field when it passes none. */
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
    <div
      id={id}
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={invalid ? `${id}-error` : undefined}
      className="flex flex-wrap gap-1.5"
    >
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
  editingId,
  timeZone,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
  segments,
  errors: serverErrors,
  className,
}: PromotionEditorProps) {
  const uid = React.useId()
  const id = (name: string) => `${uid}-${name}`
  const [mountedAt] = React.useState(() => Date.now())
  const [draft, setDraft] = React.useState<Draft>(() =>
    initialDraft(initial, mountedAt, timeZone),
  )
  // Errors show per field once it has been left, and everywhere after submit.
  const [touched, setTouched] = React.useState(false)
  const [blurred, setBlurred] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [pane, setPane] = React.useState<'form' | 'preview'>('form')
  const [previewRoute, setPreviewRoute] = React.useState(
    initial?.include?.[0]?.replace(/\/\*+$/, '') || '/',
  )
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((previous) => ({ ...previous, [key]: value }))
  const setVariant = (index: number, patch: Partial<DraftVariant>) =>
    setDraft((previous) => ({
      ...previous,
      variants: previous.variants.map((variant, i) =>
        i === index ? { ...variant, ...patch } : variant,
      ),
    }))

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
    () => parsePromotion(toInput(draft, timeZone, initial), parseOptions),
    [draft, parseOptions, timeZone, initial],
  )
  const errors: Partial<Record<PromotionField, string>> = { ...serverErrors }
  if (!result.ok) {
    for (const [field, message] of Object.entries(result.errors)) {
      if (touched || blurred.has(field))
        errors[field as PromotionField] = message
    }
  }
  const leave = (field: PromotionField) => () =>
    setBlurred((previous) =>
      previous.has(field) ? previous : new Set(previous).add(field),
    )

  // The preview renders even while invalid, from whatever is typable so far.
  const startsAt = fromZonedInput(draft.startsAt, timeZone) ?? mountedAt
  const endsAt = Math.max(
    fromZonedInput(draft.endsAt, timeZone) ?? startsAt + DAY,
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
        code: draft.code.trim().toUpperCase() || undefined,
        media:
          draft.mediaSrc.trim() && draft.mediaAlt.trim()
            ? {
                src: draft.mediaSrc.trim(),
                alt: draft.mediaAlt.trim(),
                width: draft.mediaWidth,
                height: draft.mediaHeight,
              }
            : undefined,
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
    ? reviewPromotion(result.value, others, mountedAt, { id: editingId })
    : []

  const clock = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  })

  /** Validates the draft, reports the first problem, then hands the content to `onSubmit`. */
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setTouched(true)
    setFormError(null)
    if (!result.ok) {
      setPane('form')
      const first = Object.keys(result.errors)[0] ?? 'title'
      const target = document.getElementById(id(first.replace('.', '-')))
      // Groups are not focusable themselves; focus their first control.
      const focusable = target?.matches('input, textarea, select, button')
        ? target
        : target?.querySelector<HTMLElement>('input, button, select')
      focusable?.focus()
      return
    }
    setSaving(true)
    try {
      await onSubmit(result.value)
    } catch (error) {
      setFormError(
        error instanceof Error && error.message
          ? error.message
          : 'Could not save. Your changes are still here; try again.',
      )
    } finally {
      setSaving(false)
    }
  }

  const describedBy = (name: string, field = name) =>
    errors[field as PromotionField] ? `${id(name)}-error` : undefined

  return (
    <form
      noValidate
      onSubmit={submit}
      className={cn(
        'grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8',
        className,
      )}
    >
      {/* Phones: one pane at a time, the switch pinned where a thumb reaches. */}
      <div className="bg-background/80 sticky top-0 z-10 -mx-1 px-1 py-2 backdrop-blur lg:hidden">
        <ToggleGroup
          aria-label="Editor view"
          value={[pane]}
          onValueChange={(value) => {
            if (value[0]) setPane(value[0] as 'form' | 'preview')
          }}
          variant="outline"
          size="sm"
          className="w-full *:flex-1"
        >
          <ToggleGroupItem value="form">Edit</ToggleGroupItem>
          <ToggleGroupItem value="preview">
            Preview
            {warnings.length > 0 ? (
              <span className="bg-muted-foreground/15 ms-1 rounded-full px-1.5 text-[0.6875rem] tabular-nums">
                {warnings.length}
              </span>
            ) : null}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div
        className={cn(
          'flex-col gap-6 lg:flex',
          pane === 'form' ? 'flex' : 'hidden',
        )}
      >
        <Field
          id={id('placement')}
          label="Placement"
          error={errors.placement}
          hint={PLACEMENT_HINTS[draft.placement]}
        >
          <ToggleGroup
            id={id('placement')}
            aria-labelledby={`${id('placement')}-label`}
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

        {draft.placement === 'dialog' ? (
          <Field
            id={id('presentation')}
            label="Presentation"
            hint={
              draft.presentation === 'story'
                ? 'Full screen. Opens only when a visitor asks for it.'
                : draft.presentation === 'split'
                  ? 'Image beside the copy on wide screens.'
                  : 'A calm centred card.'
            }
          >
            <ToggleGroup
              id={id('presentation')}
              aria-labelledby={`${id('presentation')}-label`}
              value={[draft.presentation]}
              onValueChange={(value) => {
                if (value[0])
                  set('presentation', value[0] as DialogPresentation)
              }}
              variant="outline"
              size="sm"
            >
              {DIALOG_PRESENTATIONS.map((p) => (
                <ToggleGroupItem key={p} value={p}>
                  {p === 'center'
                    ? 'Centred'
                    : p === 'split'
                      ? 'Split'
                      : 'Story'}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
        ) : null}

        {(draft.placement === 'card' || draft.placement === 'spotlight') &&
        slots &&
        slots.length > 0 ? (
          <Field
            id={id('slot')}
            label={draft.placement === 'spotlight' ? 'Points at' : 'Slot'}
            error={errors.slot}
          >
            <ToggleGroup
              id={id('slot')}
              aria-labelledby={`${id('slot')}-label`}
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
            onBlur={leave('title')}
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
            onBlur={leave('body')}
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
              aria-describedby={describedBy('eyebrow')}
              onBlur={leave('eyebrow')}
              onChange={(e) => set('eyebrow', e.target.value)}
            />
          </Field>
          <Field id={id('tone')} label="Tone">
            <ToggleGroup
              id={id('tone')}
              aria-labelledby={`${id('tone')}-label`}
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
              aria-describedby={describedBy('cta-label', 'cta.label')}
              onBlur={leave('cta.label')}
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
                aria-describedby={describedBy('cta-href', 'cta.href')}
                onBlur={leave('cta.href')}
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
                aria-describedby={describedBy('cta-href', 'cta.href')}
                onBlur={leave('cta.href')}
                onChange={(e) => set('ctaHref', e.target.value)}
              />
            )}
          </Field>
        </fieldset>

        <Field
          id={id('code')}
          label="Code (optional)"
          error={errors.code}
          hint="Shown with a copy button, e.g. NIGHT20."
        >
          <Input
            id={id('code')}
            value={draft.code}
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={CODE_MAX}
            className="font-mono uppercase"
            aria-invalid={Boolean(errors.code) || undefined}
            aria-describedby={describedBy('code')}
            onBlur={leave('code')}
            onChange={(e) => set('code', e.target.value)}
          />
        </Field>

        <fieldset className="grid gap-6 sm:grid-cols-2">
          <legend className="sr-only">Image</legend>
          <Field
            id={id('media')}
            label="Image URL (optional)"
            error={errors.media}
          >
            <Input
              id={id('media')}
              value={draft.mediaSrc}
              placeholder="https://… or /images/…"
              aria-invalid={Boolean(errors.media) || undefined}
              aria-describedby={describedBy('media')}
              onBlur={leave('media')}
              onChange={(e) => set('mediaSrc', e.target.value)}
            />
          </Field>
          <Field
            id={id('media-alt')}
            label="Image description"
            hint="What it shows, for people who cannot see it."
          >
            <Input
              id={id('media-alt')}
              value={draft.mediaAlt}
              onBlur={leave('media')}
              onChange={(e) => set('mediaAlt', e.target.value)}
            />
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
          <Field
            id={id('startsAt')}
            label={timeZone ? `Starts (${timeZone})` : 'Starts'}
            error={errors.startsAt}
          >
            <Input
              id={id('startsAt')}
              type="datetime-local"
              value={draft.startsAt}
              aria-invalid={Boolean(errors.startsAt) || undefined}
              aria-describedby={describedBy('startsAt')}
              onChange={(e) => set('startsAt', e.target.value)}
            />
          </Field>
          <Field
            id={id('endsAt')}
            label={timeZone ? `Ends (${timeZone})` : 'Ends'}
            error={errors.endsAt}
          >
            <Input
              id={id('endsAt')}
              type="datetime-local"
              value={draft.endsAt}
              aria-invalid={Boolean(errors.endsAt) || undefined}
              aria-describedby={describedBy('endsAt')}
              onBlur={leave('endsAt')}
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
                  aria-invalid={Boolean(errors.dismiss) || undefined}
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
          Show “Ends in …” during the last {COUNTDOWN_MAX_DAYS} days
        </label>

        <details
          className="border-border group rounded-xl border px-4 py-3"
          open={Boolean(
            draft.campaign ||
            draft.triggers ||
            draft.audienceInclude ||
            draft.audienceExclude ||
            draft.frequencyHours ||
            draft.dismissScope,
          )}
        >
          <summary className="flex cursor-pointer items-center justify-between text-sm font-medium marker:content-none">
            Who and when
            <span
              aria-hidden
              className="text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <div className="mt-4 flex flex-col gap-6">
            <Field
              id={id('campaign')}
              label="Campaign (optional)"
              hint="Promotions in one campaign never repeat each other, and one purchase stops them all."
            >
              <Input
                id={id('campaign')}
                value={draft.campaign}
                placeholder="spring-sale"
                spellCheck={false}
                onChange={(e) => set('campaign', e.target.value)}
              />
            </Field>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field
                id={id('audience')}
                label="Only for (optional)"
                error={errors.audience}
                hint={`Segment names, comma separated. Built in: new, returning${segments?.length ? `. Yours: ${segments.join(', ')}` : ''}.`}
              >
                <Input
                  id={id('audience')}
                  value={draft.audienceInclude}
                  placeholder="returning, member"
                  spellCheck={false}
                  aria-invalid={Boolean(errors.audience) || undefined}
                  aria-describedby={describedBy('audience')}
                  onBlur={leave('audience')}
                  onChange={(e) => set('audienceInclude', e.target.value)}
                />
              </Field>
              <Field
                id={id('audience-exclude')}
                label="Never for (optional)"
                hint="Wins over “Only for”."
              >
                <Input
                  id={id('audience-exclude')}
                  value={draft.audienceExclude}
                  placeholder="member"
                  spellCheck={false}
                  onBlur={leave('audience')}
                  onChange={(e) => set('audienceExclude', e.target.value)}
                />
              </Field>
            </div>

            {OPENS_ON_EVENT.has(draft.placement) ? (
              <Field
                id={id('triggers')}
                label="Opens on an event (optional)"
                error={errors.triggers}
                hint={
                  <>
                    Leave empty to open by itself. With a name, it opens only
                    when your code calls{' '}
                    <code className="font-mono">
                      trigger('{names(draft.triggers)[0] ?? 'upgrade-intent'}')
                    </code>
                    , e.g. when someone clicks Upgrade.
                  </>
                }
              >
                <Input
                  id={id('triggers')}
                  value={draft.triggers}
                  placeholder="upgrade-intent"
                  spellCheck={false}
                  className="font-mono"
                  aria-invalid={Boolean(errors.triggers) || undefined}
                  aria-describedby={describedBy('triggers')}
                  onBlur={leave('triggers')}
                  onChange={(e) => set('triggers', e.target.value)}
                />
              </Field>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-2">
              {HAS_FREQUENCY.has(draft.placement) ? (
                <Field
                  id={id('frequency')}
                  label="Show at most every (hours)"
                  error={errors.frequency}
                  hint="Empty or 0 uses the default, once a day."
                >
                  <Input
                    id={id('frequency')}
                    type="number"
                    min={0}
                    max={24 * 90}
                    value={draft.frequencyHours || ''}
                    placeholder="24"
                    aria-invalid={Boolean(errors.frequency) || undefined}
                    aria-describedby={describedBy('frequency')}
                    onBlur={leave('frequency')}
                    onChange={(e) =>
                      set('frequencyHours', Number(e.target.value) || 0)
                    }
                  />
                </Field>
              ) : null}
              <Field
                id={id('scope')}
                label="Remember dismissals in"
                hint="Account follows a signed-in visitor across devices."
              >
                <select
                  id={id('scope')}
                  value={draft.dismissScope}
                  onChange={(e) =>
                    set('dismissScope', e.target.value as Draft['dismissScope'])
                  }
                  className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2 text-sm outline-none focus-visible:ring-3"
                >
                  <option value="">This browser</option>
                  <option value="tab">This tab only</option>
                  <option value="cookie">A cookie (server can read it)</option>
                  <option value="account">The visitor’s account</option>
                </select>
              </Field>
            </div>

            {draft.code.trim() ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="accent-primary size-4"
                  checked={draft.revealCode}
                  onChange={(e) => set('revealCode', e.target.checked)}
                />
                Hide the code until the visitor taps Reveal
              </label>
            ) : null}
          </div>
        </details>

        <details
          className="border-border group rounded-xl border px-4 py-3"
          open={draft.variants.length > 0 || draft.holdout > 0}
        >
          <summary className="flex cursor-pointer items-center justify-between text-sm font-medium marker:content-none">
            A/B test
            <span
              aria-hidden
              className="text-muted-foreground transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
            >
              +
            </span>
          </summary>
          <div
            id={id('variants')}
            className="mt-4 flex flex-col gap-4"
            aria-describedby={describedBy('variants')}
          >
            <p className="text-muted-foreground text-xs">
              Each visitor sees one version, the same one every time. Events say
              which, so you can compare conversions. Empty fields keep the
              original copy.
            </p>
            {draft.variants.length ? (
              <Field
                id={id('control-weight')}
                label="Original copy: share of visitors"
                hint="Relative to the variants’ shares."
              >
                <Input
                  id={id('control-weight')}
                  type="number"
                  min={1}
                  max={100}
                  className="w-24"
                  value={draft.controlWeight}
                  onChange={(e) =>
                    set(
                      'controlWeight',
                      Math.max(1, Number(e.target.value) || 1),
                    )
                  }
                />
              </Field>
            ) : null}
            {draft.variants.map((variant, index) => (
              <fieldset
                key={variant.key}
                className="border-border grid gap-4 rounded-lg border p-3 sm:grid-cols-2"
              >
                <legend className="px-1 text-xs font-medium">
                  Variant {index + 1}
                </legend>
                <Field id={id(`variant-${index}-id`)} label="Name">
                  <Input
                    id={id(`variant-${index}-id`)}
                    value={variant.id}
                    spellCheck={false}
                    className="font-mono"
                    onBlur={leave('variants')}
                    onChange={(e) => setVariant(index, { id: e.target.value })}
                  />
                </Field>
                <Field id={id(`variant-${index}-weight`)} label="Share">
                  <Input
                    id={id(`variant-${index}-weight`)}
                    type="number"
                    min={1}
                    max={100}
                    value={variant.weight}
                    onChange={(e) =>
                      setVariant(index, {
                        weight: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </Field>
                <Field id={id(`variant-${index}-title`)} label="Title">
                  <Input
                    id={id(`variant-${index}-title`)}
                    value={variant.title}
                    placeholder={draft.title}
                    maxLength={TITLE_MAX}
                    onBlur={leave('variants')}
                    onChange={(e) =>
                      setVariant(index, { title: e.target.value })
                    }
                  />
                </Field>
                <Field id={id(`variant-${index}-cta`)} label="Button text">
                  <Input
                    id={id(`variant-${index}-cta`)}
                    value={variant.ctaLabel}
                    placeholder={draft.ctaLabel}
                    maxLength={CTA_LABEL_MAX}
                    onBlur={leave('variants')}
                    onChange={(e) =>
                      setVariant(index, { ctaLabel: e.target.value })
                    }
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field id={id(`variant-${index}-body`)} label="Message">
                    <Textarea
                      id={id(`variant-${index}-body`)}
                      value={variant.body}
                      placeholder={draft.body}
                      maxLength={BODY_MAX}
                      rows={2}
                      onBlur={leave('variants')}
                      onChange={(e) =>
                        setVariant(index, { body: e.target.value })
                      }
                    />
                  </Field>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-start"
                  onClick={() =>
                    set(
                      'variants',
                      draft.variants.filter((_, i) => i !== index),
                    )
                  }
                >
                  Remove variant {index + 1}
                </Button>
              </fieldset>
            ))}
            {errors.variants ? (
              <p
                id={`${id('variants')}-error`}
                role="alert"
                className="text-destructive text-xs"
              >
                {errors.variants}
              </p>
            ) : null}
            {draft.variants.length < VARIANTS_MAX - 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() =>
                  set('variants', [
                    ...draft.variants,
                    {
                      key: `added-${Date.now()}`,
                      id: `v${draft.variants.length + 2}`,
                      title: '',
                      body: '',
                      ctaLabel: '',
                      weight: 1,
                    },
                  ])
                }
              >
                Add a variant
              </Button>
            ) : null}
            <Field
              id={id('holdout')}
              label={`Hold out · ${draft.holdout}%`}
              error={errors.holdout}
              hint="This share of visitors never sees it, so you can measure whether it helps at all."
            >
              <Slider
                id={id('holdout')}
                className="w-full"
                min={0}
                max={HOLDOUT_MAX}
                step={5}
                value={[draft.holdout]}
                onValueChange={(value) =>
                  set('holdout', Array.isArray(value) ? (value[0] ?? 0) : value)
                }
              />
            </Field>
          </div>
        </details>

        {formError ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            {formError}
          </p>
        ) : null}

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
        className={cn(
          'flex-col gap-4 lg:sticky lg:top-6 lg:flex lg:self-start',
          pane === 'preview' ? 'flex' : 'hidden',
        )}
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
            ) : preview.placement === 'toast' ? (
              <div className="flex min-h-40 items-end justify-end bg-black/[0.03] p-4">
                <PromoToastView
                  promotion={preview}
                  now={previewNow}
                  onDismiss={() => {}}
                  onMinimize={() => {}}
                  className="w-full max-w-[22rem]"
                />
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
            <dd>{describeSchedule(startsAt, endsAt, { timeZone })}</dd>
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
