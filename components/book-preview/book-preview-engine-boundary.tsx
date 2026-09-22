'use client'

import type { BookPreviewError, BookPreviewMode } from './types'
import { Component, type ErrorInfo, type ReactNode } from 'react'

type BookPreviewEngineBoundaryProps = {
  engineId: BookPreviewMode | string
  resetKey?: string
  onError: (error: BookPreviewError) => void
  children: ReactNode
}

type BookPreviewEngineBoundaryState = {
  failed: boolean
  prevEngineId: BookPreviewMode | string
  prevResetKey?: string
}

export class BookPreviewEngineBoundary extends Component<
  BookPreviewEngineBoundaryProps,
  BookPreviewEngineBoundaryState
> {
  state: BookPreviewEngineBoundaryState = {
    failed: false,
    prevEngineId: this.props.engineId,
    prevResetKey: this.props.resetKey,
  }

  static getDerivedStateFromError(): Partial<BookPreviewEngineBoundaryState> {
    return { failed: true }
  }

  // A new engine or source clears the failure during render — no
  // componentDidUpdate setState round-trip.
  static getDerivedStateFromProps(
    props: BookPreviewEngineBoundaryProps,
    state: BookPreviewEngineBoundaryState,
  ): Partial<BookPreviewEngineBoundaryState> | null {
    if (
      props.engineId === state.prevEngineId &&
      props.resetKey === state.prevResetKey
    ) {
      return null
    }
    return {
      failed: false,
      prevEngineId: props.engineId,
      prevResetKey: props.resetKey,
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError({
      kind: 'page-render',
      message: 'This reader encountered an unexpected error.',
    })
    if (process.env.NODE_ENV !== 'production') {
      console.error(error, info.componentStack)
    }
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}
