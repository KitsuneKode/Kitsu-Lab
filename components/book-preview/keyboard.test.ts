import { describe, expect, test } from "bun:test"
import { isEditableTarget, isInteractiveTarget } from "./keyboard"

function fake(tagName: string, extra: Record<string, unknown> = {}) {
  return {
    tagName,
    isContentEditable: false,
    closest: () => null,
    ...extra,
  } as unknown as EventTarget
}

describe("isEditableTarget", () => {
  test("treats inputs, textareas, selects, and contenteditable nodes as editable", () => {
    expect(isEditableTarget(fake("INPUT"))).toBe(true)
    expect(isEditableTarget(fake("TEXTAREA"))).toBe(true)
    expect(isEditableTarget(fake("SELECT"))).toBe(true)
    expect(isEditableTarget(fake("DIV", { isContentEditable: true }))).toBe(true)
    expect(isEditableTarget(fake("BUTTON"))).toBe(false)
  })
})

describe("isInteractiveTarget", () => {
  test("protects native and ARIA widgets from reader shortcuts", () => {
    expect(isInteractiveTarget(fake("BUTTON"))).toBe(true)
    expect(isInteractiveTarget(fake("A"))).toBe(true)
    expect(isInteractiveTarget(fake("DIV", { closest: () => ({ role: "slider" }) }))).toBe(true)
    expect(isInteractiveTarget(fake("DIV"))).toBe(false)
  })
})
