/**
 * Browser connector for qdadm-mcp-relay (#1400, #2231).
 *
 * Install it FIRST in your entry (for boot capture). It never connects on
 * its own:
 *
 * - it exposes `window.__qdadmRelay`, the pairing controller behind the
 *   debug bar's "Pair MCP" button: scan the relay ports, show the code the
 *   agent needs, keep the pairing across reloads;
 * - a tab paired before re-pairs on load — one attempt, on the remembered
 *   port — with boot capture armed before the app's first statement;
 * - the `#qdadm-relay=ws://…/<token>` fragment of #1400 still connects
 *   directly.
 *
 * A visitor who never paired runs exactly the app they would without it:
 * no socket, no console wrapper.
 *
 * ```ts
 * // main.ts — FIRST import for full boot-error capture
 * import { installQdadmRelayConnector } from '@quazardous/qdadm-mcp/connector'
 * installQdadmRelayConnector()
 * ```
 *
 * Once paired, the page answers the same typed queries as the dev-mode
 * injected client (sessionInfo, routes, entityState, entityCall,
 * storageDump, bootlog, recentSignals, plus describe/dump/call). The MCP
 * acts within THIS browser session: manager permissions apply.
 */
import { RELAY_PORTS, RELAY_PROTOCOL, type RelayIdentity } from './protocol.ts'

interface BootEntry {
  at: number
  msg: string
  source?: string
}

interface QdadmGlobal {
  kernel?: { options?: { app?: { name?: string; version?: string | (() => string) } } }
  orchestrator?: {
    isRegistered(name: string): boolean
    getRegisteredNames(): string[]
    get(name: string): Record<string, unknown> & {
      list(params?: unknown): Promise<unknown>
      get(id: unknown): Promise<unknown>
      create(data: unknown): Promise<unknown>
      update(id: unknown, data: unknown): Promise<unknown>
      delete(id: unknown): Promise<unknown>
    }
  }
  router?: {
    currentRoute: { value: { name?: unknown; fullPath?: string } }
    getRoutes(): Array<{ name?: unknown; path: string; meta?: Record<string, unknown> }>
  }
  signals?: { on(pattern: string, cb: (event: { name?: string }) => void): unknown }
  debug?: { bridge?: { describe(): unknown; dump(): unknown; call(c: string, a: string, args: unknown): Promise<unknown> } }
}

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

type WebSocketCtor = new (url: string) => WebSocket

export interface QdadmRelayConnectorOptions {
  /** Token flow: explicit relay ws url (overrides the URL fragment). */
  url?: string
  /** Token flow: explicit token (overrides the URL fragment). */
  token?: string
  /** Token flow: reconnect attempts before giving up (default 20). */
  maxRetries?: number
  /** Ports "Pair MCP" scans (default: the relay's own list). */
  ports?: readonly number[]
  /** Host the relay listens on (default 'localhost'). */
  host?: string
  /**
   * How long a port may stay CONNECTING before the scan reports it as held
   * back (default 1500 ms). On a public https origin Chrome holds loopback
   * connections behind a local-network-access prompt: nothing reaches the
   * relay until the user allows it.
   */
  probeTimeoutMs?: number
  /** Test seams. */
  WebSocket?: WebSocketCtor
  storage?: StorageLike
  tabStorage?: StorageLike
}

export type RelayPairingState =
  | { status: 'idle' }
  | { status: 'scanning'; ports: readonly number[] }
  | { status: 'none-found'; ports: readonly number[]; permissionPending: boolean }
  | { status: 'choose'; relays: RelayIdentity[] }
  | { status: 'awaiting-code'; code: string; relay: RelayIdentity }
  | { status: 'reconnecting'; relay: RelayIdentity }
  | { status: 'paired'; relay: RelayIdentity; instanceId: string }
  | { status: 'error'; message: string }

