/**
 * Route state remembered nowhere (#2146).
 *
 * The way to say "this screen forgets" and have it read as a decision. An
 * embedded list inside a detail view, a picker in a dialog, a preview — none
 * of them should put anything in the address bar, and none of them should
 * leave anything behind.
 *
 * A no-op object looks like the thing
 * [ADR 0011](../../docs/adr/0011-no-silent-no-ops.md) forbids, and the
 * difference is the whole point: this one is NAMED. Nothing falls back to it,
 * nothing resolves to it by accident, and an unknown slug throws rather than
 * landing here. It does nothing because somebody wrote `routeState: 'none'`,
 * and that sentence is in the app's source where the next reader will find
 * it.
 */
import type { RouteStatePersister } from './RouteStatePersister'

export class NullPersister implements RouteStatePersister {
  readonly name = 'none'

  read(): null {
    return null
  }

  write(): void {
    /* deliberately nothing — see the note above */
  }

  clear(): void {
    /* deliberately nothing */
  }
}
