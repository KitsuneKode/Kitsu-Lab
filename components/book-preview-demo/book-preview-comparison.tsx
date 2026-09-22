'use client'

import { IconGauge } from '@tabler/icons-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const rows = [
  {
    engine: 'Slide',
    input: 'Swipe or buttons',
    cost: 'No extra engine',
    use: 'Default reading and constrained devices',
  },
  {
    engine: 'Curl',
    input: 'Finger-glued corner peel',
    cost: 'Optional page-flip',
    use: 'Physical book preview',
  },
  {
    engine: 'Scroll',
    input: 'Continuous vertical scroll',
    cost: 'Optional PDF.js when the source is a document',
    use: 'Long-form reading without page turns',
  },
  {
    engine: 'Spread',
    input: 'Facing pages, search, loupe',
    cost: 'No extra engine',
    use: 'Facsimile and exhibition layouts',
  },
  {
    engine: 'Archival curl',
    input: 'Curl plus search and speech',
    cost: 'Optional page-flip',
    use: 'Illustrated facsimile reading',
  },
  {
    engine: 'WebGL',
    input: 'Orbit and skinned mesh',
    cost: 'Optional Three.js stack',
    use: 'Desktop showcase when WebGL is available',
  },
  {
    engine: 'PDF',
    input: 'Paged canvas',
    cost: 'Optional PDF.js and the source file size',
    use: 'Uploaded or remote PDF documents',
  },
]

export function BookPreviewComparison() {
  return (
    <Collapsible className="bg-card w-full rounded-xl border">
      <CollapsibleTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-between px-4 py-3"
            data-book-preview-press
          />
        }
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <IconGauge />
          Compare reader capabilities
          <Badge variant="outline">Qualitative</Badge>
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4">
        <p className="text-muted-foreground mb-3 text-xs">
          These labels describe architecture tradeoffs. They are not measured
          frame-rate, memory, or bandwidth guarantees.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Engine</TableHead>
              <TableHead>Interaction</TableHead>
              <TableHead>Dependency cost</TableHead>
              <TableHead>Best used for</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.engine}>
                <TableCell className="font-medium">{row.engine}</TableCell>
                <TableCell>{row.input}</TableCell>
                <TableCell>{row.cost}</TableCell>
                <TableCell>{row.use}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CollapsibleContent>
    </Collapsible>
  )
}
