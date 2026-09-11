/**
 * RelayBroker (#1400, #2231) — the relay-side session registry and request broker.
 *
 * Pages DIAL OUT to the relay over WebSocket (browsers cannot accept
 * inbound connections). The broker implements the same duck-typed
 * `DebugBrokerApi` the vite plugin exposes, so `buildToolset` works verbatim.
 *
 * Two ways in:
 *
 * - PAIRING (#2231). The tab's debug bar scans the relay ports and asks to
 *   pair; the relay answers with a code the TAB displays; the agent completes
 *   the pairing with `pair_accept(code)` once the human has read it out. The
 *   relay never hands codes to the agent, so an agent cannot pair a tab the
 *   human did not point at — and a process posing as a relay shows a code the
 *   agent's own relay has never issued. One paired tab at a time. It survives
 *   reloads (the tab re-presents its pairing key) and is what every tool
 *   targets by default.
 * - TOKEN (#1400). The `#qdadm-relay=ws://…/<token>` fragment, unchanged.
 *
 * Wire protocol (JSON text frames):
 *   relay → page: { kind: 'relay-hello', ...RelayIdentity }        (on connect)
 *                 { kind: 'pair-pending', code, expiresInMs }
 *                 { kind: 'paired', pairingKey, relay }
 *                 { kind: 'pair-refused', reason, message }
 *                 { kind: 'unpaired', reason }
 *                 { kind: 'request', id, type, payload? }
 *   page → relay: { kind: 'pair', instanceId, pairingKey?, meta }
 *                 { kind: 'unpair' }
 *                 { kind: 'hello', token, sessionId, meta }          (token flow)
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
  /** Null while a paired tab is away (reloading, or gone for good). */
  socket: SocketLike | null
  paired: boolean
  origin?: string
  disconnectedAt: number | null
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

export type SessionEvent = 'connected' | 'closed' | 'rejected' | 'pending' | 'paired'

export interface RelayBrokerOptions {
  /** Token for the fragment flow. Omit to accept pairing only. */
  token?: string
  timeoutMs?: number
  /** Sent to every page on connect, so a scan can tell a qdadm relay apart. */
  identity?: RelayIdentity
  /** Page origins allowed to pair (default: any browser origin). */
  allowedOrigins?: string[]
  /** How long a pairing code stays valid (default 5 min). */
  codeTtlMs?: number
  onSession?: (event: SessionEvent, sessionId: string, detail?: string) => void
  /** Test seams. */
  generateCode?: () => string
  generateKey?: () => string
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

export class RelayBroker implements DebugBrokerApi {
  readonly prefix = '/relay'
  /** Pairing surface for the `pairing_status` / `pair_accept` tools. */
  readonly pairing: NonNullable<DebugBrokerApi['pairing']>

  private sessions = new Map<string, RelaySession>()
  private bySocket = new Map<SocketLike, RelaySession>()
  private pending = new Map<string, PendingRequest>()
  private pendingPairings = new Map<string, PendingPairing>()
  private current: Pairing | null = null
  private nextId = 1
  private token: string | undefined
  private timeoutMs: number
  private identity: RelayIdentity | undefined
  private allowedOrigins: string[] | undefined
  private codeTtlMs: number
  private onSession: RelayBrokerOptions['onSession']
  private generateCode: () => string
  private generateKey: () => string

  constructor(options: RelayBrokerOptions = {}) {
    this.token = options.token
    this.timeoutMs = options.timeoutMs ?? 5000
    this.identity = options.identity
    this.allowedOrigins = options.allowedOrigins
    this.codeTtlMs = options.codeTtlMs ?? 5 * 60 * 1000
    this.onSession = options.onSession
    this.generateCode = options.generateCode ?? (() => String(randomInt(0, 1_000_000)).padStart(6, '0'))
    this.generateKey = options.generateKey ?? (() => randomUUID())
    this.pairing = {
      status: () => this.pairingStatus(),
      accept: (code: string) => this.acceptPairing(code),
    }
  }

