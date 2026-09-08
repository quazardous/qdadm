/**
 * Route state in a cookie (#2146).
 *
 * Here because qdadm already does this — page size lives in a year-long
 * `qdadm_pageSize` cookie — and a seam that could not express what the
 * framework already does would be a seam with a hole in it.
 *
 * **Every cookie is sent on every request to your origin.** That is the whole
 * difference from web storage, and the reason this persister is shaped
 * differently: ONE cookie per scope holding a JSON blob, not one per key. A
 * list with eight filters would otherwise put eight cookies on every image,
 * script and API call the page makes.
 *
 * Which also means: keep it small, and do not reach for this when
 * `local_storage` would do. The case for a cookie is state the SERVER needs
 * to see — a rows-per-page the backend renders against, say. If the server
 * never reads it, it is paying wire cost for nothing.
 */
import type { RouteStatePersister } from './RouteStatePersister'
import { underscoreScopeLocator, type RouteStateScopeLocator } from './keyLocator'

/** The document surface this needs, so a test needs no browser. */
export interface CookieJar {
  cookie: string
}

export interface CookiePersisterOptions {
  /** Defaults to `document`. */
  jar?: CookieJar
  /** How a scope becomes a cookie name. Defaults to `qdadm_offers`. */
  scopeLocator?: RouteStateScopeLocator
  /** Lifetime in days. Defaults to 365 — what `qdadm_pageSize` already used. */
  maxAgeDays?: number
  /** `SameSite` attribute. Defaults to `Lax`. */
  sameSite?: 'Strict' | 'Lax' | 'None'
  /** Path the cookie applies to. Defaults to `/`. */
  path?: string
}

export class CookiePersister implements RouteStatePersister {
  readonly name = 'cookie'

  private readonly _jar: CookieJar
  private readonly _scopes: RouteStateScopeLocator
  private readonly _maxAgeDays: number
  private readonly _sameSite: string
  private readonly _path: string

  constructor(options: CookiePersisterOptions = {}) {
    this._jar = options.jar ?? (document as unknown as CookieJar)
    this._scopes = options.scopeLocator ?? underscoreScopeLocator
    this._maxAgeDays = options.maxAgeDays ?? 365
    this._sameSite = options.sameSite ?? 'Lax'
    this._path = options.path ?? '/'
  }

  read(scope: string): Record<string, unknown> | null {
    const raw = this._readCookie(this._scopes.encode(scope))
    if (raw === null) return null
    try {
      const parsed = JSON.parse(decodeURIComponent(raw))
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
    } catch {
      // Somebody else's cookie under our name, or a truncated one. Ignoring it
      // is right here: unlike a single key, a corrupt blob tells us nothing
      // partial worth keeping.
      return null
    }
  }

  write(scope: string, state: Record<string, unknown>): void {
    // The blob is rewritten whole, so the empty-means-absent rule is applied
    // by dropping keys rather than by removing entries.
    const kept: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(state)) {
      if (value === null || value === undefined || value === '') continue
      kept[key] = value
    }

    // Nothing left to remember: take the cookie off the wire rather than
    // shipping `{}` on every request for the next year.
    if (!Object.keys(kept).length) {
      this.clear(scope)
      return
    }

    this._writeCookie(this._scopes.encode(scope), encodeURIComponent(JSON.stringify(kept)))
  }

  clear(scope: string): void {
    const name = this._scopes.encode(scope)
    this._jar.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${this._path}; SameSite=${this._sameSite}`
  }

  private _readCookie(name: string): string | null {
    for (const part of this._jar.cookie.split(';')) {
      const separator = part.indexOf('=')
      if (separator === -1) continue
      if (part.slice(0, separator).trim() !== name) continue
      return part.slice(separator + 1)
    }
    return null
  }

  private _writeCookie(name: string, value: string): void {
    const expires = new Date(Date.now() + this._maxAgeDays * 864e5).toUTCString()
    this._jar.cookie = `${name}=${value}; expires=${expires}; path=${this._path}; SameSite=${this._sameSite}`
  }
}
