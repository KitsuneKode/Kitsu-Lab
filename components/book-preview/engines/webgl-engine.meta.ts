import { DEFAULT_CAPABILITIES, hasWebGLSupport } from "../capabilities"
import type { BookPreviewEngine } from "../types"

export const webglEngine: BookPreviewEngine = {
  id: "webgl",
  label: "WebGL",
  description: "Skinned 3D book mesh",
  capabilities: { ...DEFAULT_CAPABILITIES, webgl: true, appearance: false, sound: false },
  requiresPages: true,
  isSupported: hasWebGLSupport,
  load: () => import("./webgl-engine"),
}
