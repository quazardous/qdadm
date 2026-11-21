/**
 * A list's session-kept state under a key of its own (#5440).
 *
 * The default composition keeps `sort` and `sortOrder` in `sessionStorage`
 * under the list's scope, the entity: every list of one entity shares them.
 * With a `sessionKey`, those keys are read and written under it instead,
 * while everything else (the URL's `tasks.universe`, `tasks.page`) keeps the
 * entity's scope, so links do not change. The entity's own sort is written
 * back as it was, never erased by this list.
 */
import type { RouteStatePersister } from './RouteStatePersister'
import { WebStoragePersister, type RouteStateStorage } from './WebStoragePersister'

const SESSION_KEYS = ['sort', 'sortOrder'] as const

const pick = (state: Record<string, unknown> | null, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((k) => [k, state?.[k]]))
const omit = (state: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(Object.entries(state).filter(([k]) => !keys.includes(k)))

export function sessionScopedPersister(
  base: RouteStatePersister,
  sessionKey: string,
  storage: RouteStateStorage | undefined = globalThis.sessionStorage
): RouteStatePersister {
  const session = new WebStoragePersister({ storage: storage as RouteStateStorage, name: 'session_storage' })
  return {
    name: `${base.name}+session(${sessionKey})`,
    read(scope) {
      const shared = base.read(scope)
      const own = session.read(sessionKey)
      const state = shared ? omit(shared, SESSION_KEYS) : {}
      for (const k of SESSION_KEYS) if (own?.[k] !== undefined) state[k] = own[k]
      return shared || own ? state : null
    },
    write(scope, state) {
      // The entity's own sort, written back as it was
      base.write(scope, { ...omit(state, SESSION_KEYS), ...pick(base.read(scope), SESSION_KEYS) })
      session.write(sessionKey, pick(state, SESSION_KEYS))
    },
    clear(scope) {
      // Clearing this list leaves the entity's own sort where it was
      const shared = pick(base.read(scope), SESSION_KEYS)
      base.clear(scope)
      if (SESSION_KEYS.some((k) => shared[k] !== undefined)) base.write(scope, shared)
      session.clear(sessionKey)
    },
  }
}
