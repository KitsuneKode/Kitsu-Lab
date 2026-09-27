/**
 * A JSON Schema for what `parsePromotion` accepts, built from the same
 * constants the parser uses, so an assistant (or a CMS) can produce a valid
 * campaign on the first try and the two can never drift apart silently
 * (promotion-schema.test.ts fails if a field is missing).
 *
 * The schema describes shape and limits; `parsePromotion` stays the judge
 * for everything a schema cannot say (allowed links, route patterns, a
 * window that ends after it starts). Serve it, or paste it into a prompt.
 */
import {
  BODY_MAX,
  CODE_MAX,
  CTA_LABEL_MAX,
  DIALOG_PRESENTATIONS,
  DISMISS_SCOPES,
  EYEBROW_MAX,
  GALLERY_MAX,
  HOLDOUT_MAX,
  PROMOTION_PLACEMENTS,
  PROMOTION_TONES,
  PROMOTION_VIDEO_TYPES,
  SEGMENTS_MAX,
  SEGMENT_PATTERN,
  TITLE_MAX,
  TRIGGERS_MAX,
  TRIGGER_PATTERN,
  VARIANTS_MAX,
  VIDEO_SOURCES_MAX,
} from './promotion'

const text = (maxLength: number, description: string) => ({
  type: 'string',
  maxLength,
  description: `${description} Plain text, no markup.`,
})

const copy = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eyebrow: text(EYEBROW_MAX, 'Small label above the title.'),
    title: text(TITLE_MAX, 'Headline.'),
    body: text(BODY_MAX, 'Supporting sentence.'),
    ctaLabel: text(CTA_LABEL_MAX, 'Button text.'),
  },
}

const media = {
  type: 'object',
  required: ['src', 'alt', 'width', 'height'],
  additionalProperties: false,
  description:
    'A still image; with `video` it is also the poster, shown first and kept for reduced motion.',
  properties: {
    src: { type: 'string', description: 'Image URL: a root path or https.' },
    alt: text(160, 'What the image shows, for people who cannot see it.'),
    width: { type: 'integer', minimum: 1, maximum: 10000 },
    height: { type: 'integer', minimum: 1, maximum: 10000 },
    caption: text(
      120,
      'Shown over the image in stories, under it in galleries.',
    ),
    video: {
      type: 'object',
      required: ['sources'],
      additionalProperties: false,
      description:
        'A short silent clip over the still. WebM first, MP4 second.',
      properties: {
        sources: {
          type: 'array',
          minItems: 1,
          maxItems: VIDEO_SOURCES_MAX,
          items: {
            type: 'object',
            required: ['src', 'type'],
            additionalProperties: false,
            properties: {
              src: { type: 'string' },
              type: { enum: [...PROMOTION_VIDEO_TYPES] },
            },
          },
        },
      },
    },
  },
}

const segments = {
  type: 'array',
  maxItems: SEGMENTS_MAX,
  items: { type: 'string', pattern: SEGMENT_PATTERN.source },
}