/** What `window.__qdadmRelay` offers — the debug bar drives pairing through it. */
export interface QdadmRelayController {
  /** Stable for the life of the tab, reloads included. */
  readonly instanceId: string
  readonly state: RelayPairingState
  /** Called at once with the current state, then on every change. */
  subscribe(listener: (state: RelayPairingState) => void): () => void
  /** Scan (or try one port) and ask the relay found to pair. */
  pair(port?: number): Promise<void>
  unpair(): void
}

const FRAGMENT_RE = /#qdadm-relay=(wss?:\/\/[^/]+)\/([\w-]+)/
const PAIRING_KEY = 'qdadm-relay:pairing'
const INSTANCE_KEY = 'qdadm-relay:instance'
const HELLO_TIMEOUT_MS = 1000
/** Retries after a live paired connection drops; a page load gets one attempt. */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000]

interface SavedPairing {
  port: number
  key: string
  relay: RelayIdentity
}

type ProbeResult =
  | { port: number; outcome: 'refused' | 'pending' | 'foreign' }
  | { port: number; outcome: 'relay'; relay: RelayIdentity; ws: WebSocket }

const parse = (data: unknown): Record<string, unknown> | null => {
  try {
    const v = JSON.parse(String(data))
    return typeof v === 'object' && v !== null ? v : null
  } catch {
    return null
  }
}

/** Storage that never throws — blocked site data must not break the page. */
function safeStorage(get: () => Storage): StorageLike {
  const guard = <T>(fn: (s: Storage) => T, fallback: T): T => {
    try {
      return fn(get())
    } catch {
      return fallback
    }
  }
  return {
    getItem: (k) => guard((s) => s.getItem(k), null),
    setItem: (k, v) => guard((s) => s.setItem(k, v), undefined),
    removeItem: (k) => guard((s) => s.removeItem(k), undefined),
  }
}

