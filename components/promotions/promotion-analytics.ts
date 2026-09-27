/**
 * Analytics sinks for `onEvent`. Each takes the client you already load
 * (PostHog, gtag, Segment, Vercel Analytics, a GTM data layer), so nothing
 * here depends on a vendor SDK.
 *
 * Consent is yours: pass a sink only once the visitor has agreed, e.g.
 * `onEvent={consented ? posthogSink(posthog) : undefined}`.
 */
import type { PromotionEvent } from './promotion-provider'

export type PromotionEventSink = (event: PromotionEvent) => void

export type SinkOptions = {
  /** Prefix for event names. Default `promotion_`, e.g. `promotion_click`. */
  prefix?: string
  /** Only these event types are sent, e.g. to skip high-volume impressions. */
  include?: readonly PromotionEvent['type'][]
}

/** Flat, vendor-safe properties: no undefined values, strings trimmed. */
export type PromotionEventProperties = Record<string, string>

/** GA4 caps parameter values at 100 characters; keep every vendor within it. */
const VALUE_MAX = 100

export function eventName(
  event: PromotionEvent,
  prefix = 'promotion_',
): string {
  return `${prefix}${event.type}`
}

/** The event as flat properties, omitting anything absent. */
export function eventProperties(
  event: PromotionEvent,
): PromotionEventProperties {
  const properties: PromotionEventProperties = {
    promotion_id: event.id,
    placement: event.placement,
    pathname: event.pathname,
  }
  if (event.campaign) properties.campaign = event.campaign
  if (event.variant) properties.variant = event.variant
  for (const key of Object.keys(properties))
    properties[key] = properties[key]!.slice(0, VALUE_MAX)
  return properties
}

/** Applies the options and never lets a vendor error reach the page. */
function sink(
  send: (name: string, properties: PromotionEventProperties) => void,
  { prefix, include }: SinkOptions = {},
): PromotionEventSink {
  return (event) => {
    if (include && !include.includes(event.type)) return
    try {
      send(eventName(event, prefix), eventProperties(event))
    } catch {
      // Analytics is never allowed to break a page.
    }
  }
}

/** PostHog: `posthog.capture(name, properties)`. */
export function posthogSink(
  posthog: {
    capture: (name: string, properties: PromotionEventProperties) => void
  },
  options?: SinkOptions,
): PromotionEventSink {
  return sink((name, properties) => posthog.capture(name, properties), options)
}

/** Google Analytics 4 through gtag: `gtag('event', name, params)`. */
export function ga4Sink(
  gtag: (
    command: 'event',
    name: string,
    params: PromotionEventProperties,
  ) => void,
  options?: SinkOptions,
): PromotionEventSink {
  return sink((name, properties) => gtag('event', name, properties), options)
}

/** Segment (analytics.js): `analytics.track(name, properties)`. */
export function segmentSink(
  analytics: {
    track: (name: string, properties: PromotionEventProperties) => void
  },
  options?: SinkOptions,
): PromotionEventSink {
  return sink((name, properties) => analytics.track(name, properties), options)
}

/** Vercel Analytics: pass `track` from `@vercel/analytics`. */
export function vercelSink(
  track: (name: string, properties: PromotionEventProperties) => void,
  options?: SinkOptions,
): PromotionEventSink {
  return sink(track, options)
}

/** Google Tag Manager: pushes `{ event, ...properties }` to the data layer. */
export function dataLayerSink(
  dataLayer: { push: (entry: Record<string, string>) => unknown },
  options?: SinkOptions,
): PromotionEventSink {
  return sink(
    (name, properties) => dataLayer.push({ event: name, ...properties }),
    options,
  )
}

/** Sends every event to each sink; one failing sink never stops the rest. */
export function combineSinks(
  ...sinks: (PromotionEventSink | null | undefined | false)[]
): PromotionEventSink {
  const live = sinks.filter((s): s is PromotionEventSink => Boolean(s))
  return (event) => {
    for (const each of live) {
      try {
        each(event)
      } catch {
        // Isolated: the next sink still hears about it.
      }
    }
  }
}
