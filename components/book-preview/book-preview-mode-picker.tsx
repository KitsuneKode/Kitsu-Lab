'use client'

import { useState, useSyncExternalStore } from 'react'
import { IconChevronDown } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useBookPreviewSelector } from './book-preview-provider'
import { engineSupportNote } from './support'
import type { BookPreviewEngine, BookPreviewMode } from './types'

const noopSubscribe = () => () => {}

/** Engine ids this device cannot run. Checked on the client only (WebGL
    needs a canvas); the server assumes everything works, so hydration is
    clean and the notes appear right after. */
function useUnsupportedEngines(engines: BookPreviewEngine[]): Set<string> {
  const key = useSyncExternalStore(
    noopSubscribe,
    () =>
      engines
        .filter((engine) => engine.isSupported && !engine.isSupported())
        .map((engine) => engine.id)
        .join(','),
    () => '',
  )
  return new Set(key ? key.split(',') : [])
}

export function BookPreviewModePicker() {
  const { enabledEngines, mode, setMode, prefetchMode, finePointer } =
    useBookPreviewSelector((v) => ({
      enabledEngines: v.enabledEngines,
      mode: v.state.mode,
      setMode: v.setMode,
      prefetchMode: v.prefetchMode,
      finePointer: v.finePointer,
    }))
  const state = { mode }
  const [sheetOpen, setSheetOpen] = useState(false)
  const unsupported = useUnsupportedEngines(enabledEngines)

  if (enabledEngines.length <= 1) return null

  const currentLabel =
    enabledEngines.find((engine) => engine.id === state.mode)?.label ?? 'Mode'

  return (
    // Engine choice is setup, not reading — fullscreen hides it (CSS).
    <div data-book-preview-mode-picker className="contents">
      <div className="hidden [@media(pointer:coarse)]:contents">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11 sm:min-h-8"
          onClick={() => setSheetOpen(true)}
          data-book-preview-press
        >
          {currentLabel}
          <IconChevronDown data-icon="inline-end" />
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="gap-4">
            <SheetHeader>
              <SheetTitle>Choose a reader</SheetTitle>
              <SheetDescription>
                Only installed and compatible engines are listed.
              </SheetDescription>
            </SheetHeader>
            <div className="grid gap-2 pb-4">
              {enabledEngines.map((engine) => {
                const note = engineSupportNote(
                  engine.id,
                  !unsupported.has(engine.id),
                )
                return (
                  <Button
                    key={engine.id}
                    type="button"
                    variant={engine.id === state.mode ? 'secondary' : 'outline'}
                    className="h-auto min-h-11 justify-start py-2 text-left whitespace-normal"
                    disabled={Boolean(note)}
                    onClick={() => {
                      setMode(engine.id)
                      setSheetOpen(false)
                    }}
                    data-book-preview-press
                  >
                    <span className="flex flex-col items-start">
                      <span>{engine.label}</span>
                      <span className="text-muted-foreground text-xs font-normal">
                        {note
                          ? `${note.reason} ${note.suggestion}`
                          : engine.description}
                      </span>
                    </span>
                  </Button>
                )
              })}
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="contents [@media(pointer:coarse)]:hidden">
        <ToggleGroup
          value={[state.mode]}
          onValueChange={(value) => {
            const next = value[0]
            if (next) setMode(next as BookPreviewMode)
          }}
          variant="outline"
          size="sm"
          spacing={0}
          aria-label="Reader mode"
          data-book-preview-modes
          className="flex max-w-full flex-wrap"
        >
          {enabledEngines.map((engine) => {
            const note = engineSupportNote(
              engine.id,
              !unsupported.has(engine.id),
            )
            return (
              <ToggleGroupItem
                key={engine.id}
                value={engine.id}
                aria-label={
                  note ? `${engine.label} — ${note.reason}` : engine.label
                }
                // Still choosable (a disabled item cannot show its reason on
                // hover); choosing it opens the full explanation.
                data-unsupported={note ? '' : undefined}
                className="data-[unsupported]:text-muted-foreground data-[unsupported]:line-through data-[unsupported]:decoration-1"
                title={note ? `${note.reason} ${note.suggestion}` : undefined}
                onMouseEnter={() => {
                  if (finePointer) prefetchMode(engine.id)
                }}
                onFocus={() => prefetchMode(engine.id)}
              >
                {engine.label}
              </ToggleGroupItem>
            )
          })}
        </ToggleGroup>
      </div>
    </div>
  )
}
