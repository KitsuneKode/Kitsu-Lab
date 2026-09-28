'use client'

import {
  IconAdjustmentsHorizontal,
  IconKeyboard,
  IconPin,
  IconPinnedOff,
} from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import { BookPreviewIconButton } from './book-preview-icon-button'
import { useBookPreview } from './book-preview-provider'

/**
 * Fullscreen's one always-there control: a quiet pill in the corner that
 * brings the controls back (or puts them away). Moving to an edge or a tap in
 * the middle also works, but a reader should never have to guess.
 */
export function BookPreviewChromeHandle() {
  const { fullscreen, chrome } = useBookPreview()
  if (!fullscreen) return null
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      data-book-preview-chrome-handle
      data-hidden={!chrome.hidden || undefined}
      aria-label={chrome.hidden ? 'Show controls (C)' : 'Hide controls (C)'}
      aria-expanded={!chrome.hidden}
      tabIndex={chrome.hidden ? 0 : -1}
      onClick={chrome.toggle}
      className="gap-1.5 rounded-full shadow-sm"
    >
      <IconAdjustmentsHorizontal data-icon="inline-start" />
      <span data-book-preview-chrome-handle-label>Controls</span>
      <kbd className="text-muted-foreground font-mono text-[10px]">C</kbd>
    </Button>
  )
}

/** In fullscreen: keep the controls up for good, or let them slip away. */
export function BookPreviewPinChrome() {
  const { fullscreen, chrome } = useBookPreview()
  if (!fullscreen) return null
  return (
    <BookPreviewIconButton
      label={chrome.pinned ? 'Let controls hide' : 'Keep controls visible'}
      pressed={chrome.pinned}
      onClick={chrome.togglePinned}
    >
      {chrome.pinned ? <IconPinnedOff /> : <IconPin />}
    </BookPreviewIconButton>
  )
}

type Shortcut = { keys: string[]; label: string }

/**
 * The shortcut sheet — `?` or the keyboard button. Lists only what the
 * current reader can actually do, so nothing on it is a dead key.
 */
export function BookPreviewShortcuts() {
  const {
    finePointer,
    shortcutsOpen,
    setShortcutsOpen,
    engineShortcutsAvailable: engine,
    annotate,
    inkAvailable,
    state,
  } = useBookPreview()
  // Touch-only devices have no keyboard to teach; `?` still opens it when
  // a keyboard is attached to a tablet.
  if (!finePointer && !shortcutsOpen) return null
  const groups: { title: string; items: Shortcut[] }[] = [
    {
      title: 'Reading',
      items: [
        { keys: ['←', '→'], label: 'Turn the page' },
        { keys: ['Space'], label: 'Next page (Shift goes back)' },
        { keys: ['Home', 'End'], label: 'First and last page' },
        ...(engine.search
          ? [{ keys: ['/'], label: 'Search the document' }]
          : []),
        ...(engine.zoom
          ? [{ keys: ['+', '−', '0'], label: 'Zoom in, out, reset' }]
          : []),
      ],
    },
    {
      title: 'View',
      items: [
        ...(state.capabilities.fullscreen
          ? [{ keys: ['F'], label: 'Fullscreen' }]
          : []),
        { keys: ['C'], label: 'Show or hide controls (fullscreen)' },
        { keys: ['Esc'], label: 'Close panels, leave fullscreen' },
        { keys: ['?'], label: 'This list' },
      ],
    },
    ...(annotate
      ? [
          {
            title: 'Marks',
            items: [
              { keys: ['B'], label: 'Bookmark this page' },
              ...(inkAvailable
                ? [{ keys: ['D'], label: 'Pick up or put down the pen' }]
                : []),
            ],
          },
        ]
      : []),
  ]

  return (
    <Popover open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Keyboard shortcuts (?)"
            data-book-preview-press
            className="hidden min-h-11 min-w-11 sm:min-h-7 sm:min-w-7 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
          />
        }
      >
        <IconKeyboard />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-3 p-3">
        <PopoverHeader>
          <PopoverTitle>Keyboard shortcuts</PopoverTitle>
          <PopoverDescription className="text-xs">
            Work while the reader has focus — click the page once to give it.
          </PopoverDescription>
        </PopoverHeader>
        {groups.map((group) => (
          <section key={group.title} className="flex flex-col gap-1.5">
            <h3 className="text-muted-foreground text-[11px] font-medium tracking-wide uppercase">
              {group.title}
            </h3>
            <dl className="flex flex-col gap-1">
              {group.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <dt className="text-foreground/90">{item.label}</dt>
                  <dd className="flex shrink-0 gap-1">
                    {item.keys.map((key) => (
                      <kbd
                        key={key}
                        className="bg-muted text-muted-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-mono text-[11px]"
                      >
                        {key}
                      </kbd>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </PopoverContent>
    </Popover>
  )
}
