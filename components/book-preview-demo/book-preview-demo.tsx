"use client"

import { useMemo, useState } from "react"
import { BookPreview } from "@/components/book-preview"
import { optionalBookPreviewEngines } from "@/components/book-preview/optional-engines"
import type { BookPreviewMode, BookPreviewSource } from "@/components/book-preview"
import { Badge } from "@/components/ui/badge"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { BookPreviewComparison } from "./book-preview-comparison"
import { DEMO_ARCHIVAL_PAGES } from "./sample-archival-pages"
import { DEMO_BOOK_PAGES } from "./sample-pages"

const DEMO_MODES: BookPreviewMode[] = [
  "page",
  "curl",
  "scroll",
  "spread",
  "archival-curl",
  "webgl",
  "pdf",
]

const PDF_SPECIMENS = [
  { url: "/sample-book.pdf", name: "sample-book.pdf", label: "Sample book" },
  { url: "/sample-text-book.pdf", name: "sample-text-book.pdf", label: "Vector text" },
  {
    url: "/specimens/research_paper.pdf",
    name: "research_paper.pdf",
    label: "Research paper",
  },
] as const

const DEMO_DOCUMENTS = [
  { value: "bird", label: "Bird book" },
  { value: "celestial", label: "Celestial" },
  { value: "pdf", label: "PDF" },
] as const

type DemoDocument = (typeof DEMO_DOCUMENTS)[number]["value"]

export function BookPreviewDemo() {
  const [mode, setMode] = useState<BookPreviewMode>("page")
  const [pdfUrl, setPdfUrl] = useState<(typeof PDF_SPECIMENS)[number]["url"]>(
    "/specimens/research_paper.pdf"
  )
  const [docKind, setDocKind] = useState<DemoDocument>("bird")
  const pdfFile = PDF_SPECIMENS.find((item) => item.url === pdfUrl) ?? PDF_SPECIMENS[0]

  // The source depends on which document you picked, never on which view is
  // open. Deriving it from `mode` handed the reader a different document on
  // every view switch, which reset the reading position to page one.
  const source = useMemo<BookPreviewSource>(() => {
    if (docKind === "bird") {
      return {
        title: "The Bird Book",
        author: "Chester A. Reed",
        pages: DEMO_ARCHIVAL_PAGES,
      }
    }
    if (docKind === "pdf") {
      return {
        title: pdfFile.label,
        pdfUrl: pdfFile.url,
        pdfFileName: pdfFile.name,
        allowPdfUpload: true,
        downloadUrl: pdfFile.url,
        downloadFileName: pdfFile.name,
      }
    }
    return {
      title: "The Celestial Mechanics",
      author: "Kitsu Lab preview",
      pages: DEMO_BOOK_PAGES,
    }
  }, [docKind, pdfFile])

  const showPdfSpecimens = docKind === "pdf"

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-24 pb-24 sm:pt-20">
      <div className="flex flex-col items-center gap-2 text-center">
        <Badge variant="secondary">Book preview laboratory</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Tactile book and PDF readers</h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          The reusable component defaults to a lightweight slide engine. Curl, scroll, WebGL, and PDF
          adapters load only after you select them. Pick a document, then switch views freely &mdash;
          curl uses a tactile corner peel, PDFs keep their own page ratio instead of being
          letterboxed, and your place in the document is kept as you move between views.
        </p>
      </div>
      <ToggleGroup
        value={[docKind]}
        onValueChange={(value) => {
          const next = value[0]
          if (DEMO_DOCUMENTS.some((item) => item.value === next)) {
            setDocKind(next as DemoDocument)
          }
        }}
        variant="outline"
        size="sm"
        spacing={0}
        aria-label="Document"
        className="mx-auto"
      >
        {DEMO_DOCUMENTS.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value} aria-label={item.label}>
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {showPdfSpecimens ? (
        <ToggleGroup
          value={[pdfFile.url]}
          onValueChange={(value) => {
            const next = value[0]
            if (PDF_SPECIMENS.some((item) => item.url === next)) {
              setPdfUrl(next as (typeof PDF_SPECIMENS)[number]["url"])
            }
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="PDF specimen"
          className="mx-auto"
        >
          {PDF_SPECIMENS.map((item) => (
            <ToggleGroupItem key={item.url} value={item.url} aria-label={item.label}>
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}
      <BookPreview
        source={source}
        label="Interactive book preview"
        engines={optionalBookPreviewEngines}
        enabledModes={DEMO_MODES}
        mode={mode}
        onModeChange={setMode}
        persistPage
        prefetchModes={["scroll", "spread", "curl"]}
        defaultAppearance="system"
        defaultSound={false}
      />
      <BookPreviewComparison />
    </div>
  )
}