export function installQdadmRelayConnector(options: QdadmRelayConnectorOptions = {}): QdadmRelayController | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { __qdadmRelay?: QdadmRelayController; __qdadm?: QdadmGlobal }
  // Installed twice (HMR re-running the entry): keep the live controller.
  if (w.__qdadmRelay) return w.__qdadmRelay

  const WS: WebSocketCtor = options.WebSocket ?? window.WebSocket
  const store = options.storage ?? safeStorage(() => window.localStorage)
  const tabStore = options.tabStorage ?? safeStorage(() => window.sessionStorage)
  const ports = options.ports ?? RELAY_PORTS
  const host = options.host ?? 'localhost'
  const probeTimeoutMs = options.probeTimeoutMs ?? 1500

  // One id per tab, kept across reloads (#2231): a reload is the same instance.
  let instanceId = tabStore.getItem(INSTANCE_KEY)
  if (!instanceId) {
    instanceId = crypto.randomUUID()
    tabStore.setItem(INSTANCE_KEY, instanceId)
  }
  const id = instanceId

  const page = createPageAgent(id, () => w.__qdadm ?? {})

  const answer = async (ws: WebSocket, msg: Record<string, unknown>) => {
    let reply: Record<string, unknown>
    try {
      const data = await page.handle(String(msg.type), msg.payload as Record<string, unknown> | undefined)
      reply = { kind: 'reply', id: msg.id, ok: true, data }
    } catch (e) {
      reply = { kind: 'reply', id: msg.id, ok: false, error: (e as Error).message }
    }
    try {
      ws.send(JSON.stringify(reply))
    } catch {
      /* the socket went away mid-request */
    }
  }

  // ── token flow (#1400) ─────────────────────────────────────────────────
  let url = options.url ?? null
  let token = options.token ?? null
  if (!url || !token) {
    const m = window.location.hash.match(FRAGMENT_RE)
    if (m) {
      url = url ?? m[1]
      token = token ?? m[2]
    }
  }
  if (url && token) {
    page.arm()
    const maxRetries = options.maxRetries ?? 20
    let retries = 0
    const connect = () => {
      const ws = new WS(url!)
      ws.onopen = () => {
        retries = 0
        ws.send(
          JSON.stringify({
            kind: 'hello',
            token,
            sessionId: id,
            meta: { userAgent: navigator.userAgent, location: window.location.pathname, transport: 'relay' },
          })
        )
        page.armSignals()
      }
      ws.onmessage = (event) => {
        const msg = parse(event.data)
        if (msg?.kind === 'request' && msg.type) void answer(ws, msg)
      }
      ws.onclose = () => {
        if (retries++ < maxRetries) setTimeout(connect, Math.min(1000 * retries, 5000))
      }
    }
    connect()
  }

  // ── pairing (#2231) ────────────────────────────────────────────────────
  let state: RelayPairingState = { status: 'idle' }
  const listeners = new Set<(s: RelayPairingState) => void>()
  const setState = (next: RelayPairingState) => {
    state = next
    for (const listener of listeners) {
      try {
        listener(next)
      } catch {
        /* a broken listener must not break pairing */
      }
    }
  }
  let socket: WebSocket | null = null

  const readSaved = (): SavedPairing | null => {
    const v = parse(store.getItem(PAIRING_KEY))
    return v && typeof v.port === 'number' && typeof v.key === 'string' ? (v as unknown as SavedPairing) : null
  }

  const probe = (port: number): Promise<ProbeResult> =>
    new Promise((resolve) => {
      let ws: WebSocket
      try {
        ws = new WS(`ws://${host}:${port}/`)
      } catch {
        resolve({ port, outcome: 'refused' })
        return
      }
      let settled = false
      let helloTimer: ReturnType<typeof setTimeout> | undefined
      const finish = (result: ProbeResult) => {
        if (settled) return
        settled = true
        clearTimeout(heldTimer)
        clearTimeout(helloTimer)
        ws.onopen = ws.onerror = ws.onclose = ws.onmessage = null
        if (result.outcome !== 'relay') {
          try {
            ws.close()
          } catch {
            /* already gone */
          }
        }
        resolve(result)
      }
      // Still CONNECTING past the timeout: the browser is holding it back.
      const heldTimer = setTimeout(
        () => finish({ port, outcome: ws.readyState === 0 ? 'pending' : 'foreign' }),
        probeTimeoutMs
      )
      ws.onerror = () => finish({ port, outcome: 'refused' })
      ws.onclose = () => finish({ port, outcome: 'refused' })
      ws.onopen = () => {
        clearTimeout(heldTimer)
        helloTimer = setTimeout(() => finish({ port, outcome: 'foreign' }), HELLO_TIMEOUT_MS)
      }
      ws.onmessage = (event) => {
        const msg = parse(event.data)
        if (msg?.kind === 'relay-hello' && msg.name === 'qdadm-mcp-relay' && msg.protocol === RELAY_PROTOCOL) {
          const { kind: _kind, ...relay } = msg
          finish({ port, outcome: 'relay', relay: relay as unknown as RelayIdentity, ws })
        } else {
          finish({ port, outcome: 'foreign' })
        }
      }
    })

  const bind = (ws: WebSocket, relay: RelayIdentity, port: number, pairingKey?: string) => {
    socket = ws
    ws.onmessage = (event) => {
      const msg = parse(event.data)
      if (!msg) return
      if (msg.kind === 'request' && msg.type) {
        void answer(ws, msg)
      } else if (msg.kind === 'pair-pending') {
        setState({ status: 'awaiting-code', code: String(msg.code), relay })
      } else if (msg.kind === 'paired') {
        store.setItem(PAIRING_KEY, JSON.stringify({ port, key: String(msg.pairingKey), relay } satisfies SavedPairing))
        page.armSignals()
        setState({ status: 'paired', relay, instanceId: id })
      } else if (msg.kind === 'pair-refused') {
        if (msg.reason === 'unknown-pairing') store.removeItem(PAIRING_KEY)
        setState({ status: 'error', message: String(msg.message ?? 'The relay refused to pair this tab.') })
      } else if (msg.kind === 'unpaired') {
        store.removeItem(PAIRING_KEY)
        setState({
          status: 'error',
          message:
            msg.reason === 'replaced'
              ? 'Another tab was paired with this relay since — this one no longer is.'
              : 'The relay unpaired this tab.',
        })
      }
    }
    ws.onerror = null
    ws.onclose = () => {
      if (socket !== ws) return
      socket = null
      if (state.status === 'paired') void reconnect(0)
      else if (state.status === 'awaiting-code') {
        setState({ status: 'error', message: 'The relay went away before the pairing was accepted.' })
      }
    }
    ws.send(
      JSON.stringify({
        kind: 'pair',
        instanceId: id,
        pairingKey,
        meta: { userAgent: navigator.userAgent, location: window.location.pathname, title: document.title },
      })
    )
  }

  /** Present the saved pairing again. `attempt` indexes RECONNECT_DELAYS_MS. */
  const reconnect = async (attempt: number, retry = true): Promise<void> => {
    const saved = readSaved()
    if (!saved) return
    setState({ status: 'reconnecting', relay: saved.relay })
    const result = await probe(saved.port)
    if (result.outcome === 'relay') return bind(result.ws, result.relay, saved.port, saved.key)
    if (retry && attempt < RECONNECT_DELAYS_MS.length) {
      setTimeout(() => void reconnect(attempt + 1), RECONNECT_DELAYS_MS[attempt])
      return
    }
    setState({
      status: 'error',
      message:
        result.outcome === 'pending'
          ? 'The browser is holding the connection to the relay: allow local network access for this site, then click Pair.'
          : `The paired relay (${saved.relay.project}, port ${saved.port}) is not answering. Start it again, then click Pair.`,
    })
  }

  const dropSocket = () => {
    const ws = socket
    socket = null
    if (!ws) return
    ws.onclose = null
    try {
      ws.close()
    } catch {
      /* already gone */
    }
  }

  const pair = async (port?: number): Promise<void> => {
    if (state.status === 'scanning' || state.status === 'reconnecting') return
    page.arm()
    dropSocket()
    const targets = port ? [port] : ports
    setState({ status: 'scanning', ports: targets })
    const results = await Promise.all(targets.map(probe))
    const relays = results.filter((r): r is Extract<ProbeResult, { outcome: 'relay' }> => r.outcome === 'relay')
    if (relays.length === 1) return bind(relays[0].ws, relays[0].relay, relays[0].port)
    for (const r of relays) r.ws.close()
    if (relays.length > 1) return setState({ status: 'choose', relays: relays.map((r) => r.relay) })
    setState({ status: 'none-found', ports: targets, permissionPending: results.some((r) => r.outcome === 'pending') })
  }

  const unpair = () => {
    store.removeItem(PAIRING_KEY)
    const ws = socket
    if (ws && ws.readyState === 1) {
      try {
        ws.send(JSON.stringify({ kind: 'unpair' }))
      } catch {
        /* closing anyway */
      }
    }
    dropSocket()
    setState({ status: 'idle' })
  }

  const controller: QdadmRelayController = {
    instanceId: id,
    get state() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(state)
      return () => listeners.delete(listener)
    },
    pair,
    unpair,
  }
  w.__qdadmRelay = controller

  // A tab paired before re-pairs now, before the app runs: boot capture sees
  // a crash during boot, and the agent keeps its target across the reload.
  if (!(url && token) && readSaved()) {
    page.arm()
    void reconnect(0, false)
  }

  return controller
}

