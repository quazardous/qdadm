/**
 * Generic navigation/content stack primitives.
 *
 * A "stack" represents the current navigation context as an ordered chain of
 * semantic levels derived from the URL (or any equivalent navigation event).
 *
 * Examples:
 *  - qdcms: `[{ type: 'collection', name: 'events' }, { type: 'item', name: 'events', id: '42' }]`
 *  - qdadm: `[{ type: 'entity', name: 'bots', id: 'bot-xyz' }, { type: 'entity', name: 'commands', id: 'cmd-1' }]`
 *
 * Consumers extend `ContentStackLevel` to add domain-specific fields
 * (e.g. `EntityStackLevel` in qdadm with `param`/`foreignKey`).
 */

/**
 * Base shape for a stack level. Aligned with qdcms `ContentStackLevel`.
 *
 * Suggested values for `type` are project-defined. Common qdcms types:
 *   - `'collection'` — a list of an entity
 *   - `'item'`       — a single item of an entity (with id)
 *   - `'page'`       — a static-ish page
 *   - `'view'`       — a specific view (calendar, map…)
 *   - `'custom'`     — anything project-specific
 *
 * qdadm uses `'entity'` for CRUD-managed levels.
 */
export interface ContentStackLevel {
  type: string
  name: string
  id?: string | null
  params?: Record<string, unknown>
}

/**
 * Payload of the `stack:change` signal emitted by {@link Stack}.
 */
export interface StackChangePayload<L extends ContentStackLevel = ContentStackLevel> {
  levels: L[]
}

/**
 * A StackBuilder turns a navigation event into the complete active stack.
 * The shape of `Input` is consumer-defined (qdadm passes `{ route }`,
 * qdcms passes `{ route, params, ... }`).
 */
export type StackBuilder<L extends ContentStackLevel = ContentStackLevel, Input = unknown> = (
  input: Input
) => L[] | Promise<L[]>

/**
 * A Hydrator enriches each level with async data (entity record, label, etc.).
 *
 * qdadm's `StackHydrator` implements this for `EntityStackLevel`, fetching the
 * record via the orchestrator and resolving a display label.
 *
 * The interface is intentionally minimal — concrete hydrated types live in the
 * consuming package (qdadm exports `HydratedLevel`).
 */
export interface Hydrator<L extends ContentStackLevel = ContentStackLevel, H = unknown> {
  /** Cleanup any subscriptions held by this hydrator. */
  destroy(): void
  /** All hydrated levels in the order they appear on the stack. */
  getLevels(): H[]
  /** Hydrated level at the given index, or null. */
  getLevel(index: number): H | null
  /** Current (deepest) hydrated level. */
  getCurrent(): H | null
  /** Parent (one above current) hydrated level. */
  getParent(): H | null
  /** Root (topmost) hydrated level. */
  getRoot(): H | null
  /** Marker for tooling — narrows L for inference. */
  readonly _level?: L
}
