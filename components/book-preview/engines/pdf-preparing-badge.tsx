"use client"

import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"

/**
 * Progress while a PDF rasterizes. Uses the shared Badge primitive rather than
 * a bespoke pill so it tracks the design system automatically.
 */
export function PdfPreparingBadge({ prepared, total }: { prepared: number; total: number }) {
  return (
    <Badge
      role="status"
      variant="outline"
      data-book-preview-fade
      className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 gap-1.5 bg-card/90 font-mono text-muted-foreground shadow-sm backdrop-blur"
    >
      <Spinner data-icon="inline-start" />
      {prepared}/{total}
    </Badge>
  )
}
