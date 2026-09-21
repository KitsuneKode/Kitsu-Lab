"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei/core/OrbitControls"
import {
  Bone,
  BoxGeometry,
  CanvasTexture,
  Color,
  Float32BufferAttribute,
  Group,
  MathUtils,
  MeshStandardMaterial,
  Skeleton,
  SkinnedMesh,
  SRGBColorSpace,
  Uint16BufferAttribute,
  Vector3,
  type WebGLRenderer,
} from "three"
import { easing } from "maath"
import { useDocumentVisible } from "../media"
import { DEFAULT_CAPABILITIES, hasWebGLSupport } from "../capabilities"
import { useStableHandler } from "../hooks/use-stable-handler"
import type { BookPreviewEngineProps, BookPreviewPage } from "../types"

const PAGE_WIDTH = 1.35
const PAGE_HEIGHT = 1.85
const PAGE_DEPTH = 0.004
const PAGE_SEGMENTS = 24
const SEGMENT_WIDTH = PAGE_WIDTH / PAGE_SEGMENTS

function createPageGeometry() {
  const geom = new BoxGeometry(PAGE_WIDTH, PAGE_HEIGHT, PAGE_DEPTH, PAGE_SEGMENTS, 2)
  geom.translate(PAGE_WIDTH / 2, 0, 0)
  const position = geom.attributes.position
  const vertex = new Vector3()
  const skinIndexes: number[] = []
  const skinWeights: number[] = []
  for (let i = 0; i < position.count; i += 1) {
    vertex.fromBufferAttribute(position, i)
    const skinIndex = Math.max(0, Math.floor(vertex.x / SEGMENT_WIDTH))
    const skinWeight = (vertex.x % SEGMENT_WIDTH) / SEGMENT_WIDTH
    skinIndexes.push(skinIndex, skinIndex + 1, 0, 0)
    skinWeights.push(1 - skinWeight, skinWeight, 0, 0)
  }
  geom.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndexes, 4))
  geom.setAttribute("skinWeight", new Float32BufferAttribute(skinWeights, 4))
  return geom
}

function createPageTexture(page: BookPreviewPage, isCover: boolean) {
  const canvas = document.createElement("canvas")
  canvas.width = 512
  canvas.height = 700
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.fillStyle = isCover ? "#1c1917" : "#faf5e4"
  ctx.fillRect(0, 0, 512, 700)
  ctx.fillStyle = isCover ? "#fafaf9" : "#1c1917"
  ctx.textAlign = "left"
  ctx.font = isCover ? "bold 28px Georgia, serif" : "bold 22px Georgia, serif"
  ctx.fillText(page.title ?? `Page ${page.pageNumber}`, 40, isCover ? 280 : 110)
  ctx.font = "16px Georgia, serif"
  const lines = page.paragraphs?.slice(0, 8) ?? []
  lines.forEach((line, index) => {
    ctx.fillText(line.slice(0, 42), 40, 160 + index * 28)
  })
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function PageMesh({
  number,
  opened,
  bookClosed,
  pageGeometry,
  frontTexture,
  backTexture,
  onPageClick,
}: {
  number: number
  opened: boolean
  bookClosed: boolean
  pageGeometry: BoxGeometry
  frontTexture: CanvasTexture | null
  backTexture: CanvasTexture | null
  onPageClick: () => void
}) {
  const group = useRef<Group | null>(null)
  const turnedAt = useRef(0)
  const lastOpened = useRef(opened)
  const skinnedMeshRef = useRef<SkinnedMesh | null>(null)

  const mesh = useMemo(() => {
    const bones: Bone[] = []
    for (let i = 0; i <= PAGE_SEGMENTS; i += 1) {
      const bone = new Bone()
      bone.position.x = i === 0 ? 0 : SEGMENT_WIDTH
      if (i > 0) bones[i - 1]?.add(bone)
      bones.push(bone)
    }
    const skeleton = new Skeleton(bones)
    const materials = [
      new MeshStandardMaterial({ color: new Color("#faf5e4"), roughness: 0.3 }),
      new MeshStandardMaterial({ color: new Color("#222") }),
      new MeshStandardMaterial({ color: new Color("#faf5e4"), roughness: 0.3 }),
      new MeshStandardMaterial({ color: new Color("#faf5e4"), roughness: 0.3 }),
      new MeshStandardMaterial({
        color: new Color("#fff"),
        map: frontTexture ?? undefined,
        roughness: 0.3,
      }),
      new MeshStandardMaterial({
        color: new Color("#fff"),
        map: backTexture ?? undefined,
        roughness: 0.3,
      }),
    ]
    const skinned = new SkinnedMesh(pageGeometry.clone(), materials)
    skinned.frustumCulled = false
    const root = skeleton.bones[0]
    if (root) skinned.add(root)
    skinned.bind(skeleton)
    return skinned
  }, [backTexture, frontTexture, pageGeometry])

  useEffect(() => {
    const current = mesh
    return () => {
      current.geometry.dispose()
      const mats = Array.isArray(current.material) ? current.material : [current.material]
      mats.forEach((material) => material.dispose())
      current.skeleton.dispose()
    }
  }, [mesh])

  useFrame((_, delta) => {
    if (!skinnedMeshRef.current) return
    if (lastOpened.current !== opened) {
      turnedAt.current = Date.now()
      lastOpened.current = opened
    }
    let turningTime = Math.min(450, Date.now() - turnedAt.current) / 450
    turningTime = Math.sin(turningTime * Math.PI)
    let targetRotation = opened ? -Math.PI / 2 : Math.PI / 2
    if (!bookClosed) targetRotation += MathUtils.degToRad(number * 0.9)
    const bones = skinnedMeshRef.current.skeleton.bones
    for (let i = 0; i < bones.length; i += 1) {
      const target = i === 0 ? group.current : bones[i]
      if (!target) continue
      const insideCurve = i < 8 ? Math.sin(i * 0.2 + 0.25) : 0
      const outsideCurve = i >= 8 ? Math.cos(i * 0.3 + 0.09) : 0
      const turningWave = Math.sin(i * Math.PI * (1 / bones.length)) * turningTime
      let rotationAngle =
        0.18 * insideCurve * targetRotation -
        0.05 * outsideCurve * targetRotation +
        0.09 * turningWave * targetRotation
      if (bookClosed) rotationAngle = i === 0 ? targetRotation : 0
      easing.dampAngle(target.rotation, "y", rotationAngle, 0.5, delta)
    }
  })

  return (
    <group
      ref={group}
      onClick={(event) => {
        event.stopPropagation()
        onPageClick()
      }}
    >
      <primitive object={mesh} ref={skinnedMeshRef} position-z={-number * PAGE_DEPTH} />
    </group>
  )
}

function CameraRig() {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(0, 1.2, 4.2)
    camera.lookAt(0, 0, 0)
  }, [camera])
  return null
}

