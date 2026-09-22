/**
 * Convenience bundle: every optional engine at once.
 *
 * This file is the "install everything" entry point. It is NOT required to use
 * an optional engine -- importing it pulls in every engine descriptor, so a
 * project that installed only some of them would reference modules it does not
 * have. Install engines individually and compose them instead:
 *
 *   import { pageEngine } from "@/components/book-preview"
 *   import { curlEngine } from "@/components/book-preview/engines/curl-engine.meta"
 *
 *   <BookPreview engines={[pageEngine, curlEngine]} />
 */
import { pageEngine } from './engines'
import { archivalCurlEngine } from './engines/archival-curl-engine.meta'
import { curlEngine } from './engines/curl-engine.meta'
import { pdfEngine } from './engines/pdf-engine.meta'
import { premierEngine } from './engines/premier-engine.meta'
import { scrollEngine } from './engines/scroll-engine.meta'
import { spreadEngine } from './engines/spread-engine.meta'
import { webglEngine } from './engines/webgl-engine.meta'
import type { BookPreviewEngine } from './types'

export { archivalCurlEngine } from './engines/archival-curl-engine.meta'
export { curlEngine } from './engines/curl-engine.meta'
export { pdfEngine } from './engines/pdf-engine.meta'
export { premierEngine } from './engines/premier-engine.meta'
export { scrollEngine } from './engines/scroll-engine.meta'
export { spreadEngine } from './engines/spread-engine.meta'
export { webglEngine } from './engines/webgl-engine.meta'

export const optionalBookPreviewEngines: BookPreviewEngine[] = [
  pageEngine,
  premierEngine,
  curlEngine,
  scrollEngine,
  spreadEngine,
  archivalCurlEngine,
  webglEngine,
  pdfEngine,
]
