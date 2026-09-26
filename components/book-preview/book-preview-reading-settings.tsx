'use client'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useBookPreviewSelector } from './book-preview-provider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  IconAlignJustified,
  IconAlignLeft,
  IconCheck,
  IconLetterCase,
  IconMinus,
  IconPlus,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  TYPOGRAPHY_SCALE_MAX,
  TYPOGRAPHY_SCALE_MIN,
  stepTypographyScale,
  type BookPreviewTypography,
  type TypographyFont,
  type TypographySpacing,
  type TypographyWidth,
} from './typography'
import type { BookPreviewSpreads } from './prefs'
import type { BookPreviewAppearance } from './types'

/** Paper swatches: the fill is the page, the dot is the ink. `system` shows
    the host theme's own card and foreground. */
const PAPERS: {
  value: BookPreviewAppearance
  label: string
  paper: string
  ink: string
}[] = [
  {
    value: 'system',
    label: 'Match site',
    paper: 'var(--card)',
    ink: 'var(--foreground)',
  },
  { value: 'light', label: 'Paper', paper: '#ffffff', ink: '#1c1917' },
  { value: 'sepia', label: 'Sepia', paper: '#FBF0D9', ink: '#2C2523' },
  { value: 'dark', label: 'Dusk', paper: '#27272a', ink: '#f4f4f5' },
  { value: 'oled', label: 'Night', paper: '#000000', ink: '#e4e4e7' },
]

const FONTS: { value: TypographyFont; label: string; sample: string }[] = [
  { value: 'serif', label: 'Serif', sample: 'font-serif' },
  { value: 'sans', label: 'Sans', sample: 'font-sans' },
  { value: 'readable', label: 'Readable', sample: 'font-sans tracking-wide' },
  { value: 'mono', label: 'Mono', sample: 'font-mono' },
]

const SPREADS: { value: BookPreviewSpreads; label: string; hint: string }[] = [
  {
    value: 'auto',
    label: 'Auto',
    hint: 'Two pages when the screen is wide enough',
  },
  { value: 'single', label: 'One', hint: 'Always one page' },
  {
    value: 'double',
    label: 'Two',
    hint: 'Two pages whenever they stay readable',
  },
]

const SPACINGS: { value: TypographySpacing; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Airy' },
]

const WIDTHS: { value: TypographyWidth; label: string }[] = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'normal', label: 'Normal' },
  { value: 'wide', label: 'Wide' },
]

/**
 * One "Aa" control for everything about how the page looks — paper, type,
 * spacing, measure. A reader adjusts these once and forgets them, so they
 * live behind one quiet button instead of five always-on toggles.
 */
