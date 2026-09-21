import { DEFAULT_CAPABILITIES } from "../capabilities"
import type { BookPreviewEngine } from "../types"

export const pdfEngine: BookPreviewEngine = {
  id: "pdf",
  label: "PDF",
  description: "Client-side PDF renderer",
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    zoom: true,
    search: true,
    thumbnails: true,
    upload: true,
    appearance: false,
    sound: false,
  },
  requiresPdf: true,
  load: () => import("./pdf-engine"),
}
