import {
  BoxGeometry,
  Float32BufferAttribute,
  Uint16BufferAttribute,
  Vector3,
} from 'three'

export const PAGE_WIDTH = 1.35
export const PAGE_HEIGHT = 1.85
export const PAGE_DEPTH = 0.004
export const PAGE_SEGMENTS = 24
export const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS

export function createPageGeometry() {
  const geom = new BoxGeometry(
    PAGE_WIDTH,
    PAGE_HEIGHT,
    PAGE_DEPTH,
    PAGE_SEGMENTS,
    2,
  )
  geom.translate(PAGE_WIDTH / 2, 0, 0)
  const position = geom.attributes.position
  const vertex = new Vector3()
  const skinIndexes: number[] = []
  const skinWeights: number[] = []
  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i)
    // The last vertex sits exactly on PAGE_WIDTH, where floor() lands on
    // PAGE_SEGMENTS and `skinIndex + 1` would point past the skeleton —
    // three.js then crashes on `bones[boneIndex].matrixWorld` during
    // raycast/skinning. Clamp both indices into the real bone range; the
    // clamped weight is ~0 there so the deformation is unchanged.
    const skinIndex = Math.min(
      PAGE_SEGMENTS,
      Math.max(0, Math.floor(vertex.x / SEGMENT_WIDTH)),
    )
    const skinWeight = (vertex.x % SEGMENT_WIDTH) / SEGMENT_WIDTH
    skinIndexes.push(skinIndex, Math.min(skinIndex + 1, PAGE_SEGMENTS), 0, 0)
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0)
  }
  geom.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndexes, 4))
  geom.setAttribute('skinWeight', new Float32BufferAttribute(skinWeights, 4))
  return geom
}
