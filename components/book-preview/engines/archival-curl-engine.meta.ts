import { DEFAULT_CAPABILITIES } from '../capabilities'
import type { BookPreviewEngine } from '../types'

export const archivalCurlEngine: BookPreviewEngine = {
  id: 'archival-curl',
  label: 'Archival curl',
  description: 'Facsimile pages with curl, search, and speech',
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    curl: true,
    search: true,
    speech: true,
    thumbnails: true,
  },
  load: () => import('./archival-curl-engine'),
}