export const promotionJsonSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://kitsulab.kitsunekode.in/schema/promotion.json',
  title: 'Kitsu promotion',
  description:
    'One campaign surface. Times are epoch milliseconds; the window is [startsAt, endsAt). Validate with parsePromotion before saving.',
  type: 'object',
  required: ['placement', 'title', 'startsAt', 'endsAt'],
  additionalProperties: false,
  properties: {
    placement: {
      enum: [...PROMOTION_PLACEMENTS],
      description:
        'bar and card sit in the page; toast, sheet, side, spotlight and dialog float. Prefer the quietest that works.',
    },
    slot: {
      type: 'string',
      description:
        'For card and spotlight: the named slot it fills, e.g. "hero", "announcement", "showcase".',
    },
    presentation: {
      enum: [...DIALOG_PRESENTATIONS],
      description:
        'For dialog: center, split (media beside copy) or story (full-screen slides; only ever opens on request).',
    },
    eyebrow: copy.properties.eyebrow,
    title: copy.properties.title,
    body: copy.properties.body,
    media,
    gallery: { type: 'array', maxItems: GALLERY_MAX, items: media },
    cta: {
      type: 'object',
      required: ['label', 'href'],
      additionalProperties: false,
      properties: {
        label: text(CTA_LABEL_MAX, 'Button text.'),
        href: {
          type: 'string',
          description: 'A root path like /pricing, or an https URL.',
        },
        external: { type: 'boolean' },
      },
    },
    code: {
      type: 'string',
      pattern: `^[A-Za-z0-9_-]{1,${CODE_MAX}}$`,
      description: 'A coupon code, shown with a copy button.',
    },
    revealCode: {
      type: 'boolean',
      description: 'Start the code hidden behind a Reveal button.',
    },
    tone: { enum: [...PROMOTION_TONES] },
    include: {
      type: 'array',
      items: { type: 'string' },
      description:
        'Route patterns such as "/", "/courses/*" or "/docs/**". Empty means every route.',
    },
    exclude: {
      type: 'array',
      items: { type: 'string' },
      description: 'Route patterns that always win over include.',
    },
    startsAt: { type: 'integer', description: 'Epoch milliseconds.' },
    endsAt: {
      type: 'integer',
      description: 'Epoch milliseconds, after startsAt.',
    },
    priority: {
      type: 'integer',
      minimum: 0,
      maximum: 100,
      description: 'Higher wins within a placement or slot. Default 50.',
    },
    dismiss: {
      type: 'object',
      required: ['mode'],
      properties: {
        mode: { enum: ['session', 'days', 'never-again'] },
        days: {
          type: 'integer',
          minimum: 1,
          maximum: 365,
          description: 'Required when mode is "days".',
        },
        scope: { enum: [...DISMISS_SCOPES] },
      },
    },
    showCountdown: {
      type: 'boolean',
      description: 'Show "Ends in …" during the last 14 days.',
    },
    frequency: {
      type: 'object',
      required: ['hours'],
      additionalProperties: false,
      properties: { hours: { type: 'integer', minimum: 1, maximum: 2160 } },
      description: 'For toasts and dialogs: at most once per this many hours.',
    },
    triggers: {
      type: 'array',
      maxItems: TRIGGERS_MAX,
      items: { type: 'string', pattern: TRIGGER_PATTERN.source },
      description:
        'Named events (e.g. "upgrade-intent") that open this record when the host calls trigger().',
    },
    audience: {
      type: 'object',
      additionalProperties: false,
      properties: { include: segments, exclude: segments },
      description:
        'Segments like "member" or "returning". Exclusions win; empty means everyone.',
    },
    variants: {
      type: 'array',
      minItems: 2,
      maxItems: VARIANTS_MAX,
      items: {
        type: 'object',
        required: ['id'],
        additionalProperties: false,
        properties: {
          id: { type: 'string', pattern: TRIGGER_PATTERN.source },
          weight: { type: 'integer', minimum: 1, maximum: 100 },
          ...copy.properties,
        },
      },
      description:
        'An A/B test. "control" keeps the record\'s copy; other arms replace the fields they set.',
    },
    holdout: {
      type: 'integer',
      minimum: 0,
      maximum: HOLDOUT_MAX,
      description: 'Percent of visitors kept out, to measure lift.',
    },
    campaign: {
      type: 'string',
      description: 'Groups records so one conversion ends them all.',
    },
    translations: {
      type: 'object',
      maxProperties: 24,
      additionalProperties: copy,
      description:
        'Copy per locale tag (fr, de, ja, hi, ar…). Missing fields fall back to the default.',
    },
  },
} as const

/** Field names the schema describes, for checks and prompts. */
export const promotionSchemaFields = Object.keys(
  promotionJsonSchema.properties,
) as (keyof typeof promotionJsonSchema.properties)[]
