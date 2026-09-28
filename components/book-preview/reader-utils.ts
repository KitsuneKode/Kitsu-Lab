'use client'

import { type DragEvent } from 'react'

export const noopSubscribe = () => () => {}

export function pickControlled<T>(controlled: T | undefined, fallback: T): T {
  return controlled !== undefined ? controlled : fallback
}

export function isPdfFile(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  )
}

/** An opened file is held in memory as an object URL and decoded by
    pdf.js — a cap keeps a drop (or a stray huge pick) from paging the tab
    to death. 100 MB covers real books; bigger files belong in a viewer
    with a byte-range backend anyway. */
export const MAX_PDF_UPLOAD_BYTES = 100 * 1024 * 1024

export function eventHasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}
