import { DEFAULT_CAPABILITIES, hasWebGLSupport } from "../capabilities"
import type { BookPreviewEngine } from "../types"

export const webglEngine: BookPreviewEngine = {
  id: "webgl",
  label: "WebGL",
  description: "Skinned 3D book mesh",
  // A 3D book flips spreads, not pages — a page counter/slider would report
  // numbers that mean nothing to the reader, so the chrome hides them.
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    webgl: true,
    pagination: false,
    appearance: false,
    sound: false,
  },
  requiresPages: true,
  isSupported: hasWebGLSupport,
  load: () => import("./webgl-engine"),
}
