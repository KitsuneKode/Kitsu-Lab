type EditableLike = {
  tagName?: string
  isContentEditable?: boolean
  closest?: (selector: string) => unknown
}

function asElement(target: EventTarget | null): EditableLike | null {
  if (!target || typeof target !== "object") return null
  if (!("tagName" in target) && !("isContentEditable" in target)) return null
  return target as EditableLike
}

export function isEditableTarget(target: EventTarget | null): boolean {
  const element = asElement(target)
  if (!element) return false
  if (element.isContentEditable) return true
  const tag = element.tagName?.toUpperCase()
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true
  return Boolean(element.closest?.("[contenteditable='true'], [role='textbox']"))
}

const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[contenteditable='true']",
  "[role='button']",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='link']",
  "[role='menuitem']",
  "[role='option']",
  "[role='radio']",
  "[role='slider']",
  "[role='spinbutton']",
  "[role='switch']",
  "[role='tab']",
  "[role='textbox']",
].join(",")

export function isInteractiveTarget(target: EventTarget | null): boolean {
  const element = asElement(target)
  if (!element) return false
  const tag = element.tagName?.toUpperCase()
  if (tag === "A" || tag === "BUTTON" || tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
    return true
  }
  return Boolean(element.closest?.(INTERACTIVE_SELECTOR))
}

export function isReaderKeyboardEvent(
  event: KeyboardEvent,
  root: HTMLElement | null
): boolean {
  if (!root) return false
  if (isInteractiveTarget(event.target) && event.target !== root) return false
  const active = document.activeElement
  if (active instanceof HTMLElement && !root.contains(active) && active !== root) {
    return false
  }
  return root.contains(event.target instanceof Node ? event.target : null) || active === root || root.contains(active)
}
