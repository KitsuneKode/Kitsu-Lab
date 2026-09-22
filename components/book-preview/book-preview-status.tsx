'use client'

import {
  IconAlertCircle,
  IconBook2,
  IconLoader2,
  IconShieldOff,
} from '@tabler/icons-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Spinner } from '@/components/ui/spinner'
import type { BookPreviewError, BookPreviewStatus } from './types'

type BookPreviewStatusProps = {
  status: BookPreviewStatus
  error: BookPreviewError | null
  onRetry?: () => void
  onReload?: () => void
  onFallback?: () => void
  fallbackLabel?: string
}

export function BookPreviewStatus({
  status,
  error,
  onRetry,
  onReload,
  onFallback,
  fallbackLabel = 'Open lightweight reader',
}: BookPreviewStatusProps) {
  if (status === 'loading' || status === 'idle') {
    return <LoadingStatus />
  }

  if (status === 'empty') {
    return <EmptyStatus />
  }

  if (status === 'unsupported') {
    return (
      <UnsupportedStatus
        message={error?.message}
        onFallback={onFallback}
        fallbackLabel={fallbackLabel}
      />
    )
  }

  if (status === 'error' && error) {
    return (
      <ErrorStatus
        error={error}
        onRetry={onRetry}
        onReload={onReload}
        onFallback={onFallback}
        fallbackLabel={fallbackLabel}
      />
    )
  }

  return null
}

function LoadingStatus() {
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-4 p-6"
      role="status"
    >
      <Spinner />
      <div className="flex w-full max-w-sm flex-col gap-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      <p className="text-muted-foreground text-sm">Loading reader…</p>
    </div>
  )
}

function EmptyStatus() {
  return (
    <Empty className="h-full border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconBook2 />
        </EmptyMedia>
        <EmptyTitle>No book to preview</EmptyTitle>
        <EmptyDescription>
          Provide pages or a document source to render this reader.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}

function UnsupportedStatus({
  message,
  onFallback,
  fallbackLabel,
}: {
  message?: string
  onFallback?: () => void
  fallbackLabel: string
}) {
  return (
    <Empty className="h-full">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <IconShieldOff />
        </EmptyMedia>
        <EmptyTitle>This mode is unavailable</EmptyTitle>
        <EmptyDescription>
          {message ??
            'The selected reader is not supported in this browser or source.'}
        </EmptyDescription>
      </EmptyHeader>
      {onFallback ? (
        <EmptyContent>
          <Button type="button" onClick={onFallback} data-book-preview-press>
            {fallbackLabel}
          </Button>
        </EmptyContent>
      ) : null}
    </Empty>
  )
}

function ErrorStatus({
  error,
  onRetry,
  onReload,
  onFallback,
  fallbackLabel,
}: {
  error: BookPreviewError
  onRetry?: () => void
  onReload?: () => void
  onFallback?: () => void
  fallbackLabel: string
}) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Alert variant="destructive" className="max-w-md">
        <IconAlertCircle />
        <AlertTitle>Unable to open this reader</AlertTitle>
        <AlertDescription>
          <p>{error.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {onReload && error.kind === 'engine-load' ? (
              <Button
                type="button"
                size="sm"
                onClick={onReload}
                data-book-preview-press
              >
                Reload page
              </Button>
            ) : null}
            {onRetry ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onRetry}
                data-book-preview-press
              >
                <IconLoader2 data-icon="inline-start" />
                Retry
              </Button>
            ) : null}
            {onFallback ? (
              <Button
                type="button"
                size="sm"
                variant={onReload ? 'outline' : 'default'}
                onClick={onFallback}
                data-book-preview-press
              >
                {fallbackLabel}
              </Button>
            ) : null}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}
