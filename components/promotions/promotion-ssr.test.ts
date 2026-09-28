import { afterAll, beforeAll, expect, test } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'
import { act, createElement } from 'react'
import { renderToString } from 'react-dom/server'

import { dismissalKey, type Promotion } from './promotion'
import { PromoBar } from './promo-bar'
import { PromotionProvider } from './promotion-provider'
import { memoryDismissalStore, type DismissalStore } from './promotion-stores'

const NOW = Date.UTC(2026, 8, 28, 12)

const bar: Promotion = {
  id: 'launch-bar',
  state: 'published',
  placement: 'bar',
  title: 'Day 3: ink on any page',
  tone: 'neutral',
  include: [],
  exclude: [],
  startsAt: NOW - 1000,
  endsAt: NOW + 86_400_000,
  priority: 50,
  dismiss: { mode: 'days', days: 7, scope: 'cookie' },
  dismissalVersion: 1,
  revision: 1,
}

function page(storage: DismissalStore, serverNow?: number) {
  return createElement(
    PromotionProvider,
    {
      source: [bar],
      pathname: '/',
      storage,
      now: () => NOW,
      ...(serverNow === undefined ? {} : { serverNow }),
    },
    createElement(PromoBar),
  )
}

beforeAll(() => {
  GlobalRegistrator.register({ url: 'https://example.test/' })
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
})

afterAll(async () => {
  Reflect.deleteProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT')
  await GlobalRegistrator.unregister()
})

test('without serverNow the bar waits for the browser', () => {
  expect(renderToString(page(memoryDismissalStore()))).not.toContain(bar.title)
})

test('with serverNow the bar is in the server HTML', () => {
  expect(renderToString(page(memoryDismissalStore(), NOW))).toContain(bar.title)
})

test('a dismissed bar is never server-rendered', () => {
  const storage = memoryDismissalStore()
  storage.set(dismissalKey(bar), NOW - 60_000, 'cookie')
  expect(renderToString(page(storage, NOW))).not.toContain(bar.title)
})

test('hydrating the server HTML with the same instant does not mismatch', async () => {
  const storage = memoryDismissalStore()
  const container = document.createElement('div')
  container.innerHTML = renderToString(page(storage, NOW))
  document.body.append(container)
  const recoverable: unknown[] = []
  const { hydrateRoot } = await import('react-dom/client')
  let root: ReturnType<typeof hydrateRoot> | undefined
  await act(async () => {
    root = hydrateRoot(container, page(storage, NOW), {
      onRecoverableError: (error) => recoverable.push(error),
    })
  })
  expect(recoverable).toEqual([])
  expect(container.textContent).toContain(bar.title)
  await act(async () => root?.unmount())
  container.remove()
})
