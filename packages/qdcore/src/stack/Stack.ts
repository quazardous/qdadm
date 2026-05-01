/**
 * Stack<L> - Generic synchronous navigation context.
 *
 * Holds an ordered list of {@link ContentStackLevel} entries and emits
 * `stack:change` on the injected {@link SignalBus} whenever the levels change.
 *
 * This class is intentionally vanilla: no Vue reactivity, no router coupling.
 * Consumers wrap it (e.g. qdadm `ActiveStack`) to add domain-specific
 * behaviour like building from `route.meta`.
 *
 * Equality is checked by `(type, name, id)` tuple per level — this matches
 * qdadm's historical contract and is sufficient for navigation context.
 * Pass an `equals` option in the constructor to override.
 */

import type { SignalBus } from '../signal/SignalBus'
import type { ContentStackLevel, StackChangePayload } from './types'

export interface StackOptions<L extends ContentStackLevel> {
  /** Signal name emitted on change. Defaults to `'stack:change'`. */
  changeSignal?: string
  /** Custom equality check. Defaults to comparing `(type, name, id)` of each level. */
  equals?: (a: L[], b: L[]) => boolean
}

const defaultEquals = <L extends ContentStackLevel>(a: L[], b: L[]): boolean => {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]
    const bi = b[i]
    if (!ai || !bi) continue
    if (ai.type !== bi.type || ai.name !== bi.name || (ai.id ?? null) !== (bi.id ?? null)) {
      return false
    }
  }
  return true
}

export class Stack<L extends ContentStackLevel = ContentStackLevel> {
  private _levels: L[] = []
  private _signalBus: SignalBus | null
  private _changeSignal: string
  private _equals: (a: L[], b: L[]) => boolean

  constructor(signalBus: SignalBus | null = null, options: StackOptions<L> = {}) {
    this._signalBus = signalBus
    this._changeSignal = options.changeSignal ?? 'stack:change'
    this._equals = options.equals ?? defaultEquals
  }

  // ─── Mutators ─────────────────────────────────────────────────────────────

  /** Replace the entire stack. No-op (no emission) if levels are unchanged. */
  set(levels: L[]): void {
    if (this._equals(this._levels, levels)) return
    this._levels = levels
    this._emitChange()
  }

  /** Clear the stack. No-op if already empty. */
  clear(): void {
    if (this._levels.length === 0) return
    this._levels = []
    this._emitChange()
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  getLevels(): L[] {
    return this._levels
  }

  getLevel(index: number): L | null {
    return this._levels[index] ?? null
  }

  getCurrent(): L | null {
    return this._levels.at(-1) ?? null
  }

  getParent(): L | null {
    return this._levels.at(-2) ?? null
  }

  getRoot(): L | null {
    return this._levels[0] ?? null
  }

  getDepth(): number {
    return this._levels.length
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _emitChange(): void {
    if (!this._signalBus) return
    const payload: StackChangePayload<L> = { levels: this._levels }
    this._signalBus.emit(this._changeSignal, payload)
  }
}

export default Stack