export default function WebGLEngine({
  source,
  pageIndex,
  reducedMotion,
  onPageChange,
  onReady,
  onError,
}: BookPreviewEngineProps) {
  const visible = useDocumentVisible()
  const hostRef = useRef<HTMLDivElement | null>(null)
  const rendererRef = useRef<WebGLRenderer | null>(null)
  const texturesRef = useRef<CanvasTexture[]>([])
  const geometry = useMemo(() => createPageGeometry(), [])
  const [inView, setInView] = useState(false)
  const reportReady = useStableHandler(onReady)
  const reportError = useStableHandler(onError)

  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(Boolean(entry?.isIntersecting)),
      { rootMargin: "160px" }
    )
    observer.observe(host)
    return () => observer.disconnect()
  }, [geometry])

  const sheets = useMemo(() => {
    const pairs: { front: BookPreviewPage; back?: BookPreviewPage }[] = []
    for (let i = 0; i < source.pages.length; i += 2) {
      const front = source.pages[i]
      if (front) pairs.push({ front, back: source.pages[i + 1] })
    }
    return pairs
  }, [source.pages])

  const textures = useMemo(() => {
    return sheets.map((sheet) => ({
      front: createPageTexture(sheet.front, Boolean(sheet.front.isCover)),
      back: sheet.back
        ? createPageTexture(sheet.back, Boolean(sheet.back.isBackCover))
        : null,
    }))
  }, [sheets])

  useEffect(() => {
    const created = textures.flatMap((sheet) =>
      [sheet.front, sheet.back].filter((texture): texture is CanvasTexture => Boolean(texture))
    )
    texturesRef.current = created
    return () => {
      created.forEach((texture) => texture.dispose())
      if (texturesRef.current === created) texturesRef.current = []
    }
  }, [textures])

  useEffect(() => {
    if (!hasWebGLSupport()) {
      reportError({ kind: "unsupported", message: "WebGL is not available on this device." })
      return
    }
    if (source.pages.length === 0) {
      reportError({ kind: "empty", message: "The WebGL reader needs page data." })
      return
    }
    reportReady({
      totalPages: sheets.length + 1,
      capabilities: {
        ...DEFAULT_CAPABILITIES,
        webgl: true,
        appearance: false,
        sound: false,
      },
    })
  }, [reportError, reportReady, sheets.length, source.pages.length])

  useEffect(() => {
    const renderer = rendererRef
    return () => {
      geometry.dispose()
      renderer.current?.dispose()
      renderer.current?.forceContextLoss()
      renderer.current = null
    }
  }, [geometry])

  const currentPage = source.pages[Math.min(pageIndex, source.pages.length - 1)]

  return (
    <div
      ref={hostRef}
      className="relative h-[min(32rem,72svh)] w-full overflow-hidden rounded-xl bg-background"
      role="region"
      aria-label={
        currentPage?.title
          ? `3D book on ${currentPage.title}`
          : "3D book"
      }
    >
      <p className="sr-only">
        {currentPage?.title ?? `Page ${pageIndex + 1}`}.
        {currentPage?.paragraphs?.[0] ? ` ${currentPage.paragraphs[0]}` : ""}
        Use Next and Previous to turn pages.
      </p>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ fov: 42 }}
        frameloop={visible && inView && !reducedMotion ? "always" : "demand"}
        onCreated={({ gl }) => {
          rendererRef.current = gl
        }}
      >
        <CameraRig />
        <ambientLight intensity={1.1} />
        <directionalLight position={[3, 5, 4]} intensity={1.8} />
        <Suspense fallback={null}>
          <group position={[0, -0.2, 0]} rotation-y={-Math.PI / 2} rotation-x={-0.45}>
            {sheets.map((sheet, index) => (
              <PageMesh
                key={sheet.front.id}
                number={index}
                opened={pageIndex > index}
                bookClosed={pageIndex === 0 || pageIndex === sheets.length}
                pageGeometry={geometry}
                frontTexture={textures[index]?.front ?? null}
                backTexture={textures[index]?.back ?? null}
                onPageClick={() => onPageChange(pageIndex > index ? index : index + 1)}
              />
            ))}
          </group>
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            maxPolarAngle={Math.PI / 2 + 0.1}
            minPolarAngle={Math.PI / 4}
            enableRotate={!reducedMotion}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}