  /** Wire a freshly accepted WebSocket. It serves nothing until it pairs or says hello. */
  attach(socket: SocketLike, info: AttachInfo = {}): void {
    if (this.identity) socket.send(JSON.stringify({ kind: 'relay-hello', ...this.identity }))

    socket.on('message', (raw: unknown) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return
      }
      if (msg.kind === 'pair') return this.onPair(socket, info.origin, msg)
      if (msg.kind === 'unpair') return this.onUnpair(socket)
      if (msg.kind === 'hello') return this.onTokenHello(socket, msg)

      const session = this.bySocket.get(socket)
      if (!session) return // nothing is served before pairing or hello
      session.lastSeenAt = Date.now()
      if (msg.kind === 'reply') {
        const p = this.pending.get(String(msg.id))
        if (!p) return
        clearTimeout(p.timeout)
        this.pending.delete(String(msg.id))
        if (msg.ok) p.resolve(msg.data)
        else p.reject(new Error(String(msg.error ?? 'relay: unknown page error')))
      } else if (msg.kind === 'bye') {
        this.onSocketGone(socket)
      }
    })
    socket.on('close', () => this.onSocketGone(socket))
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
      const p = this.current
      if (!p || p.key !== msg.pairingKey || p.instanceId !== instanceId || p.origin !== origin) {
        return this.refuse(
          socket,
          'unknown-pairing',
          'This relay does not know that pairing: it was restarted, or another tab was paired since. Pair again.'
        )
      }
      this.bind(socket, p, meta)
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

    const previous = this.current
    if (previous && previous.instanceId !== request.instanceId) this.retire(previous.instanceId, 'replaced')

