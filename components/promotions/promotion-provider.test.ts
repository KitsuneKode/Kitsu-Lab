import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
} from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { act, createElement, useLayoutEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import {
  PromotionProvider,
  usePromotions,
  useImpression,
  visitorIsBusy,
  type PromotionProviderProps,
  type PromotionEvent,
} from './promotion-provider'
import { memoryDismissalStore } from './promotion-stores'
import { assignVariant, dismissalKey, type Promotion } from './promotion'

const NOW = Date.UTC(2026, 8, 27, 12)
const now = () => NOW
const events: PromotionEvent[] = []
const onEvent = (event: PromotionEvent) => events.push(event)
let root: Root
let container: HTMLDivElement
let context: ReturnType<typeof usePromotions>

function promotion(overrides: Partial<Promotion> = {}): Promotion {
  return {
    id: 'offer',
    state: 'published',
    placement: 'bar',
    title: 'Join the course',
    tone: 'neutral',
    include: [],
    exclude: [],
    startsAt: NOW - 1000,
    endsAt: NOW + 60_000,
    priority: 50,
    dismiss: { mode: 'session', scope: 'account' },
    dismissalVersion: 1,
    revision: 1,
    ...overrides,
  }
}

function Probe() {
  const value = usePromotions()
  useLayoutEffect(() => {
    context = value
  })
  return createElement('div', null, value.bar?.title ?? 'No offer')
}

async function renderProvider(
  props: Omit<PromotionProviderProps, 'children' | 'pathname'>,
) {
  await act(async () => {
    root.render(
      createElement(
        PromotionProvider,
        { pathname: '/courses', now, onEvent, ...props },
        createElement(Probe),
      ),
    )
  })
}

beforeAll(() => {
  GlobalRegistrator.register({ url: 'https://example.test/courses' })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

beforeEach(() => {
  events.length = 0
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

afterAll(async () => {
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  await GlobalRegistrator.unregister()
})

test('a conversion retains the variant shown to the visitor', async () => {
  const record = promotion({
    variants: [{ id: 'control' }, { id: 'b', title: 'Variant B' }],
  })
  const storage = memoryDismissalStore()
  storage.set('promo:visitor', 1, 'browser')
  await renderProvider({ source: [record], storage })
  const shown = context.bar!
  expect(shown.variant).toBeDefined()
  await act(async () => {
    context.convert(record.id)
  })
  expect(events.find((event) => event.type === 'convert')?.variant).toBe(
    shown.variant,
  )
})

test('an audience-excluded visitor is not reported in the holdout', async () => {
  const record = promotion({ holdout: 50, audience: { include: ['member'] } })
  const storage = memoryDismissalStore()
  let seed = 1
  while (!assignVariant(record, seed).held) seed += 1
  storage.set('promo:visitor', seed, 'browser')
  await renderProvider({ source: [record], storage })
  expect(events.filter((event) => event.type === 'holdout')).toHaveLength(0)
  await renderProvider({ source: [record], storage, segments: ['member'] })
  expect(events.filter((event) => event.type === 'holdout')).toHaveLength(1)
})

test('a plugin-excluded visitor is not reported in the holdout', async () => {
  const record = promotion({ holdout: 50 })
  const storage = memoryDismissalStore()
  let seed = 1
  while (!assignVariant(record, seed).held) seed += 1
  storage.set('promo:visitor', seed, 'browser')
  await renderProvider({
    source: [record],
    storage,
    plugins: [{ name: 'exclude', allow: () => false }],
  })
  expect(events.filter((event) => event.type === 'holdout')).toHaveLength(0)
})

test('switching account stores does not carry a dismissal to the new account', async () => {
  const record = promotion()
  const accountA = memoryDismissalStore()
  const accountB = memoryDismissalStore()
  await renderProvider({ source: [record], storage: accountA })
  await act(async () => context.dismiss(record))
  expect(container.textContent).toBe('No offer')
  await renderProvider({ source: [record], storage: accountB })
  expect(container.textContent).toBe('Join the course')
  await renderProvider({ source: [record], storage: accountA })
  expect(container.textContent).toBe('No offer')
})

test('impressions require continuous half visibility in a visible tab', async () => {
  const originalObserver = globalThis.IntersectionObserver
  const visibility = Object.getOwnPropertyDescriptor(
    document,
    'visibilityState',
  )
  let callback: IntersectionObserverCallback | undefined
  let count = 0
  class Observer {
    constructor(next: IntersectionObserverCallback) {
      callback = next
    }
    observe() {}
    disconnect() {}
    unobserve() {}
    takeRecords() {
      return []
    }
    root = null
    rootMargin = '0px'
    thresholds = [0.5]
  }
  globalThis.IntersectionObserver =
    Observer as unknown as typeof IntersectionObserver
  const record = promotion()
  const onImpression = () => {
    count += 1
  }
  function Surface() {
    const ref = useImpression(record, onImpression)
    return createElement('section', { ref }, 'Offer')
  }
  const observe = (ratio: number) =>
    callback?.(
      [
        {
          isIntersecting: ratio > 0,
          intersectionRatio: ratio,
        } as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    )
  const setVisibility = (value: DocumentVisibilityState) => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value,
    })
    document.dispatchEvent(new Event('visibilitychange'))
  }
  try {
    setVisibility('visible')
    await act(async () => root.render(createElement(Surface)))
    observe(0.01)
    await Bun.sleep(1100)
    expect(count).toBe(0)
    observe(1)
    setVisibility('hidden')
    await Bun.sleep(1100)
    expect(count).toBe(0)
    setVisibility('visible')
    await Bun.sleep(1100)
    expect(count).toBe(1)
  } finally {
    globalThis.IntersectionObserver = originalObserver
    if (visibility)
      Object.defineProperty(document, 'visibilityState', visibility)
    else Reflect.deleteProperty(document, 'visibilityState')
  }
})

test('a modal hosting the site does not count as another modal', () => {
  const modal = document.createElement('div')
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-modal', 'true')
  document.body.append(modal)
  expect(visitorIsBusy()).toBe(true)
  modal.setAttribute('data-promo-host', '')
  expect(visitorIsBusy()).toBe(false)
  modal.remove()
})

test('a preview shows whatever its schedule, audience or dismissal say, silently', async () => {
  const draft = promotion({
    id: 'draft',
    state: 'draft',
    title: 'Draft bar',
    startsAt: NOW + 7 * 86_400_000,
    endsAt: NOW + 8 * 86_400_000,
    audience: { include: ['member'] },
  })
  const storage = memoryDismissalStore()
  await renderProvider({ source: [], storage, preview: draft })
  expect(context.bar?.title).toBe('Draft bar')
  await act(async () => {
    context.report('click', context.bar!)
    context.dismiss(context.bar!)
  })
  expect(events).toEqual([])
  expect(context.bar).toBeNull()
  // Nothing was written, so the real visitor state is untouched.
  expect(storage.get(dismissalKey(draft), 'account')).toBeNull()
})

test('a floating preview opens at once, without engagement or budget', async () => {
  const draft = promotion({ id: 'draft-toast', placement: 'toast' })
  const storage = memoryDismissalStore()
  // The daily budget is already spent on something else.
  storage.set('promo:budget:floating', NOW - 1000, 'browser')
  await renderProvider({ source: [], storage, preview: draft })
  expect(context.toast?.id).toBe('draft-toast')
})
