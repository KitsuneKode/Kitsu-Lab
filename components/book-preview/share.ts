/**
 * Sharing and downloading — what a reader expects from "Share" and
 * "Download" on any device. Pure helpers are separated from the two browser
 * wrappers at the bottom so bun can test the decisions.
 */

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed'

/** "“quote” — Title, p. 12" — how a passage reads when pasted anywhere. */
export function formatQuoteForShare(input: {
  quote: string
  title?: string
  pageIndex: number
}): string {
  const quote = input.quote.replace(/\s+/g, ' ').trim()
  const source = [input.title, `p. ${input.pageIndex + 1}`]
    .filter(Boolean)
    .join(', ')
  return `“${quote}” — ${source}`
}

/**
 * Where a download link should go. Same-origin, blob: and data: URLs honour
 * the `download` attribute. A cross-origin URL does not: the browser would
 * navigate the tab to the PDF and throw the reader away, so it opens in a
 * new tab instead.
 */
export function downloadTarget(
  url: string,
  pageOrigin: string,
): { download: boolean; newTab: boolean } {
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return { download: true, newTab: false }
  }
  try {
    const same = new URL(url, pageOrigin).origin === pageOrigin
    return same
      ? { download: true, newTab: false }
      : { download: false, newTab: true }
  } catch {
    return { download: false, newTab: true }
  }
}

type ShareNavigator = {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
  clipboard?: { writeText: (text: string) => Promise<void> }
}

/**
 * The system share sheet where there is one (phones, tablets, Safari), a
 * copied link everywhere else. With a file (an uploaded PDF the link cannot
 * carry), the file itself is offered to the share sheet when supported.
 */
export async function shareOrCopy(
  data: { title?: string; text?: string; url?: string; file?: File },
  nav: ShareNavigator = typeof navigator === 'undefined'
    ? {}
    : (navigator as unknown as ShareNavigator),
): Promise<ShareOutcome> {
  const payload: ShareData = {
    ...(data.title ? { title: data.title } : {}),
    ...(data.text ? { text: data.text } : {}),
    ...(data.url ? { url: data.url } : {}),
  }
  const withFile: ShareData | null = data.file
    ? { ...payload, files: [data.file] }
    : null
  const candidate = withFile && nav.canShare?.(withFile) ? withFile : payload
  if (typeof nav.share === 'function' && (nav.canShare?.(candidate) ?? true)) {
    try {
      await nav.share(candidate)
      return 'shared'
    } catch (error) {
      // Dismissing the sheet is a choice, not a failure.
      if (error instanceof Error && error.name === 'AbortError') {
        return 'cancelled'
      }
    }
  }
  const text = [data.text, data.url].filter(Boolean).join('\n')
  if (!text || !nav.clipboard) return 'failed'
  try {
    await nav.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
