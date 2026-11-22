/**
 * The run bar's keys (#5454): resolved run over app over defaults, matched
 * against a keydown, shown on the buttons and in aria-keyshortcuts.
 */
import type { RunKeys } from './run'

export type RunKeyAction = 'prev' | 'next' | 'back'
export const RUN_KEY_ACTIONS: RunKeyAction[] = ['prev', 'next', 'back']

/** J previous, K next: left and right on the keyboard, as the bar reads */
export const DEFAULT_RUN_KEYS: Required<RunKeys> = { prev: 'j', next: 'k', back: 'l' }

/** Each action's key, or null for none: the run's, else the app's, else the default */
export function resolveRunKeys(run?: RunKeys | null, app?: RunKeys | null): Record<RunKeyAction, string | null> {
  const out = {} as Record<RunKeyAction, string | null>
  for (const action of RUN_KEY_ACTIONS) {
    const own = run?.[action]
    const shared = app?.[action]
    const key = own !== undefined ? own : shared !== undefined ? shared : DEFAULT_RUN_KEYS[action]
    out[action] = typeof key === 'string' && key ? key : null
  }
  return out
}

/** A key as a keydown compares it: letters in either case */
const norm = (key: string): string => key.toLowerCase()

/** The action a keydown asks for; on a key given twice, the first action wins (prev, next, back) */
export function runKeyAction(keys: Record<RunKeyAction, string | null>, pressed: string): RunKeyAction | null {
  const p = norm(pressed)
  return RUN_KEY_ACTIONS.find((a) => keys[a] !== null && norm(keys[a]!) === p) ?? null
}

/** Keys given to two actions, for a warning */
export function duplicateRunKeys(keys: Record<RunKeyAction, string | null>): string[] {
  const seen = new Map<string, RunKeyAction>()
  const twice: string[] = []
  for (const a of RUN_KEY_ACTIONS) {
    const k = keys[a]
    if (k === null) continue
    if (seen.has(norm(k))) twice.push(k)
    else seen.set(norm(k), a)
  }
  return twice
}

const GLYPHS: Record<string, string> = { arrowleft: '←', arrowright: '→', arrowup: '↑', arrowdown: '↓', ' ': '␣' }

/** The key as its hint on the button: a letter upper-cased, the arrows as glyphs, other keys by name */
export function runKeyHint(key: string): string {
  return GLYPHS[norm(key)] ?? (key.length === 1 ? key.toUpperCase() : key)
}

/** The key in aria-keyshortcuts' terms: a letter upper-cased, Space, other keys by their name */
export function runKeyShortcut(key: string): string {
  if (key === ' ') return 'Space'
  return key.length === 1 ? key.toUpperCase() : key
}