/**
 * The page side of every request: boot capture plus the typed query handlers.
 * Nothing is wrapped until `arm()` — a tab that never pairs is untouched.
 */
function createPageAgent(sessionId: string, q: () => QdadmGlobal) {
  const bootAt = Date.now()
  const bootlog = { errors: [] as BootEntry[], warns: [] as BootEntry[], pageErrors: [] as BootEntry[], rejections: [] as BootEntry[] }
  const cap = (arr: BootEntry[], entry: BootEntry) => {
    arr.push(entry)
    if (arr.length > 200) arr.shift()
  }
  const fmt = (args: unknown[]): string => {
    try {
      return args
        .map((a) => {
          if (a instanceof Error) return a.stack || a.message
          if (typeof a === 'object') {
            try {
              return JSON.stringify(a)
            } catch {
              return String(a)
            }
          }
          return String(a)
        })
        .join(' ')
        .slice(0, 2000)
    } catch {
      return '[unformattable]'
    }
  }

  let armed = false
  const arm = () => {
    if (armed) return
    armed = true
    const origError = console.error.bind(console)
    const origWarn = console.warn.bind(console)
    console.error = (...args: unknown[]) => {
      cap(bootlog.errors, { at: Date.now(), msg: fmt(args) })
      origError(...args)
    }
    console.warn = (...args: unknown[]) => {
      cap(bootlog.warns, { at: Date.now(), msg: fmt(args) })
      origWarn(...args)
    }
    window.addEventListener('error', (e) => {
      cap(bootlog.pageErrors, {
        at: Date.now(),
        msg: String(e.message || e),
        source: e.filename ? `${e.filename}:${e.lineno}` : undefined,
      })
    })
    window.addEventListener('unhandledrejection', (e) => {
      let msg: string
      try {
        const r = (e as PromiseRejectionEvent).reason
        msg = (r && (r.stack || r.message)) || String(r)
      } catch {
        msg = '[unreadable reason]'
      }
      cap(bootlog.rejections, { at: Date.now(), msg: String(msg).slice(0, 2000) })
    })
  }

  const signalBuffer: Array<{ at: number; name?: string }> = []
  let signalsArmed = false
  const armSignals = () => {
    if (signalsArmed) return
    const signals = q().signals
    if (!signals) return
    try {
      signals.on('**', (event) => {
        signalBuffer.push({ at: Date.now(), name: event?.name })
        if (signalBuffer.length > 100) signalBuffer.shift()
      })
      signalsArmed = true
    } catch {
      /* not ready yet */
    }
  }

  const manager = (entity: string) => {
    const orch = q().orchestrator
    if (!orch) throw new Error('orchestrator not ready')
    if (!orch.isRegistered(entity)) {
      throw new Error(`entity not registered: ${entity} (known: ${orch.getRegisteredNames().join(', ')})`)
    }
    return orch.get(entity)
  }

  const handlers: Record<string, (payload?: Record<string, unknown>) => unknown | Promise<unknown>> = {
    bootlog: () => bootlog,
    sessionInfo: () => {
      const app = q().kernel?.options?.app ?? {}
      let route: unknown = null
      try {
        const r = q().router?.currentRoute?.value
        route = r ? { name: r.name, fullPath: r.fullPath } : null
      } catch {
        /* router not ready */
      }
      return {
        sessionId,
        bootAt,
        now: Date.now(),
        url: window.location.href,
        transport: 'relay',
        app: { name: app.name, version: typeof app.version === 'function' ? app.version() : app.version },
        route,
        bridgeReady: !!q().debug?.bridge,
        signalsArmed,
        bootlogCounts: {
          errors: bootlog.errors.length,
          warns: bootlog.warns.length,
          pageErrors: bootlog.pageErrors.length,
          rejections: bootlog.rejections.length,
        },
      }
    },
    recentSignals: () => {
      armSignals()
      return { armed: signalsArmed, events: signalBuffer }
    },
    routes: () => {
      const router = q().router
      if (!router) throw new Error('router not ready')
      return router.getRoutes().map((r) => ({
        name: r.name,
        path: r.path,
        meta: {
          entity: r.meta?.entity,
          layout: r.meta?.layout,
          requiresAuth: r.meta?.requiresAuth,
          public: r.meta?.public,
        },
      }))
    },
    entityState: (payload) => {
      if (!payload?.entity) {
        return { entities: q().orchestrator?.getRegisteredNames() ?? [] }
      }
      const m = manager(String(payload.entity)) as Record<string, unknown> & {
        canCreate?: () => boolean
        canRead?: () => boolean
        canUpdate?: () => boolean
        canDelete?: () => boolean
      }
      const safe = (fn: () => unknown) => {
        try {
          return fn()
        } catch (e) {
          return `[error: ${(e as Error).message}]`
        }
      }
      const fields: Record<string, unknown> = {}
      try {
        const fs = (m.fields ?? m._fields ?? {}) as Record<string, { type?: unknown; label?: unknown; required?: unknown }>
        for (const k in fs) fields[k] = { type: fs[k]?.type, label: fs[k]?.label, required: !!fs[k]?.required }
      } catch {
        /* keep empty */
      }
      return {
        entity: payload.entity,
        idField: safe(() => m.idField),
        labelField: safe(() => m.labelField),
        label: safe(() => m.label),
        labelPlural: safe(() => m.labelPlural),
        can: {
          create: safe(() => m.canCreate?.()),
          read: safe(() => m.canRead?.()),
          update: safe(() => m.canUpdate?.()),
          delete: safe(() => m.canDelete?.()),
        },
        fields,
        storage: safe(() => {
          const st = (m.storage ?? m._storage) as { constructor?: { name?: string }; _storageKey?: string } | undefined
          return st ? { kind: st.constructor?.name, storageKey: st._storageKey } : null
        }),
      }
    },
    entityCall: async (payload) => {
      if (!payload?.entity || !payload.op) throw new Error('entityCall requires { entity, op, ... }')
      const m = manager(String(payload.entity))
      const op = String(payload.op)
      if (op === 'list') return await m.list(payload.params ?? {})
      if (op === 'get') return await m.get(payload.id)
      if (op === 'create') return await m.create(payload.data ?? {})
      if (op === 'update') return await m.update(payload.id, payload.data ?? {})
      if (op === 'delete') {
        await m.delete(payload.id)
        return { deleted: payload.id }
      }
      throw new Error(`unknown op "${op}" (list|get|create|update|delete)`)
    },
    storageDump: (payload) => {
      if (!payload?.entity) throw new Error('storageDump requires { entity }')
      const m = manager(String(payload.entity)) as Record<string, unknown>
      const st = (m.storage ?? m._storage) as { constructor?: { name?: string }; _storageKey?: string } | undefined
      const key = st?._storageKey
      if (!key) return { storageKey: null, note: `storage exposes no localStorage key (${st?.constructor?.name})` }
      const raw = localStorage.getItem(key)
      let parsed: unknown = null
      try {
        parsed = raw ? JSON.parse(raw) : null
      } catch {
        parsed = '[unparsable]'
      }
      return { storageKey: key, count: Array.isArray(parsed) ? parsed.length : null, data: parsed }
    },
    describe: () => {
      const b = q().debug?.bridge
      if (!b) throw new Error('debug bridge not ready')
      return b.describe()
    },
    dump: () => {
      const b = q().debug?.bridge
      if (!b) throw new Error('debug bridge not ready')
      return b.dump()
    },
    call: async (payload) => {
      const b = q().debug?.bridge
      if (!b) throw new Error('debug bridge not ready')
      if (!payload?.collector || !payload.action) throw new Error('call requires { collector, action, args? }')
      return await b.call(String(payload.collector), String(payload.action), payload.args ?? {})
    },
  }

  return {
    arm,
    armSignals,
    handle: async (type: string, payload?: Record<string, unknown>) => {
      const handler = handlers[type]
      if (!handler) throw new Error(`unknown request type "${type}"`)
      return await handler(payload)
    },
  }
}

export default installQdadmRelayConnector