export function BookPreviewReadingSettings() {
  // Picks primitives, not the whole state: the panel stays put while the
  // reader turns pages.
  const {
    appearance,
    sound,
    totalPages,
    capabilities,
    setAppearance,
    setSound,
    typography,
    setTypography,
    pageLayout,
    setSpreads,
    setCover,
  } = useBookPreviewSelector((v) => ({
    appearance: v.state.appearance,
    sound: v.state.sound,
    totalPages: v.state.totalPages,
    capabilities: v.state.capabilities,
    setAppearance: v.setAppearance,
    setSound: v.setSound,
    typography: v.typography,
    setTypography: v.setTypography,
    pageLayout: v.pageLayout,
    setSpreads: v.setSpreads,
    setCover: v.setCover,
  }))
  const state = { appearance, sound, totalPages, capabilities }
  const patch = (next: Partial<BookPreviewTypography>) =>
    setTypography({ ...typography, ...next })

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Reading settings"
            data-book-preview-press
            className="min-h-11 min-w-11 sm:min-h-7 sm:min-w-7"
          />
        }
      >
        <IconLetterCase />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle>Reading settings</PopoverTitle>
          <PopoverDescription className="text-xs">
            Size, spacing and width reflow text pages and the premier Text view.
            PDF scans keep their own type.
          </PopoverDescription>
        </PopoverHeader>

        {state.capabilities.appearance ? (
          <section className="flex flex-col gap-2" aria-label="Paper">
            <p className="text-muted-foreground text-xs font-medium">Paper</p>
            <div className="flex items-center justify-between gap-2">
              {PAPERS.map((paper) => {
                const active = state.appearance === paper.value
                return (
                  <button
                    key={paper.value}
                    type="button"
                    aria-label={paper.label}
                    aria-pressed={active}
                    title={paper.label}
                    onClick={() => setAppearance(paper.value)}
                    data-book-preview-press
                    className={cn(
                      'focus-visible:ring-ring/60 relative flex size-11 items-center justify-center rounded-full border shadow-xs outline-none focus-visible:ring-2',
                      active && 'ring-foreground ring-2 ring-offset-2',
                    )}
                    style={{ background: paper.paper, color: paper.ink }}
                  >
                    {active ? (
                      <IconCheck aria-hidden className="size-4" />
                    ) : (
                      <span aria-hidden className="text-xs font-semibold">
                        Aa
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        ) : null}

        <Separator />

        <section className="flex flex-col gap-2" aria-label="Text size">
          <p className="text-muted-foreground text-xs font-medium">Size</p>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Smaller text"
              disabled={typography.scale <= TYPOGRAPHY_SCALE_MIN}
              onClick={() =>
                patch({ scale: stepTypographyScale(typography.scale, -1) })
              }
              data-book-preview-press
            >
              <IconMinus />
            </Button>
            <button
              type="button"
              aria-label="Reset text size"
              onClick={() => patch({ scale: 1 })}
              className="text-muted-foreground hover:text-foreground font-mono text-xs tabular-nums transition-colors"
            >
              {Math.round(typography.scale * 100)}%
            </button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Larger text"
              disabled={typography.scale >= TYPOGRAPHY_SCALE_MAX}
              onClick={() =>
                patch({ scale: stepTypographyScale(typography.scale, 1) })
              }
              data-book-preview-press
            >
              <IconPlus />
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-2" aria-label="Typeface">
          <p className="text-muted-foreground text-xs font-medium">Typeface</p>
          <ToggleGroup
            value={[typography.font]}
            onValueChange={(value) => {
              if (value[0]) patch({ font: value[0] as TypographyFont })
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Typeface"
            className="w-full"
          >
            {FONTS.map((font) => (
              <ToggleGroupItem
                key={font.value}
                value={font.value}
                aria-label={font.label}
                className={cn('flex-1', font.sample)}
              >
                {font.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>

        <section className="flex flex-col gap-2" aria-label="Line spacing">
          <p className="text-muted-foreground text-xs font-medium">Spacing</p>
          <ToggleGroup
            value={[typography.spacing]}
            onValueChange={(value) => {
              if (value[0]) patch({ spacing: value[0] as TypographySpacing })
            }}
            variant="outline"
            size="sm"
            spacing={0}
            aria-label="Line spacing"
            className="w-full"
          >
            {SPACINGS.map((item) => (
              <ToggleGroupItem
                key={item.value}
                value={item.value}
                aria-label={item.label}
                className="flex-1"
              >
                {item.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </section>

        <section className="flex flex-col gap-2" aria-label="Line width">
          <p className="text-muted-foreground text-xs font-medium">Width</p>
          <div className="flex items-center gap-2">
            <ToggleGroup
              value={[typography.width]}
              onValueChange={(value) => {
                if (value[0]) patch({ width: value[0] as TypographyWidth })
              }}
              variant="outline"
              size="sm"
              spacing={0}
              aria-label="Line width"
              className="flex-1"
            >
              {WIDTHS.map((item) => (
                <ToggleGroupItem
                  key={item.value}
                  value={item.value}
                  aria-label={item.label}
                  className="flex-1"
                >
                  {item.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Button
              type="button"
              variant={typography.justify ? 'secondary' : 'outline'}
              size="icon-sm"
              aria-label={
                typography.justify ? 'Align text left' : 'Justify text'
              }
              aria-pressed={typography.justify}
              onClick={() => patch({ justify: !typography.justify })}
              data-book-preview-press
            >
              {typography.justify ? <IconAlignJustified /> : <IconAlignLeft />}
            </Button>
          </div>
        </section>
        {state.totalPages > 2 ? (
          <>
            <Separator />
            <section className="flex flex-col gap-2" aria-label="Page layout">
              <p className="text-muted-foreground text-xs font-medium">
                Two-page spreads
              </p>
              <ToggleGroup
                value={[pageLayout.spreads]}
                onValueChange={(value) => {
                  if (value[0]) setSpreads(value[0] as BookPreviewSpreads)
                }}
                variant="outline"
                size="sm"
                spacing={0}
                aria-label="Two-page spreads"
                className="w-full"
              >
                {SPREADS.map((item) => (
                  <ToggleGroupItem
                    key={item.value}
                    value={item.value}
                    aria-label={item.label}
                    title={item.hint}
                    className="flex-1"
                  >
                    {item.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                  First page on its own, like a book cover
                </p>
                <Button
                  type="button"
                  variant={pageLayout.cover ? 'secondary' : 'outline'}
                  size="sm"
                  aria-pressed={pageLayout.cover}
                  aria-label="First page on its own"
                  onClick={() => setCover(!pageLayout.cover)}
                  data-book-preview-press
                >
                  {pageLayout.cover ? 'On' : 'Off'}
                </Button>
              </div>
            </section>
          </>
        ) : null}
        {state.capabilities.sound ? (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-2">
              <p className="text-muted-foreground text-xs font-medium">
                Page-turn sound
              </p>
              <Button
                type="button"
                variant={state.sound ? 'secondary' : 'outline'}
                size="sm"
                aria-pressed={state.sound}
                onClick={() => setSound(!state.sound)}
                data-book-preview-press
              >
                {state.sound ? (
                  <IconVolume data-icon="inline-start" />
                ) : (
                  <IconVolumeOff data-icon="inline-start" />
                )}
                {state.sound ? 'On' : 'Off'}
              </Button>
            </div>
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
