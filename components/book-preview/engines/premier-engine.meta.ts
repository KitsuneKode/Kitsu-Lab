import { DEFAULT_CAPABILITIES } from "../capabilities"
import type { BookPreviewEngine } from "../types"

export const premierEngine: BookPreviewEngine = {
  id: "premier",
  label: "Premier",
  description: "Flagship reader — page curl, search, read-aloud, thumbnails",
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    curl: true,
    search: true,
    speech: true,
    thumbnails: true,
  },
  load: () => import("./premier-engine"),
}
