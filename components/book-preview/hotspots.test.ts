import { describe, expect, test } from 'bun:test'

import {
  hotspotSide,
  hotspotsByPage,
  type BookPreviewHotspot,
} from './hotspots'

const spot = (
  id: string,
  pageIndex: number,
  x: number,
  y: number,
): BookPreviewHotspot => ({ id, pageIndex, x, y, title: id })

describe('hotspots', () => {
  test('groups by page and orders the way a page is read', () => {
    const pages = hotspotsByPage(
      [
        spot('lamp', 2, 0.8, 0.2),
        spot('chair', 2, 0.1, 0.7),
        spot('vase', 2, 0.2, 0.21),
        spot('rug', 4, 0.5, 0.9),
      ],
      10,
    )
    expect(pages.get(2)!.map((h) => h.id)).toEqual(['vase', 'lamp', 'chair'])
    expect(pages.get(4)!.map((h) => h.id)).toEqual(['rug'])
  })

  test('drops what a reader could not use, clamps what is nearly on the page', () => {
    const pages = hotspotsByPage(
      [
        spot('ok', 0, 1.02, -0.01),
        spot('ok', 0, 0.5, 0.5),
        spot('past-end', 9, 0.5, 0.5),
        spot('negative', -1, 0.5, 0.5),
        spot('nan', 0, Number.NaN, 0.5),
        { ...spot('untitled', 0, 0.5, 0.5), title: '' },
      ],
      5,
    )
    expect([...pages.keys()]).toEqual([0])
    expect(pages.get(0)).toEqual([{ ...spot('ok', 0, 1, 0) }])
    expect(hotspotsByPage(undefined, 5).size).toBe(0)
  })

  test('cards open away from the nearest edge', () => {
    expect(hotspotSide({ x: 0.5, y: 0.9 })).toBe('top')
    expect(hotspotSide({ x: 0.5, y: 0.1 })).toBe('bottom')
    expect(hotspotSide({ x: 0.9, y: 0.5 })).toBe('inline-start')
    expect(hotspotSide({ x: 0.1, y: 0.5 })).toBe('inline-end')
  })
})
