import { clampPageIndex } from './normalize'
import { capabilitiesEqual, DEFAULT_CAPABILITIES } from './capabilities'
import type {
  BookPreviewAppearance,
  BookPreviewCapabilities,
  BookPreviewContentsEntry,
  BookPreviewError,
  BookPreviewMode,
  BookPreviewStatus,
} from './types'

export type BookPreviewState = {
  mode: BookPreviewMode
  pageIndex: number
  totalPages: number
  appearance: BookPreviewAppearance
  sound: boolean
  status: BookPreviewStatus
  error: BookPreviewError | null
  capabilities: BookPreviewCapabilities
  /** Engine-supplied table of contents (e.g. a PDF outline); empty when the
      document does not provide one. */
  contents: BookPreviewContentsEntry[]
  engineEpoch: number
}

export type BookPreviewAction =
  | { type: 'hydrate'; state: Partial<BookPreviewState> }
  | { type: 'set-mode'; mode: BookPreviewMode }
  | { type: 'set-page'; pageIndex: number }
  | { type: 'next-page' }
  | { type: 'prev-page' }
  | { type: 'set-appearance'; appearance: BookPreviewAppearance }
  | { type: 'set-sound'; sound: boolean }
  | { type: 'engine-loading' }
  | {
      type: 'engine-ready'
      totalPages: number
      capabilities: BookPreviewCapabilities
      contents?: BookPreviewContentsEntry[]
    }
  | { type: 'engine-error'; error: BookPreviewError }
  | { type: 'engine-unsupported'; message: string }
  | { type: 'empty' }
  | { type: 'retry' }
  | { type: 'reset-source'; pageIndex?: number }

export function createInitialState(input: {
  mode: BookPreviewMode
  pageIndex: number
  appearance: BookPreviewAppearance
  sound: boolean
}): BookPreviewState {
  return {
    mode: input.mode,
    pageIndex: input.pageIndex,
    totalPages: 0,
    appearance: input.appearance,
    sound: input.sound,
    status: 'idle',
    error: null,
    capabilities: DEFAULT_CAPABILITIES,
    contents: [],
    engineEpoch: 0,
  }
}

function contentsEqual(
  left: BookPreviewContentsEntry[],
  right: BookPreviewContentsEntry[],
): boolean {
  if (left === right) return true
  if (left.length !== right.length) return false
  return left.every(
    (entry, index) =>
      entry.title === right[index]?.title &&
      entry.pageIndex === right[index]?.pageIndex &&
      entry.depth === right[index]?.depth,
  )
}

export function bookPreviewReducer(
  state: BookPreviewState,
  action: BookPreviewAction,
): BookPreviewState {
  switch (action.type) {
    case 'hydrate':
      return { ...state, ...action.state }
    case 'set-mode':
      if (action.mode === state.mode && state.status !== 'unsupported') {
        return state
      }
      return {
        ...state,
        mode: action.mode,
        status: 'loading',
        error: null,
        engineEpoch: state.engineEpoch + 1,
      }
    case 'set-page': {
      const pageIndex = clampPageIndex(
        action.pageIndex,
        Math.max(state.totalPages, 1),
      )
      if (pageIndex === state.pageIndex) return state
      return { ...state, pageIndex }
    }
    case 'next-page': {
      const pageIndex = clampPageIndex(state.pageIndex + 1, state.totalPages)
      if (pageIndex === state.pageIndex) return state
      return { ...state, pageIndex }
    }
    case 'prev-page': {
      const pageIndex = clampPageIndex(state.pageIndex - 1, state.totalPages)
      if (pageIndex === state.pageIndex) return state
      return { ...state, pageIndex }
    }
    case 'set-appearance':
      if (action.appearance === state.appearance) return state
      return { ...state, appearance: action.appearance }
    case 'set-sound':
      if (action.sound === state.sound) return state
      return { ...state, sound: action.sound }
    case 'engine-loading':
      if (state.status === 'loading' && state.error === null) return state
      return { ...state, status: 'loading', error: null }
    case 'engine-ready': {
      const totalPages = Math.max(0, action.totalPages)
      const status = 'ready'
      const pageIndex = clampPageIndex(state.pageIndex, totalPages)
      const contents = action.contents ?? []
      if (
        state.status === status &&
        state.error === null &&
        state.totalPages === totalPages &&
        state.pageIndex === pageIndex &&
        contentsEqual(state.contents, contents) &&
        capabilitiesEqual(state.capabilities, action.capabilities)
      ) {
        return state
      }
      return {
        ...state,
        status,
        error: null,
        totalPages,
        pageIndex,
        capabilities: action.capabilities,
        // Reuse the previous array when nothing changed so subscribers are
        // not re-rendered by repeated ready reports.
        contents: contentsEqual(state.contents, contents)
          ? state.contents
          : contents,
      }
    }
    case 'engine-error':
      return {
        ...state,
        status: 'error',
        error: action.error,
      }
    case 'engine-unsupported':
      return {
        ...state,
        status: 'unsupported',
        error: { kind: 'unsupported', message: action.message },
      }
    case 'empty':
      return {
        ...state,
        status: 'empty',
        error: {
          kind: 'empty',
          message: 'No pages or document are available to preview.',
        },
        totalPages: 0,
        pageIndex: 0,
        contents: [],
      }
    case 'retry':
      return {
        ...state,
        status: 'loading',
        error: null,
        engineEpoch: state.engineEpoch + 1,
      }
    case 'reset-source':
      return {
        ...state,
        pageIndex: action.pageIndex ?? 0,
        totalPages: 0,
        status: 'loading',
        error: null,
        contents: [],
      }
    default:
      return state
  }
}
