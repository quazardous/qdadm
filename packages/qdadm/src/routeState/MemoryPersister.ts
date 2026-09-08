/**
 * Route state in memory (#2146).
 *
 * Survives navigating away and back within the running app; does not survive
 * a reload, and is invisible to a link. That makes it the right answer for
 * state that would be noise anywhere else — a wizard's step, a panel a user
 * opened once — and the right answer in tests, where a shared `localStorage`
 * leaks one case into the next.
 *
 * THE STORE OUTLIVES THE PERSISTER ON PURPOSE. A list builds its persister on
 * mount; if the state lived on the instance it would die on unmount, which is
 * exactly the navigation this is supposed to survive. So the default store is
 * module-level and shared. Pass your own `store` to get an isolated one —
 * which is what a test usually wants.
 */
import type { RouteStatePersister } from './RouteStatePersister'

export type RouteStateMemoryStore = Map<string, Record<string, unknown>>

/** The shared default. See the note above on why this is module-level. */
const defaultStore: RouteStateMemoryStore = new Map()

export interface MemoryPersisterOptions {
  store?: RouteStateMemoryStore
}

export class MemoryPersister implements RouteStatePersister {
  readonly name = 'memory'

  private readonly _store: RouteStateMemoryStore

  constructor(options: MemoryPersisterOptions = {}) {
    this._store = options.store ?? defaultStore
  }

  read(scope: string): Record<string, unknown> | null {
    const stored = this._store.get(scope)
    // Copied out, so a caller mutating what it read cannot rewrite history.
    return stored ? { ...stored } : null
  }

  write(scope: string, state: Record<string, unknown>): void {
    const kept: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(state)) {
      if (value === null || value === undefined || value === '') continue
      kept[key] = value
    }
    if (!Object.keys(kept).length) this._store.delete(scope)
    else this._store.set(scope, kept)
  }

  clear(scope: string): void {
    this._store.delete(scope)
  }
}

/** Empty the shared store — for tests that use the default. */
export function clearRouteStateMemory(): void {
  defaultStore.clear()
}
