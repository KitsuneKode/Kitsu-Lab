import type {
  BookPreviewPage,
  BookPreviewSource,
  NormalizedBookSource,
} from './types'

function pageId(page: BookPreviewPage, index: number): string {
  if (page.id.trim().length > 0) return page.id
  return `page-${page.pageNumber || index + 1}`
}

export function normalizePages(
  pages: BookPreviewPage[] | undefined,
): BookPreviewPage[] {
  if (!pages || pages.length === 0) return []
  return pages.map((page, index) => ({
    ...page,
    id: pageId(page, index),
    pageNumber: page.pageNumber > 0 ? page.pageNumber : index + 1,
    paragraphs: page.paragraphs?.filter(
      (paragraph) => paragraph.trim().length > 0,
    ),
  }))
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
