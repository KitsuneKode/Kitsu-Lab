import { describe, expect, test } from 'bun:test'

import {
  READING_MAX_DWELL_MS,
  createReadingTracker,
  summarizeReading,
  type BookPreviewReadingEvent,
} from './reading-analytics'

function setup() {
  let clock = 0
  const events: BookPreviewReadingEvent[] = []
  const tracker = createReadingTracker((event) => events.push(event), {
    now: () => clock,
  })
  const wait = (ms: number) => {
    clock += ms
  }
  return { tracker, events, wait }
}

describe('reading analytics', () => {
  test('dwell is sent on moving on, glances are ignored', () => {
    const { tracker, events, wait } = setup()
    tracker.view(0, 10)
    wait(4000)
    tracker.view(1, 10)
    wait(200)
    tracker.view(2, 10)
    expect(events).toEqual([{ type: 'dwell', pageIndex: 0, ms: 4000 }])
  })

  test('hidden time does not count, and a walk-away is capped', () => {
    const { tracker, events, wait } = setup()
    tracker.view(3, 10)
    wait(2000)
    tracker.hide()
    wait(60_000)
    tracker.show()
    wait(1000)
    tracker.view(4, 10)
    wait(3 * 60 * 60 * 1000)
    tracker.view(5, 10)
    expect(events).toEqual([
      { type: 'dwell', pageIndex: 3, ms: 2000 },
      { type: 'dwell', pageIndex: 3, ms: 1000 },
      { type: 'dwell', pageIndex: 4, ms: READING_MAX_DWELL_MS },
    ])
  })

  test('finish once, and leave says where', () => {
    const { tracker, events, wait } = setup()
    tracker.view(8, 10)
    wait(1000)
    tracker.view(9, 10)
    wait(1000)
    tracker.view(8, 10)
    wait(1000)
    tracker.view(9, 10)
    wait(1000)
    tracker.leave()
    expect(events.filter((e) => e.type === 'finish')).toHaveLength(1)
    expect(events.at(-1)).toEqual({
      type: 'leave',
      pageIndex: 9,
      totalPages: 10,
    })
    tracker.leave()
    expect(events.filter((e) => e.type === 'leave')).toHaveLength(1)
  })

  test('summaries give time per page and the drop-off curve', () => {
    const summary = summarizeReading([
      { type: 'dwell', pageIndex: 1, ms: 3000 },
      { type: 'dwell', pageIndex: 1, ms: 5000 },
      { type: 'dwell', pageIndex: 1, ms: 4000 },
      { type: 'dwell', pageIndex: 0, ms: 1000 },
      { type: 'leave', pageIndex: 1, totalPages: 10 },
      { type: 'leave', pageIndex: 1, totalPages: 10 },
      { type: 'leave', pageIndex: 9, totalPages: 10 },
      { type: 'finish', totalPages: 10 },
    ])
    expect(summary.pages).toEqual([
      { pageIndex: 0, views: 1, totalMs: 1000, medianMs: 1000 },
      { pageIndex: 1, views: 3, totalMs: 12000, medianMs: 4000 },
    ])
    expect(summary.leaves).toEqual([
      { pageIndex: 1, count: 2 },
      { pageIndex: 9, count: 1 },
    ])
    expect(summary.finishes).toBe(1)
  })
})
