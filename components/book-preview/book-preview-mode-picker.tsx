"use client"

import { useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBookPreview } from "./book-preview-provider"
import type { BookPreviewMode } from "./types"

export function BookPreviewModePicker() {
  const { enabledEngines, state, setMode, prefetchMode, finePointer } = useBookPreview()
  const [sheetOpen, setSheetOpen] = useState(false)

  if (enabledEngines.length <= 1) return null

  const currentLabel =
    enabledEngines.find((engine) => engine.id === state.mode)?.label ?? "Mode"

  return (
    <>
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
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="gap-4">
            <SheetHeader>
              <SheetTitle>Choose a reader</SheetTitle>
              <SheetDescription>Only installed and compatible engines are listed.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-2 pb-4">
              {enabledEngines.map((engine) => (
                <Button
                  key={engine.id}
                  type="button"
                  variant={engine.id === state.mode ? "secondary" : "outline"}
                  className="h-11 justify-start"
                  onClick={() => {
                    setMode(engine.id)
                    setSheetOpen(false)
                  }}
                  data-book-preview-press
                >
                  <span className="flex flex-col items-start">
                    <span>{engine.label}</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      {engine.description}
                    </span>
                  </span>
                </Button>
              ))}
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
          {enabledEngines.map((engine) => (
            <ToggleGroupItem
              key={engine.id}
              value={engine.id}
              aria-label={engine.label}
              onMouseEnter={() => {
                if (finePointer) prefetchMode(engine.id)
              }}
              onFocus={() => prefetchMode(engine.id)}
            >
              {engine.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  )
}
