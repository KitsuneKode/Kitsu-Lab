import type { BookPreviewPage } from "@/components/book-preview"
import { ARCHIVAL_BIRD_BOOK_PAGES } from "./archival-bird-data"
import { archivalFilterModeFor } from "./archival-filter-mode"
import { ArchivalPlateView } from "./archival-plate-view"

export const DEMO_ARCHIVAL_PAGES: BookPreviewPage[] = ARCHIVAL_BIRD_BOOK_PAGES.map((plate) => ({
  id: `plate-${plate.pageNumber}`,
  pageNumber: plate.pageNumber,
  title: plate.commonName,
  subtitle: plate.scientificName,
  kicker: plate.family ?? plate.order,
  paragraphs: plate.description,
  isCover: plate.isCover,
  isBackCover: plate.isIndex,
  searchableText: [
    plate.commonName,
    plate.scientificName,
    plate.family,
    plate.order,
    ...plate.description,
  ]
    .filter(Boolean)
    .join(" "),
  render: ({ appearance, isLeftPage }) => (
    <ArchivalPlateView
      plate={plate}
      isLeftPage={isLeftPage}
      filterMode={archivalFilterModeFor(appearance)}
    />
  ),
}))
