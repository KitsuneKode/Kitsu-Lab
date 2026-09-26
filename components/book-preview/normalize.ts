import type {
  BookPreviewPage,
  BookPreviewPageImage,
  BookPreviewSource,
  NormalizedBookSource,
} from './types'

function pageId(page: BookPreviewPage, index: number): string {
  if (page.id.trim().length > 0) return page.id
  return `page-${page.pageNumber || index + 1}`
}

const positiveSize = (value: number) =>
  Number.isFinite(value) && value > 0 && value <= 20_000

/** Drops an image that cannot render without layout shift or a source. */
export function normalizePageImage(
  image: BookPreviewPageImage | undefined,
): BookPreviewPageImage | undefined {
  if (!image) return undefined
  const src = image.src?.trim()
  if (!src || !positiveSize(image.width) || !positiveSize(image.height))
    return undefined
  return {
    ...image,
    src,
    srcSet: image.srcSet?.trim() || undefined,
    sizes: image.sizes?.trim() || undefined,
    alt: image.alt?.trim() ?? '',
  }
}

export function normalizePages(
  pages: BookPreviewPage[] | undefined,
): BookPreviewPage[] {
  if (!pages || pages.length === 0) return []
  return pages.map((page, index) => {
    const pageNumber = page.pageNumber > 0 ? page.pageNumber : index + 1
    const paragraphs = page.paragraphs?.filter(
      (paragraph) => paragraph.trim().length > 0,
    )
    const image = normalizePageImage(page.image)
    // An image page whose image was rejected (blank src, bad size) would
    // otherwise render as a blank page that still counts as ready. Fall back
    // to its description so the reader shows what should be there.
    const lostImage =
      page.image !== undefined &&
      image === undefined &&
      !page.render &&
      !paragraphs?.length &&
      !page.title?.trim()
    return {
      ...page,
      id: pageId(page, index),
      pageNumber,
      paragraphs: lostImage
        ? [page.image?.alt?.trim() || `Page ${pageNumber} could not be shown.`]
        : paragraphs,
      image,
    }
  })
}

export function normalizeSource(
  source: BookPreviewSource,
): NormalizedBookSource {
  const pages = normalizePages(source.pages)
  const pdfUrl = source.pdfUrl?.trim() || undefined
  const downloadUrl = source.downloadUrl?.trim() || pdfUrl

  return {
    revision: source.revision?.trim() || undefined,
    title: source.title?.trim() || undefined,
    author: source.author?.trim() || undefined,
    pages,
    pdfUrl,
    pdfFileName: source.pdfFileName?.trim() || undefined,
    allowPdfUpload: Boolean(source.allowPdfUpload),
    downloadUrl,
    downloadFileName:
      source.downloadFileName?.trim() ||
      source.pdfFileName?.trim() ||
      undefined,
  }
}

function hashIdentity(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

export function sourceIdentity(source: NormalizedBookSource): string {
  const serializable = {
    revision: source.revision,
    title: source.title,
    author: source.author,
    pdfUrl: source.pdfUrl,
    pdfFileName: source.pdfFileName,
    allowPdfUpload: source.allowPdfUpload,
    pages: source.pages.map((page) => {
      const serializablePage = { ...page }
      delete serializablePage.render
      return serializablePage
    }),
  }
  return hashIdentity(JSON.stringify(serializable))
}

export function pageSearchText(page: BookPreviewPage): string {
  if (page.searchableText) return page.searchableText
  return [
    page.title,
    page.subtitle,
    page.kicker,
    ...(page.paragraphs ?? []),
    page.quote?.text,
    page.quote?.attribution,
  ]
    .filter(Boolean)
    .join(' ')
}

export function clampPageIndex(pageIndex: number, totalPages: number): number {
  if (totalPages <= 0) return 0
  if (!Number.isFinite(pageIndex)) return 0
  return Math.min(Math.max(0, Math.trunc(pageIndex)), totalPages - 1)
}

export function isEmptySource(source: NormalizedBookSource): boolean {
  return source.pages.length === 0 && !source.pdfUrl && !source.allowPdfUpload
}
