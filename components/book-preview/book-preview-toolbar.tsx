'use client'

import { useRef } from 'react'
import {
  IconDownload,
  IconList,
  IconMaximize,
  IconMinimize,
  IconUpload,
  IconVolume,
  IconVolumeOff,
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

export function BookPreviewToolbar() {
  const {
    state,
    source,
    setSound,
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
        <Separator orientation="vertical" className="hidden h-6 sm:block" />
        {contents.length > 1 ? (
          <ContentsMenu contents={contents} goToPage={goToPage} />
        ) : null}
        <ToolbarActions
          soundCapable={state.capabilities.sound}
          sound={state.sound}
          fullscreenCapable={state.capabilities.fullscreen}
          fullscreen={fullscreen}
          downloadCapable={state.capabilities.download}
          downloadUrl={source.downloadUrl}
          downloadFileName={source.downloadFileName}
          uploadCapable={source.allowPdfUpload}
          onUploadPdf={uploadPdf}
          onSetSound={setSound}
          onToggleFullscreen={toggleFullscreen}
        />
      </div>
    </div>
  )
}

function ToolbarActions({
  soundCapable,
  sound,
  fullscreenCapable,
  fullscreen,
  downloadCapable,
  downloadUrl,
  downloadFileName,
  uploadCapable,
  onUploadPdf,
  onSetSound,
  onToggleFullscreen,
}: {
  soundCapable: boolean
  sound: boolean
  fullscreenCapable: boolean
  fullscreen: boolean
  downloadCapable: boolean
  downloadUrl?: string
  downloadFileName?: string
  uploadCapable: boolean
  onUploadPdf: (file: File) => void
  onSetSound: (sound: boolean) => void
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
      {soundCapable ? (
        <BookPreviewIconButton
          label={sound ? 'Mute page sounds' : 'Enable page sounds'}
          pressed={sound}
          onClick={() => onSetSound(!sound)}
        >
          {sound ? <IconVolume /> : <IconVolumeOff />}
        </BookPreviewIconButton>
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