    const pairing: Pairing = {
      key: this.generateKey(),
      instanceId: request.instanceId,
      origin: request.origin,
      pairedAt: Date.now(),
    }
    this.current = pairing
    this.bind(request.socket, pairing, request.meta)
    request.socket.send(JSON.stringify({ kind: 'paired', pairingKey: pairing.key, relay: this.identity ?? null }))
    this.onSession?.('paired', pairing.instanceId, pairing.origin)
    return {
      paired: { instanceId: pairing.instanceId, origin: pairing.origin, location: request.meta.location ?? null },
      next: 'Every tool now targets this tab. Start with session_info.',
    }
  }

  private pairingStatus() {
    const now = Date.now()
    const p = this.current
    const s = p ? this.sessions.get(p.instanceId) : undefined
    return {
      relay: this.identity ?? null,
      paired: p
        ? {
            instanceId: p.instanceId,
            origin: p.origin,
            location: s?.meta.location ?? null,
            pairedAt: p.pairedAt,
            connected: !!s?.socket,
            disconnectedForMs: s?.disconnectedAt ? now - s.disconnectedAt : null,
          }
        : null,
      // Codes stay in the tab: the human is the channel that carries them.
      waiting: Array.from(this.pendingPairings.values()).map((r) => ({
        instanceId: r.instanceId,
        origin: r.origin,
        location: r.meta.location ?? null,
        ageMs: now - r.createdAt,
      })),
    }
  }

  /** Make `socket` the live connection of the paired session. */
  private bind(socket: SocketLike, pairing: Pairing, meta: Record<string, unknown>): void {
    const now = Date.now()
    let s = this.sessions.get(pairing.instanceId)
    if (!s) {
      s = {
        id: pairing.instanceId,
        firstSeenAt: now,
        lastSeenAt: now,
        meta: {},
        socket: null,
        paired: true,
        origin: pairing.origin,
        disconnectedAt: null,
      }
      this.sessions.set(s.id, s)
    }
    const stale = s.socket
    s.socket = socket
    s.paired = true
    s.disconnectedAt = null
    s.lastSeenAt = now
    s.meta = { ...s.meta, ...meta }
    this.bySocket.set(socket, s)
    // A duplicated tab shares the instance id: the newest connection serves.
    if (stale && stale !== socket) {
      this.bySocket.delete(stale)
      stale.close()
    }
    this.onSession?.('connected', s.id, pairing.origin)
  }

  private onUnpair(socket: SocketLike): void {
    this.forgetPairingRequest(socket)
    const s = this.bySocket.get(socket)
    if (!s?.paired) return
    this.bySocket.delete(socket)
    this.sessions.delete(s.id)
    if (this.current?.instanceId === s.id) this.current = null
    this.onSession?.('closed', s.id, 'unpaired')
  }

  private retire(instanceId: string, reason: string): void {
    const s = this.sessions.get(instanceId)
    this.sessions.delete(instanceId)
    if (this.current?.instanceId === instanceId) this.current = null
    if (!s?.socket) return
    const socket = s.socket
    this.bySocket.delete(socket)
    socket.send(JSON.stringify({ kind: 'unpaired', reason }))
    socket.close()
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

  // ── token flow (#1400) ─────────────────────────────────────────────────

  private onTokenHello(socket: SocketLike, msg: Record<string, unknown>): void {
    if (!this.token || msg.token !== this.token) {
      this.onSession?.('rejected', String(msg.sessionId ?? '?'))
      socket.send(JSON.stringify({ kind: 'error', error: 'bad token' }))
      socket.close()
      return
    }
    const now = Date.now()
    const session: RelaySession = {
      id: String(msg.sessionId ?? `s-${this.nextId++}`),
      firstSeenAt: now,
      lastSeenAt: now,
      meta: isRecord(msg.meta) ? msg.meta : {},
      socket,
      paired: false,
      disconnectedAt: null,
    }
    this.sessions.set(session.id, session)
    this.bySocket.set(socket, session)
    this.onSession?.('connected', session.id)
    socket.send(JSON.stringify({ kind: 'welcome', sessionId: session.id }))
  }

  // ── shared ─────────────────────────────────────────────────────────────

  private onSocketGone(socket: SocketLike): void {
    this.forgetPairingRequest(socket)
    const s = this.bySocket.get(socket)
    this.bySocket.delete(socket)
    if (!s || s.socket !== socket) return
    if (s.paired && this.current?.instanceId === s.id) {
      // Keep the paired session: a reload comes back with the same instance
      // id and pairing key within seconds, and tools say so meanwhile.
      s.socket = null
      s.disconnectedAt = Date.now()
    } else {
      this.sessions.delete(s.id)
    }
    this.onSession?.('closed', s.id)
  }

  /** The session tools target by default: the paired tab, else the newest token session. */
  private target(): RelaySession | null {
    if (this.current) return this.sessions.get(this.current.instanceId) ?? null
    let best: RelaySession | null = null
    for (const s of this.sessions.values()) {
      if (s.socket && (!best || s.lastSeenAt > best.lastSeenAt)) best = s
    }
    return best
  }

  ask(type: string, payload?: unknown, sessionId?: string): Promise<unknown> {
    const session = sessionId ? this.sessions.get(sessionId) ?? null : this.target()
    if (!session) {
      return Promise.reject(
        new Error(
          'relay: no tab is paired — have the user open the MCP tab of the app\'s debug bar and click Pair, ' +
            'then call pair_accept with the code it shows (or open the site with the #qdadm-relay fragment ' +
            'printed at startup)'
        )
      )
    }
    const socket = session.socket
    if (!socket) {
      const away = Math.round((Date.now() - (session.disconnectedAt ?? Date.now())) / 1000)
      return Promise.reject(
        new Error(
          `relay: the paired tab (${session.origin ?? 'unknown origin'}) disconnected ${away}s ago — it is most ` +
            'likely reloading; retry in a few seconds. If it does not come back, have the user pair again from the debug bar.'
        )
      )
    }
    const id = String(this.nextId++)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`relay: timeout waiting for ${type} from page ${session.id}`))
      }, this.timeoutMs)
      this.pending.set(id, { resolve, reject, timeout })
      socket.send(JSON.stringify({ kind: 'request', id, type, payload }))
    })
  }

  pickSession(sessionParam: string | null) {
    const s = !sessionParam || sessionParam === 'latest' ? this.target() : this.sessions.get(sessionParam) ?? null
    return s ? { id: s.id, lastSeenAt: s.lastSeenAt, meta: s.meta } : null
  }

  listSessions() {
    const now = Date.now()
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      firstSeenAt: s.firstSeenAt,
      lastSeenAt: s.lastSeenAt,
      ageMs: now - s.lastSeenAt,
      paired: s.paired,
      connected: !!s.socket,
      origin: s.origin ?? null,
      meta: s.meta,
    }))
  }
}
