import { DEFAULT_CAPABILITIES } from "../capabilities"
import type { BookPreviewEngine } from "../types"

export const scrollEngine: BookPreviewEngine = {
  id: "scroll",
  label: "Scroll",
  description: "Continuous vertical reading",
  capabilities: { ...DEFAULT_CAPABILITIES, pagination: true },
  load: () => import("./scroll-engine"),
}
