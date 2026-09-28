import { DEFAULT_CAPABILITIES } from '../capabilities'
import type { BookPreviewEngine } from '../types'

/**
 * Descriptor for the curl reader.
 *
 * Kept apart from `curl-engine.tsx` on purpose: this file is imported eagerly
 * to register the mode, while the engine itself stays behind `load()` so
 * the fold engine never reaches a bundle that does not open a curl book.
 */
export const curlEngine: BookPreviewEngine = {
  id: 'curl',
  label: 'Curl',
  description: 'Tactile corner peel',
  capabilities: { ...DEFAULT_CAPABILITIES, curl: true },
  load: () => import('./curl-engine'),
}
