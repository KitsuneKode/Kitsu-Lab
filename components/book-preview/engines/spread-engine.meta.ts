import { DEFAULT_CAPABILITIES } from '../capabilities'
import type { BookPreviewEngine } from '../types'

export const spreadEngine: BookPreviewEngine = {
  id: 'spread',
  label: 'Spread',
  description: 'Two-page archival spread',
  capabilities: {
    ...DEFAULT_CAPABILITIES,
    spreads: true,
    search: true,
    loupe: true,
    thumbnails: true,
  },
  requiresPages: true,
  load: () => import('./spread-engine'),
}
