/**
 * RelayBroker (#1400, #2231) — the relay-side instance registry and request broker.
 *
 * Pages DIAL OUT to the relay over WebSocket (browsers cannot accept
 * inbound connections). The broker implements the same duck-typed
 * `DebugBrokerApi` the vite plugin exposes, so `buildToolset` works verbatim.
 *
 * One relay serves MANY instances — every tab of every app that connected.
 * Tools name the instance they want; with exactly one connected, they may
 * omit it. A tab that goes away stays known through a short grace window,
 * so a reload is a blip ("reloading — retry"), not a new instance.
 *
 * Two ways in:
 *
 * - TOKEN. The tab presents the relay's page token. Dev-server tabs get it
 *   from the vite plugin and connect on their own; the
 *   `#qdadm-relay=ws://…/<token>` fragment of #1400 is the same flow.
 * - PAIRING. Outside dev, the MCP tab of the debug bar asks to pair; the
 *   relay answers with a code the TAB displays; the agent completes it with
 *   `pair_accept(code)` once the human has read it out. Codes never reach the
 *   agent. A paired tab re-presents its pairing key on reload.
 *
 * Wire protocol (JSON text frames):
 *   relay → page: { kind: 'relay-hello', ...RelayIdentity }        (on connect)
 *                 { kind: 'welcome', sessionId }                    (token accepted)
 *                 { kind: 'pair-pending', code, expiresInMs }
 *                 { kind: 'paired', pairingKey, relay }
 *                 { kind: 'pair-refused', reason, message }
 *                 { kind: 'error', error }
 *                 { kind: 'request', id, type, payload? }
 *   page → relay: { kind: 'hello', token, sessionId, meta }
 *                 { kind: 'pair', instanceId, pairingKey?, meta }
 *                 { kind: 'unpair' }
 *                 { kind: 'meta', meta }                           (app name once booted)
 *                 { kind: 'reply', id, ok, data?, error? }
 *                 { kind: 'bye' }
 */
import { randomInt, randomUUID } from 'node:crypto'
import type { DebugBrokerApi } from '../tools.ts'
import type { RelayIdentity } from '../protocol.ts'

interface SocketLike {
  send(data: string): void
  on(event: 'message', cb: (data: unknown) => void): void
  on(event: 'close', cb: () => void): void
  close(): void
}

export interface AttachInfo {
  /** Origin header of the WebSocket upgrade request. */
  origin?: string
}

interface RelaySession {
  id: string
  firstSeenAt: number
  lastSeenAt: number
  meta: Record<string, unknown>
  /** Null while the tab is away (reloading, or gone for good). */
  socket: SocketLike | null
  via: 'token' | 'pairing'
  origin?: string
  disconnectedAt: number | null
  forget: ReturnType<typeof setTimeout> | null
}

