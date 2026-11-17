import type { KeyPress } from '$lib/models/shortcuts'

const TEXT_INPUT_TYPES = ['text', 'number', 'search', 'email', 'url', 'tel', 'password']

function isTextEntry(target: HTMLElement | null): boolean {
  if (!target) return false
  if (target.isContentEditable) return true
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true
  return target instanceof HTMLInputElement && TEXT_INPUT_TYPES.includes(target.type)
}

function isKeyboardFocused(target: HTMLElement): boolean {
  try {
    return target.matches(':focus-visible')
  } catch {
    return false
  }
}

function isKeyboardFocusedControl(target: HTMLElement | null): boolean {
  const control = target?.closest('button, a[href], summary, [role="button"]')
  return control instanceof HTMLElement && isKeyboardFocused(control)
}

export function toKeyPress(event: KeyboardEvent): KeyPress {
  const target = event.target instanceof HTMLElement ? event.target : null
  return {
    key: event.key,
    isRepeat: event.repeat,
    hasCommandModifier: event.ctrlKey || event.metaKey || event.altKey,
    isTextEntry: isTextEntry(target),
    isKeyboardFocusedControl: isKeyboardFocusedControl(target),
  }
}
