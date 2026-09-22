"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { IconLock } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Inline password prompt shown while pdf.js waits for a document password.
 * Shared by every PDF-backed engine so a locked file behaves the same in
 * pdf, scroll, and curl modes.
 */
export function PdfPasswordGate({
  fileName,
  incorrect,
  onSubmit,
  onCancel,
}: {
  fileName?: string
  incorrect: boolean
  onSubmit: (password: string) => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [value, setValue] = useState("")

  useEffect(() => {
    inputRef.current?.focus()
    if (incorrect) inputRef.current?.select()
  }, [incorrect])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!value) return
    onSubmit(value)
  }

  return (
    <div className="m-auto flex w-full max-w-xs flex-col items-center gap-3 rounded-lg border bg-card p-5 text-center shadow-sm">
      <span className="flex size-10 items-center justify-center rounded-full bg-muted">
        <IconLock className="size-4 text-muted-foreground" />
      </span>
      <div className="space-y-1">
        <p className="text-sm font-medium">Password required</p>
        <p className="text-xs text-muted-foreground">
          {fileName ? `${fileName} is` : "This document is"} password-protected.
        </p>
      </div>
      <form onSubmit={submit} className="flex w-full flex-col gap-2">
        <Input
          ref={inputRef}
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // Interactive inputs bypass the shell's Escape handling, so the
            // gate answers it itself.
            if (event.key === "Escape") {
              event.preventDefault()
              onCancel()
            }
          }}
          placeholder="Document password"
          aria-label="Document password"
          aria-invalid={incorrect || undefined}
          autoComplete="off"
          data-book-preview-press
        />
        {incorrect ? (
          <p className="text-xs text-destructive" role="alert">
            That password did not work — try again.
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={onCancel} data-book-preview-press>
            Cancel
          </Button>
          <Button type="submit" size="sm" className="flex-1" disabled={!value} data-book-preview-press>
            Unlock
          </Button>
        </div>
      </form>
    </div>
  )
}
