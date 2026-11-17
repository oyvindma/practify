import { describe, it, expect, afterEach } from 'vitest'
import { toKeyPress } from '../keyPress'

type KeyInit = ConstructorParameters<typeof KeyboardEvent>[1]

function keydownOn(element: HTMLElement, init: KeyInit = {}): KeyboardEvent {
  document.body.appendChild(element)
  let captured: KeyboardEvent | null = null
  element.addEventListener('keydown', (e) => (captured = e))
  element.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  return captured!
}

afterEach(() => (document.body.innerHTML = ''))

describe('toKeyPress', () => {
  it('copies the key and repeat flag', () => {
    const press = toKeyPress(keydownOn(document.createElement('div'), { key: 'n', repeat: true }))
    expect(press).toMatchObject({ key: 'n', isRepeat: true })
  })

  it('flags ctrl, meta and alt as command modifiers but not shift', () => {
    const div = document.createElement('div')
    expect(toKeyPress(keydownOn(div, { key: 'r', ctrlKey: true })).hasCommandModifier).toBe(true)
    expect(toKeyPress(keydownOn(div, { key: 'r', metaKey: true })).hasCommandModifier).toBe(true)
    expect(toKeyPress(keydownOn(div, { key: 'r', altKey: true })).hasCommandModifier).toBe(true)
    expect(toKeyPress(keydownOn(div, { key: '?', shiftKey: true })).hasCommandModifier).toBe(false)
  })

  it('treats text-like inputs, textareas and selects as text entry', () => {
    for (const type of ['text', 'number']) {
      const input = document.createElement('input')
      input.type = type
      expect(toKeyPress(keydownOn(input, { key: '1' })).isTextEntry).toBe(true)
    }
    expect(
      toKeyPress(keydownOn(document.createElement('textarea'), { key: '1' })).isTextEntry,
    ).toBe(true)
    expect(toKeyPress(keydownOn(document.createElement('select'), { key: '1' })).isTextEntry).toBe(
      true,
    )
  })

  it('does not treat the seek slider or buttons as text entry', () => {
    const slider = document.createElement('input')
    slider.type = 'range'
    expect(toKeyPress(keydownOn(slider, { key: 'ArrowRight' })).isTextEntry).toBe(false)
    expect(toKeyPress(keydownOn(document.createElement('button'), { key: ' ' })).isTextEntry).toBe(
      false,
    )
  })

  it('does not flag plain elements as keyboard-focused controls', () => {
    const press = toKeyPress(keydownOn(document.createElement('div'), { key: ' ' }))
    expect(press.isKeyboardFocusedControl).toBe(false)
  })
})
