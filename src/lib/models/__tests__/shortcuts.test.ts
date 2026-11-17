import { describe, it, expect } from 'vitest'
import { SHORTCUT_HELP, resolveShortcut, type KeyPress } from '../shortcuts'

function press(key: string, overrides: Partial<KeyPress> = {}): KeyPress {
  return {
    key,
    isRepeat: false,
    hasCommandModifier: false,
    isTextEntry: false,
    isKeyboardFocusedControl: false,
    ...overrides,
  }
}

describe('resolveShortcut', () => {
  it.each([
    [' ', 'togglePlay'],
    ['r', 'restart'],
    ['ArrowLeft', 'skipBack'],
    ['ArrowRight', 'skipForward'],
    ['1', 'setLoopStart'],
    ['2', 'setLoopEnd'],
    ['ArrowUp', 'selectPreviousLoop'],
    ['ArrowDown', 'selectNextLoop'],
    ['Enter', 'playSelectedLoop'],
    ['n', 'nextTrack'],
    ['p', 'previousTrack'],
    ['?', 'toggleHelp'],
    ['Escape', 'closeHelp'],
  ])('maps %j to %s', (key, action) => {
    expect(resolveShortcut(press(key))).toBe(action)
  })

  it('ignores letter case', () => {
    expect(resolveShortcut(press('R'))).toBe('restart')
    expect(resolveShortcut(press('N'))).toBe('nextTrack')
  })

  it('ignores unknown keys', () => {
    expect(resolveShortcut(press('x'))).toBeNull()
    expect(resolveShortcut(press('Tab'))).toBeNull()
  })

  it('leaves browser and OS shortcuts alone', () => {
    expect(resolveShortcut(press('r', { hasCommandModifier: true }))).toBeNull()
  })

  it('does not act while typing', () => {
    expect(resolveShortcut(press('1', { isTextEntry: true }))).toBeNull()
    expect(resolveShortcut(press(' ', { isTextEntry: true }))).toBeNull()
  })

  it('lets a keyboard-focused button keep Space and Enter but not other keys', () => {
    expect(resolveShortcut(press(' ', { isKeyboardFocusedControl: true }))).toBeNull()
    expect(resolveShortcut(press('Enter', { isKeyboardFocusedControl: true }))).toBeNull()
    expect(resolveShortcut(press('ArrowRight', { isKeyboardFocusedControl: true }))).toBe(
      'skipForward',
    )
  })

  it('repeats arrows but not one-shot actions', () => {
    expect(resolveShortcut(press('ArrowRight', { isRepeat: true }))).toBe('skipForward')
    expect(resolveShortcut(press('ArrowDown', { isRepeat: true }))).toBe('selectNextLoop')
    expect(resolveShortcut(press(' ', { isRepeat: true }))).toBeNull()
    expect(resolveShortcut(press('n', { isRepeat: true }))).toBeNull()
    expect(resolveShortcut(press('Enter', { isRepeat: true }))).toBeNull()
  })
})

describe('SHORTCUT_HELP', () => {
  it('documents every shortcut key', () => {
    const documented = SHORTCUT_HELP.flatMap((entry) => entry.keys)
    expect(documented).toEqual(
      expect.arrayContaining([
        'Mellomrom',
        'R',
        '←',
        '→',
        '1',
        '2',
        '↑',
        '↓',
        'Enter',
        'N',
        'P',
        '?',
      ]),
    )
  })
})
