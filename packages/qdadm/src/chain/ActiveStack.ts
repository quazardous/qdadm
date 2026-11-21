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
 * The page's domain (#5412) is held beside the entity levels, not among
 * them (they stay entity levels: `current`, `parent`, `root`):
 * - /tasks/12?domain=it → domain = domain(it), stack = [tasks(id:12)]
 * `getContext()` gives both, the domain first.
 *
 * Signals emitted (via SignalBus):
 * - stack:change — when stack levels change, or the domain
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

/** The page's domain, as a stack level (#5412) */
export interface DomainStackLevel extends ContentStackLevel {
  type: 'domain'
  /** The domain's name */
  name: string
  id: null
  /** What put the page there: its route (meta, entity, module), `?domain=`, or the app's resolver */
  source: 'route' | 'query' | 'resolver'
}

/**
 * Stack change event payload
 */
export interface StackChangePayload {
  levels: EntityStackLevel[]
  /** The page's domain (#5412); present when the domain changed */
  domain?: DomainStackLevel | null
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
  private _signalBus: SignalBus | null
  private _domain: DomainStackLevel | null = null

  /**
   * @param signalBus - Optional signal bus for events
   */
  constructor(signalBus: SignalBus | null = null) {
    this._stack = new Stack<EntityStackLevel>(signalBus)
    this._signalBus = signalBus
  }

  /**
   * The page's domain (#5412). Emits `stack:change` when it changes; set it
   * before the levels, so their change reads the new domain.
   */
  setDomain(domain: { name: string; source: DomainStackLevel['source'] } | null): void {
    const next: DomainStackLevel | null = domain ? { type: 'domain', name: domain.name, id: null, source: domain.source } : null
    const prev = this._domain
    if (prev?.name === next?.name && prev?.source === next?.source) return
    this._domain = next
    void this._signalBus?.emit('stack:change', { levels: this.getLevels(), domain: next })
  }

  getDomain(): DomainStackLevel | null {
    return this._domain
  }

  /** The domain, then the entity levels: `[domain(it), tasks(12)]` */
  getContext(): Array<DomainStackLevel | EntityStackLevel> {
    return this._domain ? [this._domain, ...this.getLevels()] : this.getLevels()
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
