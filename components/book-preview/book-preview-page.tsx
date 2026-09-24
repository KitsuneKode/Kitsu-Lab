import type { Ref } from 'react'
import { cn } from '@/lib/utils'
import type { BookPreviewAppearance, BookPreviewPage } from './types'

const paperThemes: Record<
  Exclude<BookPreviewAppearance, 'system'>,
  {
    bg: string
    text: string
    muted: string
    border: string
    cover: string
    coverText: string
  }
> = {
  sepia: {
    bg: 'bg-[#FBF0D9]',
    text: 'text-[#2C2523]',
    muted: 'text-[#7B6E5D]',
    border: 'border-[#D9CCA8]',
    cover: 'bg-gradient-to-br from-[#2D1B13] via-[#3E251A] to-[#1C100B]',
    coverText: 'text-[#F3E5AB]',
  },
  light: {
    bg: 'bg-background',
    text: 'text-foreground',
    muted: 'text-muted-foreground',
    border: 'border-border',
    cover: 'bg-foreground',
    coverText: 'text-background',
  },
  dark: {
    bg: 'bg-card',
    text: 'text-card-foreground',
    muted: 'text-muted-foreground',
    border: 'border-border',
    cover: 'bg-background',
    coverText: 'text-foreground',
  },
  oled: {
    bg: 'bg-black',
    text: 'text-zinc-100',
    muted: 'text-zinc-400',
    border: 'border-zinc-800',
    cover: 'bg-black',
    coverText: 'text-zinc-100',
  },
}

function themeClasses(appearance: BookPreviewAppearance) {
  if (appearance === 'system') {
    return {
      bg: 'bg-card',
      text: 'text-card-foreground',
      muted: 'text-muted-foreground',
      border: 'border-border',
      cover: 'bg-foreground',
      coverText: 'text-background',
    }
  }
  return paperThemes[appearance]
}

type BookPreviewPageViewProps = {
  page: BookPreviewPage
  appearance?: BookPreviewAppearance
  isLeftPage?: boolean
  className?: string
  ref?: Ref<HTMLDivElement>
}

export function BookPreviewPageView({
  page,
  appearance = 'system',
  isLeftPage = false,
  className,
  ref,
}: BookPreviewPageViewProps) {
  if (page.render) {
    return (
      <div ref={ref} className="h-full w-full">
        {page.render({ appearance, isLeftPage, page })}
      </div>
    )
  }

  if (page.image) {
    return (
      <BookPreviewImagePage
        page={page}
        appearance={appearance}
        className={className}
        ref={ref}
      />
    )
  }

  if (page.isCover || page.isBackCover) {
    return (
      <BookPreviewCoverPage
        page={page}
        appearance={appearance}
        className={className}
        ref={ref}
      />
    )
  }

  return (
    <BookPreviewTextPage
      page={page}
      appearance={appearance}
      isLeftPage={isLeftPage}
      className={className}
      ref={ref}
    />
  )
}

/**
 * A raster page on the paper surface. `object-contain` keeps the whole page
 * visible in any engine frame; the intrinsic size fixes the aspect ratio so the
 * frame never jumps while the image arrives.
 */
function BookPreviewImagePage({
  page,
  appearance,
  className,
  ref,
}: BookPreviewThemePageProps) {
  const theme = themeClasses(appearance)
  const image = page.image
  if (!image) return null
  const placeholder = image.placeholder?.startsWith('data:')
    ? { backgroundImage: `url(${image.placeholder})`, backgroundSize: 'cover' }
    : image.placeholder
      ? { backgroundColor: image.placeholder }
      : undefined
  return (
    <div
      ref={ref}
      data-slot="book-preview-image-page"
      className={cn(
        'flex h-full w-full items-center justify-center overflow-hidden',
        theme.bg,
        className,
      )}
    >
      {/* Plain img: the registry must not assume a framework image loader. */}
      {/* oxlint-disable-next-line nextjs/no-img-element */}
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={image.sizes}
        width={image.width}
        height={image.height}
        alt={image.alt || `Page ${page.pageNumber}`}
        decoding="async"
        draggable={false}
        style={{
          aspectRatio: `${image.width} / ${image.height}`,
          ...placeholder,
        }}
        className="h-auto max-h-full w-auto max-w-full object-contain select-none"
      />
    </div>
  )
}

