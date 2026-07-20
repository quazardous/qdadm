/**
 * RelayBroker (#1400) — the relay-side session registry and request broker.
 *
 * Pages DIAL OUT to the relay over WebSocket (browsers cannot accept
 * inbound connections) and authenticate with the one-time token. The broker
 * then implements the same duck-typed `DebugBrokerApi` the vite plugin
 * exposes, so `buildToolset` (the 13 curated tools) works verbatim.
 *
 * Wire protocol (JSON text frames):
 *   page → relay: { kind: 'hello', token, sessionId, meta }
 *                 { kind: 'reply', id, ok, data?, error? }
 *                 { kind: 'bye' }
 *   relay → page: { kind: 'request', id, type, payload? }
 */
import type { DebugBrokerApi } from '../tools.ts'

interface SocketLike {
  send(data: string): void
  on(event: 'message', cb: (data: unknown) => void): void
  on(event: 'close', cb: () => void): void
  close(): void
}

interface RelaySession {
  id: string
  firstSeenAt: number
  lastSeenAt: number
  meta: Record<string, unknown>
  socket: SocketLike
}

interface PendingRequest {
  resolve: (data: unknown) => void
  reject: (err: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

export interface RelayBrokerOptions {
  token: string
  timeoutMs?: number
  onSession?: (event: 'connected' | 'closed' | 'rejected', sessionId: string) => void
}

export class RelayBroker implements DebugBrokerApi {
  readonly prefix = '/relay'
  private sessions = new Map<string, RelaySession>()
  private pending = new Map<string, PendingRequest>()
  private nextId = 1
  private token: string
  private timeoutMs: number
  private onSession: RelayBrokerOptions['onSession']

  constructor(options: RelayBrokerOptions) {
    this.token = options.token
    this.timeoutMs = options.timeoutMs ?? 5000
    this.onSession = options.onSession
  }

  /** Wire a freshly accepted WebSocket. Unauthenticated until hello. */
  attach(socket: SocketLike): void {
    let session: RelaySession | null = null
    socket.on('message', (raw: unknown) => {
      let msg: Record<string, unknown>
      try {
        msg = JSON.parse(String(raw))
      } catch {
        return
      }
      if (msg.kind === 'hello') {
        if (msg.token !== this.token) {
          this.onSession?.('rejected', String(msg.sessionId ?? '?'))
          socket.send(JSON.stringify({ kind: 'error', error: 'bad token' }))
          socket.close()
          return
        }
        const id = String(msg.sessionId ?? `s-${this.nextId++}`)
        session = {
          id,
          firstSeenAt: Date.now(),
          lastSeenAt: Date.now(),
          meta: (msg.meta as Record<string, unknown>) ?? {},
          socket,
        }
        this.sessions.set(id, session)
        this.onSession?.('connected', id)
        socket.send(JSON.stringify({ kind: 'welcome', sessionId: id }))
        return
      }
      if (!session) return // ignore anything pre-auth
      session.lastSeenAt = Date.now()
      if (msg.kind === 'reply') {
        const p = this.pending.get(String(msg.id))
        if (!p) return
        clearTimeout(p.timeout)
        this.pending.delete(String(msg.id))
        if (msg.ok) p.resolve(msg.data)
        else p.reject(new Error(String(msg.error ?? 'relay: unknown page error')))
      } else if (msg.kind === 'bye') {
        this.drop(session.id)
      }
    })
    socket.on('close', () => {
      if (session) this.drop(session.id)
    })
  }

  private drop(id: string): void {
    if (this.sessions.delete(id)) this.onSession?.('closed', id)
  }

  ask(type: string, payload?: unknown, sessionId?: string): Promise<unknown> {
    const session = sessionId ? this.sessions.get(sessionId) : this.newest()
    if (!session) {
      return Promise.reject(
        new Error('relay: no connected page — open the site with the #qdadm-relay fragment')
      )
    }
    const id = String(this.nextId++)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`relay: timeout waiting for ${type} from page ${session.id}`))
      }, this.timeoutMs)
      this.pending.set(id, { resolve, reject, timeout })
      session.socket.send(JSON.stringify({ kind: 'request', id, type, payload }))
    })
  }

  private newest(): RelaySession | null {
    let best: RelaySession | null = null
    for (const s of this.sessions.values()) {
      if (!best || s.lastSeenAt > best.lastSeenAt) best = s
    }
    return best
  }

  pickSession(sessionParam: string | null) {
    const s = !sessionParam || sessionParam === 'latest' ? this.newest() : this.sessions.get(sessionParam) ?? null
    return s ? { id: s.id, lastSeenAt: s.lastSeenAt, meta: s.meta } : null
  }

  listSessions() {
    const now = Date.now()
    return Array.from(this.sessions.values()).map((s) => ({
      id: s.id,
      firstSeenAt: s.firstSeenAt,
      lastSeenAt: s.lastSeenAt,
      ageMs: now - s.lastSeenAt,
      meta: s.meta,
    }))
  }
}
