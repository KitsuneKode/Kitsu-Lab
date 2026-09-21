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
})
