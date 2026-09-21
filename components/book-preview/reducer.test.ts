import { describe, expect, test } from "bun:test"
import { bookPreviewReducer, createInitialState } from "./reducer"

const start = createInitialState({
  mode: "page",
  pageIndex: 0,
  appearance: "system",
  sound: false,
})

describe("bookPreviewReducer", () => {
  test("clamps page navigation to the known total", () => {
    const ready = bookPreviewReducer(start, {
      type: "engine-ready",
      totalPages: 3,
      capabilities: start.capabilities,
    })
    const overflow = bookPreviewReducer(ready, { type: "set-page", pageIndex: 40 })
    expect(overflow.pageIndex).toBe(2)
    const next = bookPreviewReducer(overflow, { type: "next-page" })
    expect(next.pageIndex).toBe(2)
    const prev = bookPreviewReducer(ready, { type: "prev-page" })
    expect(prev.pageIndex).toBe(0)
  })

  test("resets engine state when the source changes", () => {
    const ready = bookPreviewReducer(start, {
      type: "engine-ready",
      totalPages: 8,
      capabilities: start.capabilities,
    })
    const reset = bookPreviewReducer(ready, { type: "reset-source", pageIndex: 1 })
    expect(reset.pageIndex).toBe(1)
    expect(reset.status).toBe("loading")
    expect(reset.engineEpoch).toBe(ready.engineEpoch)
  })

  test("marks empty and unsupported states without throwing", () => {
    const empty = bookPreviewReducer(start, { type: "empty" })
    expect(empty.status).toBe("empty")
    const unsupported = bookPreviewReducer(start, {
      type: "engine-unsupported",
      message: "WebGL is unavailable",
    })
    expect(unsupported.status).toBe("unsupported")
    expect(unsupported.error?.kind).toBe("unsupported")
  })

  test("engine-ready is idempotent when totals and capabilities match", () => {
    const ready = bookPreviewReducer(start, {
      type: "engine-ready",
      totalPages: 7,
      capabilities: start.capabilities,
    })
    const again = bookPreviewReducer(ready, {
      type: "engine-ready",
      totalPages: 7,
      capabilities: { ...start.capabilities },
    })
    expect(again).toBe(ready)
  })

  test("keeps an upload-capable zero-page engine ready for user input", () => {
    const ready = bookPreviewReducer(start, {
      type: "engine-ready",
      totalPages: 0,
      capabilities: { ...start.capabilities, upload: true },
    })
    expect(ready.status).toBe("ready")
    expect(ready.totalPages).toBe(0)
  })

  test("changes mode and starts a new engine epoch", () => {
    const next = bookPreviewReducer(start, { type: "set-mode", mode: "pdf" })
    expect(next.mode).toBe("pdf")
    expect(next.status).toBe("loading")
    expect(next.engineEpoch).toBe(start.engineEpoch + 1)
  })

  test("stores engine-supplied contents and clears them on source reset", () => {
    const contents = [
      { title: "Chapter 1", pageIndex: 0, depth: 0 },
      { title: "Section 1.1", pageIndex: 3, depth: 1 },
    ]
    const ready = bookPreviewReducer(start, {
      type: "engine-ready",
      totalPages: 9,
      capabilities: start.capabilities,
      contents,
    })
    expect(ready.contents).toHaveLength(2)
    // A repeated ready report with equal contents reuses the same array so
    // subscribers do not re-render.
    const again = bookPreviewReducer(ready, {
      type: "engine-ready",
      totalPages: 9,
      capabilities: start.capabilities,
      contents: contents.map((entry) => ({ ...entry })),
    })
    expect(again).toBe(ready)
    const reset = bookPreviewReducer(ready, { type: "reset-source" })
    expect(reset.contents).toHaveLength(0)
  })

  test("ready without contents empties a previous outline", () => {
    const withOutline = bookPreviewReducer(start, {
      type: "engine-ready",
      totalPages: 4,
      capabilities: start.capabilities,
      contents: [{ title: "A", pageIndex: 1, depth: 0 }],
    })
    const without = bookPreviewReducer(withOutline, {
      type: "engine-ready",
      totalPages: 4,
      capabilities: start.capabilities,
    })
    expect(without.contents).toHaveLength(0)
  })
})