interface PendingRequest {
  resolve: (data: unknown) => void
  reject: (err: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

interface PendingPairing {
  code: string
  instanceId: string
  origin: string
  meta: Record<string, unknown>
  socket: SocketLike
  createdAt: number
  expiry: ReturnType<typeof setTimeout>
}

interface Pairing {
  key: string
  instanceId: string
  origin: string
  pairedAt: number
}

/** Chat messages of one instance that an agent hook has not shown yet (#2252). */
export interface PendingChat {
  instance: string
  app: unknown
  location: unknown
  /** `screenshot`: the message came with one (#2309), which chat_read hands over. */
  messages: Array<{ text: string; at: number; screenshot?: boolean }>
}

export type SessionEvent ='connected' | 'closed' | 'forgotten' | 'rejected' | 'pending' | 'paired'

export interface RelayBrokerOptions {
  /** Page token (dev tabs, URL fragment). Omit to accept pairing only. */
  token?: string
  timeoutMs?: number
  /** Sent to every page on connect, so a scan can tell a qdadm relay apart. */
  identity?: RelayIdentity
  /** Page origins allowed to pair (default: any browser origin). */
  allowedOrigins?: string[]
  /** How long a pairing code stays valid (default 5 min). */
  codeTtlMs?: number
  /** How long a tab that went away stays known (default 30 s). */
  reloadGraceMs?: number
  onSession?: (event: SessionEvent, sessionId: string, detail?: string) => void
  /** Test seams. */
  generateCode?: () => string
  generateKey?: () => string
}

/**
 * Requests that legitimately outlast a read, in ms: wait_for waits up to 30 s,
 * a navigation settles, a snapshot of a large page takes a moment.
 */
const SLOW_REQUESTS: Record<string, number> = {
  waitFor: 35_000,
  navigate: 15_000,
  pageSnapshot: 15_000,
  find: 15_000,
  pageText: 10_000,
  click: 15_000,
  typeText: 30_000,
  fill: 15_000,
  pressKey: 15_000,
  hover: 10_000,
  scroll: 10_000,
  drag: 15_000,
  uploadFile: 15_000,
  pageEval: 30_000,
  screenshot: 30_000,
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export class RelayBroker implements DebugBrokerApi {
  readonly prefix = '/relay'
  /** Pairing surface for the `pair_accept` tool. */
  readonly pairing: NonNullable<DebugBrokerApi['pairing']>

  private sessions = new Map<string, RelaySession>()
  private bySocket = new Map<SocketLike, RelaySession>()
  private pending = new Map<string, PendingRequest>()
  private pendingPairings = new Map<string, PendingPairing>()
  private pairings = new Map<string, Pairing>()
  private nextId = 1
  private token: string | undefined
  private timeoutMs: number
  private identity: RelayIdentity | undefined
  private allowedOrigins: string[] | undefined
  private codeTtlMs: number
  private reloadGraceMs: number
  private onSession: RelayBrokerOptions['onSession']
  private generateCode: () => string
  private generateKey: () => string

  constructor(options: RelayBrokerOptions = {}) {
    this.token = options.token
    this.timeoutMs = options.timeoutMs ?? 5000
    this.identity = options.identity
    this.allowedOrigins = options.allowedOrigins
    this.codeTtlMs = options.codeTtlMs ?? 5 * 60 * 1000
    this.reloadGraceMs = options.reloadGraceMs ?? 30 * 1000
    this.onSession = options.onSession
    this.generateCode = options.generateCode ?? (() => String(randomInt(0, 1_000_000)).padStart(6, '0'))
    this.generateKey = options.generateKey ?? (() => randomUUID())
    this.pairing = {
      status: () => this.pairingStatus(),
      accept: (code: string) => this.acceptPairing(code),
    }
  }

  /** The identity is only known once the relay listens. */
  setIdentity(identity: RelayIdentity): void {
    this.identity = identity
  }

  /** Instances with a live connection. */
  connectedCount(): number {
    let n = 0
    for (const s of this.sessions.values()) if (s.socket) n++
    return n
  }

  /** Wire a freshly accepted WebSocket. It serves nothing until it says hello or pairs. */
  attach(socket: SocketLike, info: AttachInfo = {}): void {
    if (this.identity) socket.send(JSON.stringify({ kind: 'relay-hello', ...this.identity }))

    socket.on('message', (raw: unknown) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return
      }
      if (msg.kind === 'hello') return this.onTokenHello(socket, info.origin, msg)
      if (msg.kind === 'pair') return this.onPair(socket, info.origin, msg)
      if (msg.kind === 'unpair') return this.onUnpair(socket)

      const session = this.bySocket.get(socket)
      if (!session) return // nothing is served before hello or pairing
      session.lastSeenAt = Date.now()
      if (msg.kind === 'reply') {
        const p = this.pending.get(String(msg.id))
        if (!p) return
        clearTimeout(p.timeout)
        this.pending.delete(String(msg.id))
        if (msg.ok) p.resolve(msg.data)
        else p.reject(new Error(String(msg.error ?? 'relay: unknown page error')))
      } else if (msg.kind === 'meta' && isRecord(msg.meta)) {
        session.meta = { ...session.meta, ...msg.meta }
      } else if (msg.kind === 'bye') {
        this.onSocketGone(socket)
      }
    })
    socket.on('close', () => this.onSocketGone(socket))
  }

  // ── token (dev tabs, URL fragment) ─────────────────────────────────────

  private onTokenHello(socket: SocketLike, origin: string | undefined, msg: Record<string, unknown>): void {
    if (!this.token || msg.token !== this.token) {
      this.onSession?.('rejected', String(msg.sessionId ?? '?'), 'bad token')
      socket.send(JSON.stringify({ kind: 'error', error: 'bad token' }))
      socket.close()
      return
    }
    const id = typeof msg.sessionId === 'string' && msg.sessionId ? msg.sessionId : `s-${this.nextId++}`
    this.bind(socket, id, 'token', origin, isRecord(msg.meta) ? msg.meta : {})
    socket.send(JSON.stringify({ kind: 'welcome', sessionId: id }))
  }

  // ── pairing ────────────────────────────────────────────────────────────

  private onPair(socket: SocketLike, origin: string | undefined, msg: Record<string, unknown>): void {
    const instanceId = typeof msg.instanceId === 'string' ? msg.instanceId : ''
    if (!instanceId) return this.refuse(socket, 'bad-request', 'A pairing request needs an instanceId.')
    if (!origin) {
      return this.refuse(socket, 'no-origin', 'Pairing is for browser tabs: this connection carried no Origin header.')
    }
    if (this.allowedOrigins && !this.allowedOrigins.includes(origin)) {
      this.onSession?.('rejected', instanceId, origin)
      return this.refuse(socket, 'origin-not-allowed', `This relay only pairs with ${this.allowedOrigins.join(', ')} (--origin), not ${origin}.`)
    }
    const meta = isRecord(msg.meta) ? msg.meta : {}

    if (typeof msg.pairingKey === 'string') {
      const p = this.pairings.get(msg.pairingKey)
      if (!p || p.instanceId !== instanceId || p.origin !== origin) {
        return this.refuse(
          socket,
          'unknown-pairing',
          'This relay does not know that pairing: it was restarted, or the tab was unpaired. Pair again.'
        )
      }
      this.bind(socket, instanceId, 'pairing', origin, meta)
      socket.send(JSON.stringify({ kind: 'paired', pairingKey: p.key, relay: this.identity ?? null }))
      return
    }

    this.forgetPairingRequest(socket)
    const code = this.uniqueCode()
    const expiry = setTimeout(() => {
      if (this.pendingPairings.get(code)?.socket !== socket) return
      this.pendingPairings.delete(code)
      this.refuse(socket, 'expired', 'The pairing code expired before the agent accepted it. Pair again.')
    }, this.codeTtlMs)
    expiry.unref?.()
    this.pendingPairings.set(code, { code, instanceId, origin, meta, socket, createdAt: Date.now(), expiry })
    this.onSession?.('pending', instanceId, origin)
    socket.send(JSON.stringify({ kind: 'pair-pending', code, expiresInMs: this.codeTtlMs }))
  }

  private acceptPairing(rawCode: string) {
    const code = String(rawCode).replace(/\D/g, '')
    const request = this.pendingPairings.get(code)
    if (!request) {
      const waiting = Array.from(this.pendingPairings.values())
      throw new Error(
        `No tab is waiting with code "${rawCode}". Ask the user to open the MCP tab of the app's debug bar, click Pair, ` +
          `and read you the code it shows — never guess one. ` +
          (waiting.length > 0
            ? `${waiting.length} tab(s) waiting, from ${[...new Set(waiting.map((w) => w.origin))].join(', ')}.`
            : 'No tab is waiting right now.')
      )
    }
    clearTimeout(request.expiry)
    this.pendingPairings.delete(code)

    // A tab pairing again replaces its own previous key — never another tab's.
    for (const [key, p] of this.pairings) if (p.instanceId === request.instanceId) this.pairings.delete(key)
    const pairing: Pairing = {
      key: this.generateKey(),
      instanceId: request.instanceId,
      origin: request.origin,
      pairedAt: Date.now(),
    }
    this.pairings.set(pairing.key, pairing)
    this.bind(request.socket, pairing.instanceId, 'pairing', pairing.origin, request.meta)
    request.socket.send(JSON.stringify({ kind: 'paired', pairingKey: pairing.key, relay: this.identity ?? null }))
    this.onSession?.('paired', pairing.instanceId, pairing.origin)
    return {
      paired: this.describe(this.sessions.get(pairing.instanceId)!),
      next:
        this.connectedCount() > 1
          ? `Several instances are connected: pass instance: "${pairing.instanceId.slice(0, 8)}" to target this one.`
          : 'It is the only connected instance: tools target it without an instance argument.',
    }
  }

  private pairingStatus() {
    const now = Date.now()
    return {
      // Codes stay in the tab: the human is the channel that carries them.
      waiting: Array.from(this.pendingPairings.values()).map((r) => ({
        instance: r.instanceId,
        origin: r.origin,
        location: r.meta.location ?? null,
        ageMs: now - r.createdAt,
      })),
    }
  }

  private onUnpair(socket: SocketLike): void {
    this.forgetPairingRequest(socket)
    const s = this.bySocket.get(socket)
    if (!s || s.via !== 'pairing') return
    for (const [key, p] of this.pairings) if (p.instanceId === s.id) this.pairings.delete(key)
    this.bySocket.delete(socket)
    this.drop(s, 'unpaired')
  }

  private refuse(socket: SocketLike, reason: string, message: string): void {
    this.forgetPairingRequest(socket)
    socket.send(JSON.stringify({ kind: 'pair-refused', reason, message }))
    socket.close()
  }

  private forgetPairingRequest(socket: SocketLike): void {
    for (const [code, r] of this.pendingPairings) {
      if (r.socket !== socket) continue
      clearTimeout(r.expiry)
      this.pendingPairings.delete(code)
    }
  }

  private uniqueCode(): string {
    for (let i = 0; i < 50; i++) {
      const code = this.generateCode()
      if (!this.pendingPairings.has(code)) return code
    }
    throw new Error('relay: could not mint a unique pairing code')
  }

  // ── instances ──────────────────────────────────────────────────────────

  /** Make `socket` the live connection of instance `id` — a reload finds its session again. */
  private bind(
    socket: SocketLike,
    id: string,
    via: RelaySession['via'],
    origin: string | undefined,
    meta: Record<string, unknown>
  ): void {
    const now = Date.now()
    let s = this.sessions.get(id)
    if (!s) {
      s = { id, firstSeenAt: now, lastSeenAt: now, meta: {}, socket: null, via, origin, disconnectedAt: null, forget: null }
      this.sessions.set(id, s)
    }
    const stale = s.socket
    if (s.forget) clearTimeout(s.forget)
    s.forget = null
    s.socket = socket
    s.via = via
    s.origin = origin ?? s.origin
    s.disconnectedAt = null
    s.lastSeenAt = now
    s.meta = { ...s.meta, ...meta }
    this.bySocket.set(socket, s)
    // A duplicated tab shares the instance id: the newest connection serves.
    if (stale && stale !== socket) {
      this.bySocket.delete(stale)
      stale.close()
    }
    this.onSession?.('connected', id, [s.meta.app, origin].filter(Boolean).join(' · ') || undefined)
  }

  private onSocketGone(socket: SocketLike): void {
    this.forgetPairingRequest(socket)
    const s = this.bySocket.get(socket)
    this.bySocket.delete(socket)
    if (!s || s.socket !== socket) return
    s.socket = null
    s.disconnectedAt = Date.now()
    this.onSession?.('closed', s.id)
    // Kept through the grace window: a reload comes back with the same id.
    s.forget = setTimeout(() => {
      if (!s.socket) this.drop(s, 'did not come back')
    }, this.reloadGraceMs)
    s.forget.unref?.()
  }

  private drop(s: RelaySession, why: string): void {
    if (s.forget) clearTimeout(s.forget)
    if (this.sessions.get(s.id) === s) this.sessions.delete(s.id)
    this.onSession?.('forgotten', s.id, why)
  }

  private describe(s: RelaySession) {
    const now = Date.now()
    return {
      instance: s.id,
      short: s.id.slice(0, 8),
      app: s.meta.app ?? null,
      title: s.meta.title ?? null,
      location: s.meta.location ?? null,
      origin: s.origin ?? null,
      via: s.via,
      connected: !!s.socket,
      disconnectedForMs: s.disconnectedAt ? now - s.disconnectedAt : null,
      connectedForMs: now - s.firstSeenAt,
    }
  }

  private label(s: RelaySession): string {
    const where = [s.meta.app, s.origin && `${s.origin}${s.meta.location ?? ''}`].filter(Boolean).join(', ')
    return `${s.id.slice(0, 8)}${where ? ` (${where})` : ''}${s.socket ? '' : ' [reloading]'}`
  }

  /**
   * The instance a tool targets. Explicit: an id or a unique id prefix.
   * Implicit: the only connected instance — or the only one reloading.
   * Anything else is ambiguous, and the error lists the choices.
   */
  private resolve(param?: string | null): RelaySession | null {
    const all = Array.from(this.sessions.values())
    if (param && param !== 'latest') {
      const exact = this.sessions.get(param)
      if (exact) return exact
      const byPrefix = param.length >= 4 ? all.filter((s) => s.id.startsWith(param)) : []
      if (byPrefix.length === 1) return byPrefix[0]
      throw new Error(
        `relay: no instance "${param}"${byPrefix.length > 1 ? ' (ambiguous prefix)' : ''}. ` +
          (all.length > 0 ? `Instances: ${all.map((s) => this.label(s)).join('; ')}.` : 'No instance is connected.')
      )
    }
    const connected = all.filter((s) => s.socket)
    if (connected.length === 1) return connected[0]
    if (connected.length === 0) return all.length === 1 ? all[0] : null
    throw new Error(
      `relay: ${connected.length} instances are connected — pass instance (an id or its first 8 characters): ` +
        `${connected.map((s) => this.label(s)).join('; ')}.`
    )
  }

  ask(type: string, payload?: unknown, sessionId?: string): Promise<unknown> {
    let session: RelaySession | null
    try {
      session = sessionId ? this.sessions.get(sessionId) ?? null : this.resolve(null)
    } catch (e) {
      return Promise.reject(e)
    }
    if (!session) {
      return Promise.reject(
        new Error(
          'relay: no app instance is connected — start the app with its dev server (its tabs connect on their own), ' +
            'or have the user open the MCP tab of the app\'s debug bar and click Pair'
        )
      )
    }
    const socket = session.socket
    if (!socket) {
      const away = Math.round((Date.now() - (session.disconnectedAt ?? Date.now())) / 1000)
      return Promise.reject(
        new Error(
          `relay: instance ${this.label(session)} disconnected ${away}s ago — it is most likely reloading; retry in a ` +
            'few seconds.'
        )
      )
    }
    const id = String(this.nextId++)
    const limit = Math.max(this.timeoutMs, SLOW_REQUESTS[type] ?? 0)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`relay: timeout waiting for ${type} from instance ${session.id.slice(0, 8)}`))
      }, limit)
      this.pending.set(id, { resolve, reject, timeout })
      socket.send(JSON.stringify({ kind: 'request', id, type, payload }))
    })
  }

  /**
   * What users typed in the MCP tab's chat that no agent hook showed yet (#2252), across the connected instances.
   * `mark` records it as shown. An instance that does not answer — or runs a connector too old to know — is
   * left out: a hook must never fail because of one tab.
   */
  async chatPending(mark: boolean): Promise<PendingChat[]> {
    const connected = Array.from(this.sessions.values()).filter((s) => s.socket)
    const answers = await Promise.all(
      connected.map(async (s): Promise<PendingChat | null> => {
        try {
          const data = (await this.ask('chatPending', { mark }, s.id)) as { messages?: PendingChat['messages'] }
          const messages = Array.isArray(data?.messages) ? data.messages : []
          if (messages.length === 0) return null
          return { instance: s.id, app: s.meta.app ?? null, location: s.meta.location ?? null, messages }
        } catch {
          return null
        }
      })
    )
    return answers.filter((a): a is PendingChat => a !== null)
  }

  /** May throw: an ambiguous or unknown instance is the agent's error to read. */
  pickSession(sessionParam: string | null) {
    const s = this.resolve(sessionParam)
    return s ? { id: s.id, lastSeenAt: s.lastSeenAt, meta: s.meta } : null
  }

  listSessions() {
    return Array.from(this.sessions.values()).map((s) => this.describe(s))
  }
}
