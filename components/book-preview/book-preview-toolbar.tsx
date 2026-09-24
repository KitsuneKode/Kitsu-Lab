'use client'

import { useRef } from 'react'
import {
  IconBookmark,
  IconBookmarkFilled,
  IconDownload,
  IconHighlight,
  IconPencil,
  IconList,
  IconMaximize,
  IconMinimize,
  IconUpload,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { BookPreviewIconButton } from './book-preview-icon-button'
import { BookPreviewModePicker } from './book-preview-mode-picker'
import { BookPreviewReadingSettings } from './book-preview-reading-settings'
import { useBookPreview } from './book-preview-provider'
import { findBookmark, toggleBookmark } from './annotations'

export function BookPreviewToolbar() {
  const {
    state,
    source,
    toggleFullscreen,
    fullscreen,
    goToPage,
    uploadPdf,
    setChromeHost,
  } = useBookPreview()
  // A document-provided outline (PDF bookmarks) wins over titles synthesized
  // from page data — it is the author's own table of contents.
  const contents =
    state.contents.length > 0
      ? state.contents.map((entry) => ({
          title: entry.title,
          index: entry.pageIndex,
          depth: entry.depth,
        }))
      : source.pages
          .map((page, index) => ({
            title: page.title ?? page.kicker,
            index,
            depth: 0,
          }))
          .filter(
            (entry): entry is { title: string; index: number; depth: number } =>
              Boolean(entry.title),
          )

  return (
    <div
      data-book-preview-surface
      data-book-preview-chrome="top"
      className="bg-card flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border p-2 sm:gap-3 sm:p-3"
    >
      <BookPreviewModePicker />
      {/* Engines portal their controls into this slot — the reader keeps a
          single chrome bar instead of a second row floating above the stage. */}
      <div ref={setChromeHost} className="contents" />
      <div className="flex flex-wrap items-center gap-2">
        <BookPreviewReadingSettings />
        <MarksControls />
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        {contents.length > 1 ? (
          <ContentsMenu contents={contents} goToPage={goToPage} />
        ) : null}
        <ToolbarActions
          fullscreenCapable={state.capabilities.fullscreen}
          fullscreen={fullscreen}
          downloadCapable={state.capabilities.download}
          downloadUrl={source.downloadUrl}
          downloadFileName={source.downloadFileName}
          uploadCapable={source.allowPdfUpload}
          onUploadPdf={uploadPdf}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    </div>
  )
}

/** Bookmark the page, and open the notebook — with a live count, so a reader
    can see at a glance that their marks are there. */
function MarksControls() {
  const {
    annotate,
    annotations,
    updateAnnotations,
    openCompanion,
    state,
    draw,
    setDraw,
    inkAvailable,
  } = useBookPreview()
  if (!annotate || state.status !== 'ready' || state.totalPages === 0) {
    return null
  }
  const bookmarked = Boolean(findBookmark(annotations, state.pageIndex))
  return (
    <>
      <BookPreviewIconButton
        label={bookmarked ? 'Remove bookmark (B)' : 'Bookmark this page (B)'}
        pressed={bookmarked}
        onClick={() =>
          updateAnnotations((list) => toggleBookmark(list, state.pageIndex))
        }
      >
        {bookmarked ? <IconBookmarkFilled /> : <IconBookmark />}
      </BookPreviewIconButton>
      {inkAvailable ? (
        <BookPreviewIconButton
          label={draw.active ? 'Put the pen down (D)' : 'Draw on the page (D)'}
          pressed={draw.active}
          onClick={() => setDraw({ active: !draw.active })}
        >
          <IconPencil />
        </BookPreviewIconButton>
      ) : null}
      <span className="relative inline-flex">
        <BookPreviewIconButton
          label="Notebook and Ask"
          onClick={() => openCompanion('notes')}
        >
          <IconHighlight />
        </BookPreviewIconButton>
        {annotations.length > 0 ? (
          <span
            aria-hidden
            className="bg-primary text-primary-foreground pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px] leading-none tabular-nums"
          >
            {annotations.length > 99 ? '99+' : annotations.length}
          </span>
        ) : null}
      </span>
    </>
  )
}

function ToolbarActions({
  fullscreenCapable,
  fullscreen,
  downloadCapable,
  downloadUrl,
  downloadFileName,
  uploadCapable,
  onUploadPdf,
  onToggleFullscreen,
}: {
  fullscreenCapable: boolean
  fullscreen: boolean
  downloadCapable: boolean
  downloadUrl?: string
  downloadFileName?: string
  uploadCapable: boolean
  onUploadPdf: (file: File) => void
  onToggleFullscreen: () => void
}) {
  const uploadInputRef = useRef<HTMLInputElement | null>(null)

  return (
    <>
      {uploadCapable ? (
        <>
          <input
            ref={uploadInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) onUploadPdf(file)
            }}
          />
          <BookPreviewIconButton
            label="Open a PDF"
            onClick={() => uploadInputRef.current?.click()}
          >
            <IconUpload />
          </BookPreviewIconButton>
        </>
      ) : null}
      {fullscreenCapable ? (
        <BookPreviewIconButton
          label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          pressed={fullscreen}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <IconMinimize /> : <IconMaximize />}
        </BookPreviewIconButton>
      ) : null}
      {downloadCapable && downloadUrl ? (
        <Button
          render={
            <a
              href={downloadUrl}
              download={downloadFileName}
              aria-label="Download document"
            />
          }
          nativeButton={false}
          variant="ghost"
          size="icon-sm"
          data-book-preview-press
        >
          <IconDownload />
          <span className="sr-only">Download document</span>
        </Button>
      ) : null}
    </>
  )
}

function ContentsMenu({
  contents,
  goToPage,
}: {
  contents: { title: string; index: number; depth: number }[]
  goToPage: (index: number) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Contents"
            data-book-preview-press
            className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
          />
        }
      >
        <IconList />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80">
        <DropdownMenuGroup>
          {contents.map((entry, position) => (
            <DropdownMenuItem
              key={`${entry.index}-${position}`}
              onClick={() => goToPage(entry.index)}
              className="justify-between gap-4"
            >
              <span
                className="truncate"
                style={{ paddingLeft: `${Math.min(entry.depth, 4) * 0.75}rem` }}
              >
                {entry.title}
              </span>
              <span className="text-muted-foreground font-mono text-xs">
                {entry.index + 1}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
