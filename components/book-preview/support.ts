/**
 * What this device can and cannot do, said up front — a reader should learn
 * that a mode needs WebGL before choosing it, not from an error after. Every
 * note names the missing piece and what to use instead.
 */

export type SupportNote = {
  /** One line: what is missing. */
  reason: string
  /** One line: what to do about it. */
  suggestion: string
}

export type SupportFeature = 'webgl' | 'highlights' | 'speech'

export const SUPPORT_NOTES: Record<SupportFeature, SupportNote> = {
  webgl: {
    reason: 'Needs WebGL, which is off or unavailable on this device.',
    suggestion:
      'Turn on hardware acceleration, or open this page in Chrome, Edge, Firefox or Safari.',
  },
  highlights: {
    reason:
      'This browser cannot paint highlights on the page — they are still saved to your notebook.',
    suggestion:
      'Chrome, Edge, Safari 17.2+ or Firefox 140+ show them in place.',
  },
  speech: {
    reason: 'Read-aloud needs speech synthesis, which this browser lacks.',
    suggestion: 'Chrome, Edge and Safari read aloud.',
  },
}

/** The note for an engine the device cannot run, or null when it can. */
export function engineSupportNote(
  engineId: string,
  supported: boolean,
): SupportNote | null {
  if (supported) return null
  if (engineId === 'webgl') return SUPPORT_NOTES.webgl
  return {
    reason: 'Not available on this device.',
    suggestion: 'Another reader mode shows the same pages.',
  }
}
