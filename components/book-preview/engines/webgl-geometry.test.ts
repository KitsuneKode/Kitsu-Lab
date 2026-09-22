import { describe, expect, test } from 'bun:test'
import { PAGE_SEGMENTS, createPageGeometry } from './webgl-geometry'

const BONE_COUNT = PAGE_SEGMENTS + 1

describe('createPageGeometry', () => {
  test('every skin index resolves to a real bone', () => {
    const geom = createPageGeometry()
    const skinIndex = geom.getAttribute('skinIndex')
    expect(skinIndex).toBeDefined()
    // Any index at or above the bone count reproduces the crash:
    // `skeleton.bones[boneIndex] is undefined` during raycast/skinning.
    for (let i = 0; i < skinIndex.array.length; i += 1) {
      const boneIndex = skinIndex.array[i] as number
      expect(boneIndex).toBeGreaterThanOrEqual(0)
      expect(boneIndex).toBeLessThan(BONE_COUNT)
    }
    geom.dispose()
  })

  test('edge vertices land on the outermost bone, not past it', () => {
    const geom = createPageGeometry()
    const skinIndex = geom.getAttribute('skinIndex')
    const maxIndex = Math.max(
      ...Array.from(skinIndex.array as ArrayLike<number>),
    )
    expect(maxIndex).toBeLessThanOrEqual(PAGE_SEGMENTS)
    geom.dispose()
  })
})
