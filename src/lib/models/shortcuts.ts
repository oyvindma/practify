export type ShortcutAction =
  | 'togglePlay'
  | 'restart'
  | 'skipBack'
  | 'skipForward'
  | 'setLoopStart'
  | 'setLoopEnd'
  | 'selectPreviousLoop'
  | 'selectNextLoop'
  | 'playSelectedLoop'
  | 'nextTrack'
  | 'previousTrack'
  | 'toggleHelp'
  | 'closeHelp'

export interface KeyPress {
  key: string
  isRepeat: boolean
  hasCommandModifier: boolean
  isTextEntry: boolean
  // A button or link reached with the keyboard: Space and Enter belong to it
  isKeyboardFocusedControl: boolean
}

export const SKIP_MS = 5000

const ACTIONS_BY_KEY: Record<string, ShortcutAction> = {
  ' ': 'togglePlay',
  r: 'restart',
  ArrowLeft: 'skipBack',
  ArrowRight: 'skipForward',
  '1': 'setLoopStart',
  '2': 'setLoopEnd',
  ArrowUp: 'selectPreviousLoop',
  ArrowDown: 'selectNextLoop',
  Enter: 'playSelectedLoop',
  n: 'nextTrack',
  p: 'previousTrack',
  '?': 'toggleHelp',
  Escape: 'closeHelp',
}

const REPEATABLE_ACTIONS: ShortcutAction[] = [
  'skipBack',
  'skipForward',
  'selectPreviousLoop',
  'selectNextLoop',
]

export function resolveShortcut(press: KeyPress): ShortcutAction | null {
  if (press.hasCommandModifier || press.isTextEntry) return null
  const isActivationKey = press.key === ' ' || press.key === 'Enter'
  if (isActivationKey && press.isKeyboardFocusedControl) return null

  const action = ACTIONS_BY_KEY[press.key.length === 1 ? press.key.toLowerCase() : press.key]
  if (!action) return null
  if (press.isRepeat && !REPEATABLE_ACTIONS.includes(action)) return null
  return action
}

export interface ShortcutHelpEntry {
  keys: string[]
  description: string
}

export const SHORTCUT_HELP: ShortcutHelpEntry[] = [
  { keys: ['Mellomrom'], description: 'Spill av / pause (i stille modus: start / stopp)' },
  { keys: ['R'], description: 'Start på nytt fra loop, valgt tekstlinje eller begynnelsen' },
  { keys: ['←', '→'], description: 'Hopp 5 sekunder bakover / forover uten å stoppe' },
  { keys: ['1', '2'], description: 'Sett start / slutt for ny loop til nåværende posisjon' },
  { keys: ['↑', '↓'], description: 'Velg forrige / neste loop' },
  { keys: ['Enter'], description: 'Start den valgte loopen' },
  { keys: ['N'], description: 'Neste låt (stille modus fortsetter uten å spille av)' },
  { keys: ['P'], description: 'Til begynnelsen av låten, trykk igjen raskt for forrige låt' },
  { keys: ['?'], description: 'Vis / skjul denne oversikten' },
]
