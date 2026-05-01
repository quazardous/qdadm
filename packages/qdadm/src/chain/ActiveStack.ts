/**
 * ActiveStack - Sync navigation context from route (qdadm flavour).
 *
 * Composes a generic `Stack<EntityStackLevel>` from `@quazardous/qdcore` and
 * adds qdadm-specific lookups (e.g. `getLevelByEntity`). The underlying levels
 * dual-carry `name` (qdcore-aligned) and `entity` (legacy qdadm field), so all
 * existing consumers continue to read `level.entity` unchanged.
 *
 * Stack only contains levels WITH IDs (entities with context).
 * - /bots/bot-xyz/commands → stack = [bots(id:bot-xyz)]
 * - /bots/bot-xyz/commands/cmd-123 → stack = [bots(id:bot-xyz), commands(id:cmd-123)]
 *
 * Signals emitted (via SignalBus):
 * - stack:change — when stack levels change
 *
 * For Vue reactivity, use the `useActiveStack` composable.
 *
 * @example
 * const stack = new ActiveStack(signalBus)
 * signalBus.on('stack:change', ({ levels }) => console.log('Stack:', levels))
 * stack.set([{ entity: 'bots', param: 'uuid', foreignKey: null, id: 'bot-123' }])
 */

import { Stack, type ContentStackLevel } from '@quazardous/qdcore'
import type { SignalBus } from '../kernel/SignalBus'

/**
 * qdadm stack level: entity-bound `ContentStackLevel`.
 *
 * `name` and `entity` always carry the same value. `name` is the qdcore-canonical
 * field; `entity` is preserved for backwards compatibility with qdadm callers.
 */
export interface EntityStackLevel extends ContentStackLevel {
  type: 'entity'
  /** qdcore-aligned name (= entity) */
  name: string
  /** Entity name (e.g., 'bots', 'commands') — alias of `name` */
  entity: string
  /** Route param name (e.g., 'uuid', 'id') */
  param: string
  /** Foreign key field for parent relation (null for root) */
  foreignKey: string | null
  /** Entity ID from route params */
  id: string | null
}

/**
 * Legacy alias kept for backwards compatibility. New code should prefer
 * {@link EntityStackLevel}.
 */
export type StackLevel = EntityStackLevel

/**
 * Input shape accepted by {@link ActiveStack.set} — `name` is optional and
 * defaults to `entity` so existing callers (`{ entity, param, foreignKey, id }`)
 * keep working without changes.
 */
export type EntityStackLevelInput = Omit<EntityStackLevel, 'type' | 'name'> & {
  type?: 'entity'
  name?: string
}

/**
 * Stack change event payload
 */
export interface StackChangePayload {
  levels: EntityStackLevel[]
}

/**
 * Normalize loose input into a fully-typed EntityStackLevel.
 */
function normalize(input: EntityStackLevelInput): EntityStackLevel {
  return {
    type: 'entity',
    name: input.name ?? input.entity,
    entity: input.entity,
    param: input.param,
    foreignKey: input.foreignKey,
    id: input.id,
  }
}

export class ActiveStack {
  private _stack: Stack<EntityStackLevel>

  /**
   * @param signalBus - Optional signal bus for events
   */
  constructor(signalBus: SignalBus | null = null) {
    this._stack = new Stack<EntityStackLevel>(signalBus)
  }

  // ─── Mutators ─────────────────────────────────────────────────────────────

  /**
   * Replace entire stack (called on route change).
   * Only emits if levels actually changed (handled by qdcore Stack).
   * Accepts either fully-typed `EntityStackLevel` or the legacy
   * `{ entity, param, foreignKey, id }` shape.
   */
  set(levels: EntityStackLevelInput[]): void {
    this._stack.set(levels.map(normalize))
  }

  /**
   * Clear the stack.
   */
  clear(): void {
    this._stack.clear()
  }

  // ─── Accessors ────────────────────────────────────────────────────────────

  getLevels(): EntityStackLevel[] {
    return this._stack.getLevels()
  }

  getLevel(index: number): EntityStackLevel | null {
    return this._stack.getLevel(index)
  }

  /**
   * Get level by entity name (qdadm-specific helper).
   */
  getLevelByEntity(entity: string): EntityStackLevel | null {
    return this._stack.getLevels().find(l => l.entity === entity) ?? null
  }

  getCurrent(): EntityStackLevel | null {
    return this._stack.getCurrent()
  }

  getParent(): EntityStackLevel | null {
    return this._stack.getParent()
  }

  getRoot(): EntityStackLevel | null {
    return this._stack.getRoot()
  }

  getDepth(): number {
    return this._stack.getDepth()
  }

  /**
   * Underlying qdcore Stack instance (escape hatch for advanced use).
   */
  getCoreStack(): Stack<EntityStackLevel> {
    return this._stack
  }
}

export default ActiveStack
