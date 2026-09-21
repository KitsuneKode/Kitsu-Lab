"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import type { BookPreviewError, BookPreviewMode } from "./types"

type BookPreviewEngineBoundaryProps = {
  engineId: BookPreviewMode | string
  resetKey?: string
  onError: (error: BookPreviewError) => void
  children: ReactNode
}

type BookPreviewEngineBoundaryState = {
  failed: boolean
}

export class BookPreviewEngineBoundary extends Component<
  BookPreviewEngineBoundaryProps,
  BookPreviewEngineBoundaryState
> {
  state: BookPreviewEngineBoundaryState = { failed: false }

  static getDerivedStateFromError(): BookPreviewEngineBoundaryState {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError({
      kind: "page-render",
      message: "This reader encountered an unexpected error.",
    })
    if (process.env.NODE_ENV !== "production") {
      console.error(error, info.componentStack)
    }
  }

  componentDidUpdate(prevProps: BookPreviewEngineBoundaryProps) {
    const engineChanged = prevProps.engineId !== this.props.engineId
    const sourceChanged = prevProps.resetKey !== this.props.resetKey
    if ((engineChanged || sourceChanged) && this.state.failed) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) return null
    return this.props.children
  }
}
