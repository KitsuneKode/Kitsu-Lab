'use client'

import Link from 'next/link'
import { useLinkStatus } from 'next/link'
import { IconArrowRight } from '@tabler/icons-react'

export function ExhibitLink({
  path,
  name,
  description,
  index,
}: {
  path: string
  name: string
  description?: string
  index: number
}) {
  return (
    <Link
      href={`/exhibition/${path}`}
      prefetch
      transitionTypes={['nav-forward']}
      className="group hover:bg-accent/50 flex items-baseline gap-5 px-2 py-6 transition-colors sm:gap-8 sm:px-4"
    >
      <span className="text-muted-foreground font-mono text-xs tabular-nums">
        {String(index + 1).padStart(2, '0')}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="font-display text-base font-semibold tracking-wide sm:text-lg">
          {name}
        </span>
        {description ? (
          <span className="text-muted-foreground line-clamp-2 text-sm leading-relaxed">
            {description}
          </span>
        ) : null}
      </span>
      <ExhibitLinkHint />
    </Link>
  )
}

function ExhibitLinkHint() {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      data-pending={pending ? '' : undefined}
      className="text-muted-foreground group-hover:text-foreground self-center transition-all duration-200 group-hover:translate-x-1 data-[pending]:animate-pulse"
    >
      <IconArrowRight className="size-5" />
    </span>
  )
}
