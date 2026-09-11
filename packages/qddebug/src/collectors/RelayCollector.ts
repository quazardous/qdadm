/**
 * RelayCollector — the MCP tab (#2231).
 *
 * Pairs this browser tab with a local qdadm-mcp-relay through
 * `window.__qdadmRelay`, the controller `@quazardous/qdadm-mcp/connector`
 * installs. qddebug knows nothing else about MCP. Current state only, no
 * ring buffer.
 *
 * The pairing code never leaves the tab: `snapshot()` and the `state` action
 * redact it. The debug bridge is readable over HTTP and MCP, and an agent
 * able to read the code could pair a tab nobody pointed it at — the code
 * exists precisely so that a human carries it.
 */
import {
  Collector,
  type CollectorContext,
  type CollectorManifest,
  type CollectorOptions,
  type CollectorSnapshot,
} from '../bridge/Collector'

export interface RelayIdentityLike {
  project?: string
  cwd?: string
  port?: number
}

export interface RelayStateLike {
  status: string
  code?: string
  message?: string
  permissionPending?: boolean
  ports?: readonly number[]
  relay?: RelayIdentityLike
  relays?: RelayIdentityLike[]
  instanceId?: string
  retryInMs?: number
}

export interface RelayControllerLike {
  readonly mode?: 'auto' | 'pairing' | 'token'
  readonly instanceId?: string
  readonly state: RelayStateLike
  subscribe(listener: (state: RelayStateLike) => void): () => void
  pair(port?: number): Promise<void>
  unpair(): void
}

/** The controller the relay connector installed, if any. */
export function findRelayController(): RelayControllerLike | null {
  try {
    const c = (globalThis as { __qdadmRelay?: RelayControllerLike }).__qdadmRelay
    return c && typeof c.subscribe === 'function' && typeof c.pair === 'function' ? c : null
  } catch {
    return null
  }
}

const REDACTED = '[shown in the browser tab only]'

export class RelayCollector extends Collector {
  static override collectorName = 'mcp'
  static override records = false

  private _controller: RelayControllerLike | null = null
  private _state: RelayStateLike = { status: 'unavailable' }
  private _unsubscribe: (() => void) | null = null

  constructor(options: CollectorOptions = {}) {
    super(options)
    this.registerAction(
      { name: 'state', summary: 'Current pairing state. The code is redacted: a human reads it in the tab.' },
      () => this.publicState()
    )
    this.registerAction(
      { name: 'pair', summary: 'Scan the relay ports (or one port) and ask to pair.', args: { port: 'number?' }, mutates: true },
      async (args) => {
        await this.pair(typeof args?.port === 'number' ? args.port : undefined)
        return this.publicState()
      }
    )
    this.registerAction({ name: 'unpair', summary: 'Forget the pairing on both sides.', mutates: true }, () => {
      this.unpair()
      return this.publicState()
    })
  }

  get state(): RelayStateLike {
    return this._state
  }

  /** How this tab reaches the relay: `auto` on a dev page, `pairing` elsewhere. */
  get mode(): 'auto' | 'pairing' | 'token' | null {
    return this._controller?.mode ?? null
  }

  get instanceId(): string | null {
    return this._controller?.instanceId ?? null
  }

  pair(port?: number): Promise<void> {
    return this._controller ? this._controller.pair(port) : Promise.resolve()
  }

  unpair(): void {
    this._controller?.unpair()
  }

  /** State as the bridge may expose it: everything but the code. */
  publicState(): RelayStateLike {
    return this._state.code ? { ...this._state, code: REDACTED } : { ...this._state }
  }

  /** The tab asks for attention while a code waits to be read, or something failed. */
  override getBadge(_countAll = false): number {
    return this._state.status === 'awaiting-code' || this._state.status === 'error' ? 1 : 0
  }

  protected override _doInstall(_ctx: CollectorContext): void {
    this._controller = findRelayController()
    if (!this._controller) {
      this._state = { status: 'unavailable' }
      return
    }
    this._unsubscribe = this._controller.subscribe((next) => {
      this._state = next
      this.notifyChange()
    })
  }

  protected override _doUninstall(): void {
    this._unsubscribe?.()
    this._unsubscribe = null
  }

  override snapshot(): CollectorSnapshot {
    return { ...super.snapshot(), state: this.publicState() as unknown as Record<string, unknown> }
  }

  override describe(): CollectorManifest {
    return {
      ...super.describe(),
      summary: 'Pairing of this browser tab with a local MCP relay (qdadm-mcp-relay). The pairing code is never exposed here.',
      stateShape: {
        status:
          'unavailable | connecting | connected | offline | idle | scanning | none-found | choose | awaiting-code | reconnecting | paired | error',
        relay: '{ project, cwd, port }?',
        message: 'string?',
      },
    }
  }
}
