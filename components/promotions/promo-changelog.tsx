'use client'

import * as React from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { IconArrowRight, IconSparkles, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import type { Promotion } from './promotion'
import { usePromotions } from './promotion-provider'
import { PromoMedia } from './promo-media'

/**
 * A "What's new" hub: a trigger with the unread count and a panel from the
 * end edge listing every live entry, newest first, with its clip.
 *
 * Entries are ordinary card records in a slot (default `changelog`), so the
 * editor, schedule, translations and clips all apply. Unread is per visitor
 * (stored through the provider, so account stores follow them across
 * devices): an entry is new if it started after the panel was last closed.
 * The "New" labels stay while the visitor reads and clear when they close.
 */
export function PromoChangelog({
  slot = 'changelog',
  label = 'What’s new',
  className,
  container,
}: {
  slot?: string
  label?: string
  className?: string
  /** Portal target, e.g. a device frame in a demo. */
  container?: HTMLElement | null
}) {
  const { cards, now, recall, remember, report, Link, labels, timeZone } =
    usePromotions()
  const entries = [...cards(slot)].sort((a, b) => b.startsAt - a.startsAt)
  const seenKey = `changelog:${slot}`
  const lastSeen = recall(seenKey) ?? 0
  const unread = entries.filter((entry) => entry.startsAt > lastSeen)
  const [open, setOpen] = React.useState(false)
  // Which entries were new when the panel opened; they keep their label.
  const [newOnOpen, setNewOnOpen] = React.useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const reported = React.useRef(new Set<string>())
  const date = new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    ...(timeZone ? { timeZone } : {}),
  })

  if (entries.length === 0 || now === null) return null

  const onOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setNewOnOpen(new Set(unread.map((entry) => entry.id)))
      for (const entry of entries) {
        if (reported.current.has(entry.id)) continue
        reported.current.add(entry.id)
        report('impression', entry)
      }
    } else remember(seenKey, now)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Trigger
        data-slot="promo-changelog-trigger"
        aria-label={unread.length ? `${label}, ${unread.length} new` : label}
        className={cn(
          'hover:bg-muted text-foreground focus-visible:ring-ring/50 relative inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm transition-[background-color,transform] duration-150 ease-out outline-none focus-visible:ring-3 active:scale-[0.96] print:hidden',
          className,
        )}
      >
        <IconSparkles aria-hidden className="size-4" />
        <span>{label}</span>
        {unread.length ? (
          <span
            aria-hidden
            className="bg-primary text-primary-foreground grid h-4 min-w-4 place-items-center rounded-full px-1 text-[0.625rem] font-semibold tabular-nums"
          >
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        ) : null}
      </Dialog.Trigger>
      <Dialog.Portal container={container}>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/25 transition-opacity duration-300 ease-out data-ending-style:opacity-0 data-ending-style:duration-200 data-starting-style:opacity-0 dark:bg-black/50" />
        <Dialog.Popup
          data-slot="promo-changelog"
          className="bg-popover text-popover-foreground fixed inset-y-0 end-0 z-50 flex w-[min(28rem,100%)] flex-col shadow-2xl ring-1 ring-black/5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] outline-none data-ending-style:[transform:translateX(100%)] data-ending-style:duration-200 data-starting-style:[transform:translateX(100%)] motion-reduce:transition-opacity motion-reduce:data-ending-style:[transform:none] motion-reduce:data-ending-style:opacity-0 motion-reduce:data-starting-style:[transform:none] motion-reduce:data-starting-style:opacity-0 rtl:data-ending-style:[transform:translateX(-100%)] rtl:data-starting-style:[transform:translateX(-100%)] dark:ring-white/10"
        >
          <header className="flex items-center gap-2 border-b px-5 py-4">
            <Dialog.Title className="[font-family:var(--promo-display,inherit)] text-base font-medium">
              {label}
            </Dialog.Title>
            <Dialog.Close
              render={
                <Button variant="ghost" size="icon-sm" className="ms-auto" />
              }
            >
              <IconX aria-hidden />
              <span className="sr-only">{labels.dismiss}</span>
            </Dialog.Close>
          </header>
          <ol className="flex flex-1 flex-col gap-8 overflow-y-auto overscroll-contain px-5 py-6">
            {entries.map((entry) => (
              <Entry
                key={entry.id}
                entry={entry}
                fresh={newOnOpen.has(entry.id)}
                when={entry.eyebrow ?? date.format(entry.startsAt)}
                Link={Link}
                onClick={() => report('click', entry)}
              />
            ))}
          </ol>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Entry({
  entry,
  fresh,
  when,
  Link,
  onClick,
}: {
  entry: Promotion
  fresh: boolean
  when: string
  Link: ReturnType<typeof usePromotions>['Link']
  onClick: () => void
}) {
  const media = entry.media ?? entry.gallery?.[0]
  return (
    <li className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-muted-foreground">{when}</span>
        {fresh ? (
          <span className="bg-primary/10 text-foreground rounded-md px-1.5 py-0.5 font-medium">
            New
          </span>
        ) : null}
      </div>
      <h3 className="[font-family:var(--promo-display,inherit)] text-lg leading-snug font-medium text-balance">
        {entry.title}
      </h3>
      {media ? (
        <PromoMedia
          media={media}
          aspect="16 / 10"
          className="rounded-[var(--promo-radius,0.75rem)] outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        />
      ) : null}
      {entry.body ? (
        <p className="text-muted-foreground text-sm text-pretty">
          {entry.body}
        </p>
      ) : null}
      {entry.cta ? (
        <Link
          href={entry.cta.href}
          onClick={onClick}
          className="group/cta text-foreground inline-flex items-center gap-1 self-start text-sm font-medium"
          {...(entry.cta.external
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
        >
          {entry.cta.label}
          <IconArrowRight
            aria-hidden
            className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover/cta:translate-x-0.5 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-hover/cta:-translate-x-0.5"
          />
        </Link>
      ) : null}
    </li>
  )
}
