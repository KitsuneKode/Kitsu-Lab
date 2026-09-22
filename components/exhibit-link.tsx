"use client"

import Link from "next/link"
import { useLinkStatus } from "next/link"
import { IconArrowRight } from "@tabler/icons-react"

export function ExhibitLink({ path, name }: { path: string; name: string }) {
  return (
    <Link
      href={`/exhibition/${path}`}
      prefetch
      transitionTypes={["nav-forward"]}
      className="group flex items-center gap-2 text-xl"
    >
      {name}
      <ExhibitLinkHint />
    </Link>
  )
}

function ExhibitLinkHint() {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      data-pending={pending ? "" : undefined}
      className="ml-2 inline-flex transition-transform duration-200 group-hover:translate-x-0.5 data-[pending]:animate-pulse"
    >
      <IconArrowRight />
    </span>
  )
}
