"use client"

import { useRef } from "react"
import {
  ChevronDownIcon,
  DownloadIcon,
  ListIcon,
  Maximize2Icon,
  Minimize2Icon,
  UploadIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Separator } from "@/components/ui/separator"
import { BookPreviewIconButton } from "./book-preview-icon-button"
import { BookPreviewModePicker } from "./book-preview-mode-picker"
import { useBookPreview } from "./book-preview-provider"
import { useCoarsePointer, useNarrowLayout } from "./media"
import type { BookPreviewAppearance } from "./types"

const appearances: { value: BookPreviewAppearance; label: string }[] = [
  { value: "system", label: "System" },
  { value: "sepia", label: "Sepia" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "oled", label: "OLED" },
]

export function BookPreviewToolbar() {
  const {
    state,
    source,
    setAppearance,
    setSound,
    toggleFullscreen,
    fullscreen,
    goToPage,
    uploadPdf,
  } = useBookPreview()
  const narrow = useNarrowLayout()
  const coarse = useCoarsePointer()
  const appearanceLabel =
    appearances.find((item) => item.value === state.appearance)?.label ?? "Paper"
  const contents = source.pages
    .map((page, index) => ({ title: page.title ?? page.kicker, index }))
    .filter((entry): entry is { title: string; index: number } => Boolean(entry.title))

  return (
    <div
      data-book-preview-surface
      data-book-preview-chrome
      className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border bg-card p-2 sm:gap-3 sm:p-3"
    >
      <BookPreviewModePicker />
      <div className="flex flex-wrap items-center gap-2">
        {state.capabilities.appearance ? (
          <AppearanceControl
            appearance={state.appearance}
            appearanceLabel={appearanceLabel}
            compact={narrow || coarse}
            onSelect={setAppearance}
          />
        ) : null}
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

function AppearanceControl({
  appearance,
  appearanceLabel,
  compact,
  onSelect,
}: {
  appearance: BookPreviewAppearance
  appearanceLabel: string
  compact: boolean
  onSelect: (value: BookPreviewAppearance) => void
}) {
  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Paper appearance"
              data-book-preview-press
            />
          }
        >
          {appearanceLabel}
          <ChevronDownIcon data-icon="inline-end" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuGroup>
            {appearances.map((item) => (
              <DropdownMenuItem
                key={item.value}
                onClick={() => onSelect(item.value)}
              >
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <ToggleGroup
      value={[appearance]}
      onValueChange={(value) => {
        if (value[0]) onSelect(value[0] as BookPreviewAppearance)
      }}
      variant="outline"
      size="sm"
      spacing={0}
      aria-label="Paper appearance"
    >
      {appearances.map((item) => (
        <ToggleGroupItem key={item.value} value={item.value} aria-label={item.label}>
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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
              event.target.value = ""
              if (file) onUploadPdf(file)
            }}
          />
          <BookPreviewIconButton
            label="Open a PDF"
            onClick={() => uploadInputRef.current?.click()}
          >
            <UploadIcon />
          </BookPreviewIconButton>
        </>
      ) : null}
      {soundCapable ? (
        <BookPreviewIconButton
          label={sound ? "Mute page sounds" : "Enable page sounds"}
          pressed={sound}
          onClick={() => onSetSound(!sound)}
        >
          {sound ? <Volume2Icon /> : <VolumeXIcon />}
        </BookPreviewIconButton>
      ) : null}
      {fullscreenCapable ? (
        <BookPreviewIconButton
          label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          pressed={fullscreen}
          onClick={onToggleFullscreen}
        >
          {fullscreen ? <Minimize2Icon /> : <Maximize2Icon />}
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
          <DownloadIcon />
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
  contents: { title: string; index: number }[]
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
        <ListIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80">
        <DropdownMenuGroup>
          {contents.map((entry) => (
            <DropdownMenuItem
              key={entry.index}
              onClick={() => goToPage(entry.index)}
              className="justify-between gap-4"
            >
              <span className="truncate">{entry.title}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {entry.index + 1}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
