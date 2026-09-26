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

export function eventHasFiles(event: DragEvent<HTMLElement>): boolean {
  return Array.from(event.dataTransfer.types).includes('Files')
}
