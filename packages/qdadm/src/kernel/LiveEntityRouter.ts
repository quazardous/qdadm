/**
 * LiveEntityRouter — turns "something changed elsewhere" into cache
 * invalidation for the right EntityManager (#1888 lot C, reported in #1887).
 *
 * The transport is deliberately not part of this class. Its entry point is
 * `notify()`, a plain fact: *this entity changed, possibly this record*. SSE is
 * wired on top by `attachSignalTransport()`, and a WebSocket or a
 * `BroadcastChannel` between two tabs of the same admin would attach the same
 * way — see docs/adr/0009-live-entities.md.
 *
 * Two boundaries the ADR fixes and this class enforces:
 *
 * - **The event carries a fact, never an instruction.** Nothing in the payload
 *   may tell the front what to do; the payload says what changed and the front
 *   decides what that implies.
 * - **The security scope is the front's.** An event never causes a request the
 *   current user could not have issued: an entity they cannot read is dropped
 *   rather than refetched, otherwise every pushed event sprays 401/403.
 *
 * @experimental Shape may change in a minor release — see docs/API_STABILITY.md.
 */

import type { SignalBus } from './SignalBus'

/** The actions a live event can report. */
export type LiveEntityAction = 'created' | 'updated' | 'deleted'

/**
 * Which entities the app declares as having an external writer.
 * `true` / `'*'` accepts every registered entity.
 */
export type LiveEntitiesDeclaration = string[] | true | '*'

/** Minimal orchestrator surface this router needs. */
export interface LiveOrchestratorLike {
  has(name: string): boolean
  get(name: string): { canRead?: () => boolean } | undefined
}

export interface LiveEntityRouterOptions {
  signals: SignalBus
  /** Entities declared as externally written. */
  entities: LiveEntitiesDeclaration
  /** Used to resolve the manager for the permission check. */
  orchestrator?: LiveOrchestratorLike | null
  /** Signal prefix the transport publishes under (default: 'sse'). */
  signalPrefix?: string
  debug?: boolean
}

/** Payload shape a transport frame is expected to carry. */
interface LiveFramePayload {
  entity?: string
  id?: string | number
  action?: LiveEntityAction
}

const ACTION_BY_EVENT: Record<string, LiveEntityAction> = {
  'entity:created': 'created',
  'entity:updated': 'updated',
  'entity:deleted': 'deleted',
}

export class LiveEntityRouter {
  private _signals: SignalBus
  private _entities: LiveEntitiesDeclaration
  private _orchestrator: LiveOrchestratorLike | null
  private _signalPrefix: string
  private _debug: boolean
  private _cleanups: Array<() => void> = []
  /** Entities seen on the wire but never declared — warned about once each. */
  private _warned = new Set<string>()

  constructor(options: LiveEntityRouterOptions) {
    const {
      signals,
      entities,
      orchestrator = null,
      signalPrefix = 'sse',
      debug = false,
    } = options

    if (!signals) throw new Error('[LiveEntityRouter] signals (SignalBus) is required')

    this._signals = signals
    this._entities = entities
    this._orchestrator = orchestrator
    this._signalPrefix = signalPrefix
    this._debug = debug
  }

  /** Is this entity declared as externally written? */
  isDeclared(entity: string): boolean {
    if (this._entities === true || this._entities === '*') return true
    return Array.isArray(this._entities) && this._entities.includes(entity)
  }

  /**
   * Report an external change. Transport-agnostic entry point.
   *
   * @returns true when the change was routed, false when it was dropped
   *   (undeclared entity, unknown manager, or one the user cannot read).
   */
  notify(entity: string, action: LiveEntityAction = 'updated', id?: string | number): boolean {
    if (!entity) return false

    if (!this.isDeclared(entity)) {
      // Not an error: a stream carries more than entity mutations. But a
      // silently dropped frame is the hardest kind of bug to find, so say it
      // once per entity in dev.
      if (!this._warned.has(entity)) {
        this._warned.add(entity)
        this._log(
          `Ignoring a live event for "${entity}": not declared in sse.entities. ` +
            `Add it there if this backend writes to it out of session.`
        )
      }
      return false
    }

    const manager = this._orchestrator?.get(entity)
    if (this._orchestrator && !manager) {
      this._log(`Ignoring a live event for "${entity}": no manager registered under that name.`)
      return false
    }

    // The security scope is the front's: never refetch what this user could not
    // have asked for in the first place.
    if (manager?.canRead && !manager.canRead()) {
      this._log(`Ignoring a live event for "${entity}": current user cannot read it.`)
      return false
    }

    this._signals.emit('entity:data-invalidate', {
      entity,
      action,
      id,
      source: 'remote',
    })
    this._signals.emitEntity?.(entity, action, { id, source: 'remote' })

    this._log(`Routed ${action} on "${entity}"${id !== undefined ? ` (id ${id})` : ''}`)
    return true
  }

  /**
   * Subscribe to the transport's frames on the signal bus.
   *
   * Recognises `{prefix}:entity:{created,updated,deleted}` carrying
   * `{ entity, id? }` — the contract validated downstream in #1887.
   */
  attachSignalTransport(): void {
    for (const [event, action] of Object.entries(ACTION_BY_EVENT)) {
      const signal = `${this._signalPrefix}:${event}`
      this._cleanups.push(
        this._signals.on(signal, (received: { name: string; data: unknown }) => {
          const frame = (received?.data ?? {}) as { data?: LiveFramePayload }
          // Transports wrap the decoded body in `data` (see SSEBridge); accept
          // a bare payload too so a non-SSE caller isn't forced to fake it.
          const payload = (frame.data ?? frame) as LiveFramePayload
          if (!payload?.entity) return
          this.notify(payload.entity, payload.action ?? action, payload.id)
        })
      )
    }
  }

  /** Drop every subscription. */
  destroy(): void {
    this._cleanups.forEach((off) => off())
    this._cleanups = []
  }

  private _log(...args: unknown[]): void {
    if (this._debug) console.debug('[LiveEntityRouter]', ...args)
  }
}

export function createLiveEntityRouter(options: LiveEntityRouterOptions): LiveEntityRouter {
  return new LiveEntityRouter(options)
}
