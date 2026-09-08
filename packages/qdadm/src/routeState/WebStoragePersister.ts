/**
 * Route state in `localStorage` or `sessionStorage` (#2146).
 *
 * The medium you pick when the state is worth keeping but not worth putting
 * in a link: a back-office list somebody returns to twenty times a day, whose
 * URL nobody ever sends anyone.
 *
 * ONE ENTRY PER KEY, namespaced — `qdadm:offers:page`. Not one JSON blob per
 * scope, because web storage is shared with everything else the app keeps
 * there, and per-key namespacing is what lets this persister pick out its own
 * entries without owning the medium. It also means devtools shows you
 * readable state instead of a blob to decode by hand.
 *
 * VALUES ARE JSON, so they come back exactly as they went in. That differs
 * from `UrlPersister`, which coerces (`'42'` reads back as the number 42)
 * because a query string is meant to be read by people. A list moved from one
 * to the other can therefore see a filter value change TYPE — worth knowing
 * before you switch a screen that compares with `===`.
 */
import type { RouteStatePersister } from './RouteStatePersister'
import { namespacedKeyLocator, type RouteStateKeyLocator } from './keyLocator'

/** The bit of the Storage API this needs, so a test needs no browser. */
export interface RouteStateStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  readonly length: number
  key(index: number): string | null
}

export interface WebStoragePersisterOptions {
  /** `window.localStorage` or `window.sessionStorage`, or a stand-in. */
  storage: RouteStateStorage
  /** For diagnostics — which medium answered. */
  name?: string
  /** How a (scope, key) pair becomes a storage key. Defaults to `qdadm:scope:key`. */
  keyLocator?: RouteStateKeyLocator
}

export class WebStoragePersister implements RouteStatePersister {
  readonly name: string

  private readonly _storage: RouteStateStorage
  private readonly _keys: RouteStateKeyLocator
  private _warned = false

  constructor(options: WebStoragePersisterOptions) {
    this._storage = options.storage
    this._keys = options.keyLocator ?? namespacedKeyLocator
    this.name = options.name ?? 'web-storage'
  }

  /**
   * Web storage throws rather than returning null in more situations than
   * people expect: Safari's private mode, a browser set to block site data,
   * a quota that filled up.
   *
   * We warn ONCE and carry on with the screen working. That is not the silent
   * no-op [ADR 0011](../../docs/adr/0011-no-silent-no-ops.md) forbids — the
   * failure is announced, and it is the environment's, not a mistake in the
   * app's configuration. Taking the list down because a page number could not
   * be remembered would be the worse trade.
   */
  private _guard<T>(operation: () => T, fallback: T): T {
    try {
      return operation()
    } catch (error) {
      if (!this._warned) {
        this._warned = true
        console.warn(
          `[qdadm] Route-state persister "${this.name}" cannot reach its storage; ` +
            `this screen will not remember its state. ` +
            `Usually private browsing, blocked site data, or a full quota.`,
          error
        )
      }
      return fallback
    }
  }

  read(scope: string): Record<string, unknown> | null {
    return this._guard(() => {
      const state: Record<string, unknown> = {}
      let found = false

      for (const storedKey of this._ownKeys(scope)) {
        const key = this._keys.decode(scope, storedKey)
        if (key === null) continue
        const raw = this._storage.getItem(storedKey)
        if (raw === null) continue
        found = true
        state[key] = decode(raw)
      }

      return found ? state : null
    }, null)
  }

  write(scope: string, state: Record<string, unknown>): void {
    this._guard(() => {
      for (const [key, value] of Object.entries(state)) {
        const storedKey = this._keys.encode(scope, key)
        // Absent, not stored empty — the same rule every persister follows,
        // so a pristine screen leaves no trace whichever medium it uses.
        if (value === null || value === undefined || value === '') {
          this._storage.removeItem(storedKey)
        } else {
          this._storage.setItem(storedKey, JSON.stringify(value))
        }
      }
    }, undefined)
  }

  clear(scope: string): void {
    this._guard(() => {
      for (const storedKey of this._ownKeys(scope)) {
        if (this._keys.decode(scope, storedKey) !== null) this._storage.removeItem(storedKey)
      }
    }, undefined)
  }

  /**
   * Snapshot the key names before touching anything.
   *
   * `Storage.key(i)` walks a live collection: removing as you iterate
   * renumbers what is left and skips entries. Reading the names first is the
   * difference between clearing a scope and clearing every other one of it.
   */
  private _ownKeys(scope: string): string[] {
    const keys: string[] = []
    for (let i = 0; i < this._storage.length; i++) {
      const key = this._storage.key(i)
      if (key !== null && this._keys.decode(scope, key) !== null) keys.push(key)
    }
    return keys
  }
}

function decode(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    // Written by something other than us, or truncated. Hand back the string
    // rather than dropping the key: a readable wrong value beats a silent
    // absent one.
    return raw
  }
}