type BookPreviewThemePageProps = {
  page: BookPreviewPage
  appearance: BookPreviewAppearance
  className?: string
  ref?: Ref<HTMLDivElement>
}

function BookPreviewCoverPage({
  page,
  appearance,
  className,
  ref,
}: BookPreviewThemePageProps) {
  const theme = themeClasses(appearance)

  return (
    <article
      ref={ref}
      className={cn(
        'relative flex h-full w-full flex-col justify-between overflow-hidden p-6 transition-colors duration-200 sm:p-8',
        theme.cover,
        theme.coverText,
        className,
      )}
    >
      <div className="flex h-full flex-col items-center justify-between rounded-md border border-current/40 p-4 text-center">
        <p className="mt-2 text-[10px] font-medium tracking-[0.28em] uppercase opacity-80">
          {page.kicker ?? (page.isBackCover ? 'Colophon' : 'Preview')}
        </p>
        <div className="my-auto flex max-w-[280px] flex-col items-center gap-4">
          <h1 className="text-xl font-semibold tracking-wide sm:text-2xl">
            {page.title}
          </h1>
          {page.subtitle ? (
            <p className="text-sm italic opacity-85">{page.subtitle}</p>
          ) : null}
        </div>
        <p className="mb-2 text-[10px] tracking-[0.2em] uppercase opacity-75">
          {page.paragraphs?.[0] ?? `Page ${page.pageNumber}`}
        </p>
      </div>
    </article>
  )
}

function BookPreviewTextPage({
  page,
  appearance,
  isLeftPage = false,
  className,
  ref,
}: BookPreviewThemePageProps & { isLeftPage?: boolean }) {
  const theme = themeClasses(appearance)

  return (
    <article
      ref={ref}
      className={cn(
        'relative flex h-full w-full flex-col justify-between overflow-hidden p-6 font-serif transition-colors duration-200 sm:p-8',
        theme.bg,
        theme.text,
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-10"
        style={{
          left: isLeftPage ? 'auto' : 0,
          right: isLeftPage ? 0 : 'auto',
          background: isLeftPage
            ? 'linear-gradient(to left, color-mix(in oklab, var(--foreground) 18%, transparent), transparent)'
            : 'linear-gradient(to right, color-mix(in oklab, var(--foreground) 18%, transparent), transparent)',
        }}
      />
      <header
        className={cn(
          'flex items-center justify-between border-b pb-2 text-[11px] tracking-wider uppercase',
          theme.border,
          theme.muted,
        )}
      >
        <span>
          {isLeftPage ? `Page ${page.pageNumber}` : (page.kicker ?? 'Folio')}
        </span>
        <span>
          {isLeftPage ? (page.title ?? 'Page') : `Page ${page.pageNumber}`}
        </span>
      </header>
      <div className="my-3 flex flex-1 flex-col justify-center gap-3 overflow-hidden">
        {page.title ? (
          <h2 className="text-base font-semibold tracking-tight sm:text-lg">
            {page.title}
          </h2>
        ) : null}
        {page.paragraphs?.map((paragraph, index) => (
          <p
            key={`${page.id}-${index}`}
            className="text-xs leading-relaxed sm:text-sm"
          >
            {paragraph}
          </p>
        ))}
        {page.quote ? (
          <blockquote
            className={cn(
              'rounded-r border-l-2 px-3 py-2 text-xs italic sm:text-sm',
              theme.border,
              theme.muted,
            )}
          >
            “{page.quote.text}”
            {page.quote.attribution ? (
              <footer className="mt-1 text-right text-[10px] not-italic">
                — {page.quote.attribution}
              </footer>
            ) : null}
          </blockquote>
        ) : null}
      </div>
      <footer
        className={cn(
          'text-center font-mono text-[10px] tracking-widest',
          theme.muted,
        )}
      >
        — {page.pageNumber} —
      </footer>
    </article>
  )
}
