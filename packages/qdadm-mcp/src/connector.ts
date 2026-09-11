/**
 * Browser connector for qdadm-mcp-relay (#1400, #2231).
 *
 * Install it FIRST in your entry (for boot capture). It never connects on
 * its own:
 *
 * - on a page served by the dev server (qdadmMcpPlugin marks it), it
 *   connects to the machine's relay at startup, with no pairing code, and
 *   reconnects after a reload or a relay restart;
 * - it exposes `window.__qdadmRelay`, the pairing controller behind the
 *   debug bar's MCP tab: scan the relay ports, show the code the
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
import { RELAY_AUTO_GLOBAL, RELAY_PORTS, RELAY_PROTOCOL, type RelayAutoConfig, type RelayIdentity } from './protocol.ts'

interface BootEntry {
  at: number
  msg: string
  source?: string
  /** Global order of log entries, so a feedback window can tell what is new. */
  seq?: number
}

/** Where the tab stood when an action started (#2247). */
interface FeedbackMark {
  log: number
  signal: number
  route: string | null
  at: number
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
    currentRoute: { value: { name?: unknown; fullPath?: string; params?: Record<string, unknown> } }
    getRoutes(): Array<{ name?: unknown; path: string; meta?: Record<string, unknown> }>
    push?(to: unknown): Promise<unknown>
  }
  signals?: { on(pattern: string, cb: (event: { name?: string; data?: unknown }) => void): unknown }
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
  /** Ports the MCP tab scans (default: the relay's own list). */
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
  | { status: 'connecting' }
  | { status: 'connected'; relay: RelayIdentity; instanceId: string }
  | { status: 'offline'; message: string; retryInMs: number }
  | { status: 'scanning'; ports: readonly number[] }
  | { status: 'none-found'; ports: readonly number[]; permissionPending: boolean }
  | { status: 'choose'; relays: RelayIdentity[] }
  | { status: 'awaiting-code'; code: string; relay: RelayIdentity }
  | { status: 'reconnecting'; relay: RelayIdentity }
  | { status: 'paired'; relay: RelayIdentity; instanceId: string }
  | { status: 'error'; message: string }

/** One line of the MCP tab's chat (#2231). */
export interface RelayChatMessage {
  id: number
  from: 'agent' | 'user'
  text: string
  at: number
}

/** One MCP request this tab served (#2231) — a line of the MCP tab's history. */
export interface RelayActivityEntry {
  id: number
  at: number
  /** The MCP tool the request came from, as the agent called it. */
  tool: string
  detail: string
  ok: boolean
  error?: string
  ms: number
}

const TOOL_OF_REQUEST: Record<string, string> = {
  sessionInfo: 'session_info',
  bootlog: 'boot_errors',
  routes: 'routes',
  entityState: 'entity_state',
  storageDump: 'storage_dump',
  recentSignals: 'recent_signals',
  describe: 'describe',
  dump: 'dump',
  chatPost: 'chat_send',
  chatRead: 'chat_read',
}

const brief = (value: unknown, max = 160): string => {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value)
    return text.length > max ? `${text.slice(0, max - 1)}…` : text
  } catch {
    return ''
  }
}

/** Name a request the way the agent thinks of it: the tool, and what it was about. */
function describeRequest(type: string, payload?: Record<string, unknown>): { tool: string; detail: string } {
  if (type === 'entityCall') {
    const parts = [String(payload?.entity ?? '?')]
    if (payload?.id !== undefined) parts.push(`#${String(payload.id)}`)
    if (payload?.params) parts.push(brief(payload.params))
    if (payload?.data) parts.push(brief(payload.data))
    return { tool: `entity_${String(payload?.op ?? '?')}`, detail: parts.join(' ') }
  }
  if (type === 'call') {
    const args = payload?.args as Record<string, unknown> | undefined
    const withArgs = args && Object.keys(args).length > 0 ? ` ${brief(args)}` : ''
    return { tool: 'bridge_call', detail: `${String(payload?.collector)}.${String(payload?.action)}${withArgs}` }
  }
  if (type === 'navigate') return { tool: 'navigate', detail: String(payload?.path ?? payload?.route ?? '') }
  if (type === 'waitFor') return { tool: 'wait_for', detail: String(payload?.route ?? payload?.signal ?? '') }
  if (type === 'chatPost') return { tool: 'chat_send', detail: brief(payload?.message) }
  if (type === 'entityState' || type === 'storageDump') {
    return { tool: TOOL_OF_REQUEST[type], detail: payload?.entity ? String(payload.entity) : '' }
  }
  return { tool: TOOL_OF_REQUEST[type] ?? type, detail: '' }
}

/** What `window.__qdadmRelay` offers — the debug bar drives pairing through it. */
export interface QdadmRelayController {
  /** Stable for the life of the tab, reloads included. */
  readonly instanceId: string
  /** `auto`: a dev page, connected without a code. `pairing`: Pair + code. `token`: the URL fragment. */
  readonly mode: 'auto' | 'pairing' | 'token'
  readonly state: RelayPairingState
  /** Called at once with the current state, then on every change. */
  subscribe(listener: (state: RelayPairingState) => void): () => void
  /** Scan (or try one port) and ask the relay found to pair. */
  pair(port?: number): Promise<void>
  unpair(): void
  /** A small chat between the agent (`chat_send` / `chat_read`) and whoever looks at the tab. */
  readonly chat: {
    readonly messages: readonly RelayChatMessage[]
    /** From the person at the tab. */
    send(text: string): void
    /** Wipe the conversation — messages the agent has not read yet included. */
    clear(): void
    /** Called at once with the messages, then on every new one. */
    subscribe(listener: (messages: readonly RelayChatMessage[]) => void): () => void
  }
  /** Every MCP request this tab served, newest last (100 kept). */
  readonly activity: {
    readonly entries: readonly RelayActivityEntry[]
    /** Called at once with the entries, then on every new one. */
    subscribe(listener: (entries: readonly RelayActivityEntry[]) => void): () => void
  }
}

const FRAGMENT_RE = /#qdadm-relay=(wss?:\/\/[^/]+)\/([\w-]+)/
const PAIRING_KEY = 'qdadm-relay:pairing'
const INSTANCE_KEY = 'qdadm-relay:instance'
const CHAT_KEY = 'qdadm-relay:chat'
const ACTIVITY_KEY = 'qdadm-relay:activity'
const HELLO_TIMEOUT_MS = 1000
/** Retries after a live paired connection drops; a page load gets one attempt. */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000]
/** Dev pages keep trying: the dev server restarts the relay when it is gone. */
const AUTO_DELAYS_MS = [1000, 2000, 5000, 10000]

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

  // ── chat (#2231) ───────────────────────────────────────────────────────
  // Kept for the tab in sessionStorage: a reload (HMR included) must not eat a
  // message the agent has not read yet.
  const savedChat = parse(tabStore.getItem(CHAT_KEY)) as { seq?: number; readUpTo?: number; messages?: RelayChatMessage[] } | null
  const chatMessages: RelayChatMessage[] = Array.isArray(savedChat?.messages) ? savedChat.messages : []
  const chatListeners = new Set<(messages: readonly RelayChatMessage[]) => void>()
  let chatSeq = typeof savedChat?.seq === 'number' ? savedChat.seq : 0
  let agentReadUpTo = typeof savedChat?.readUpTo === 'number' ? savedChat.readUpTo : 0
  const saveChat = () =>
    tabStore.setItem(CHAT_KEY, JSON.stringify({ seq: chatSeq, readUpTo: agentReadUpTo, messages: chatMessages }))
  const notifyChat = () => {
    for (const listener of chatListeners) {
      try {
        listener(chatMessages)
      } catch {
        /* a broken listener must not break the chat */
      }
    }
  }
  const pushChat = (from: RelayChatMessage['from'], text: string) => {
    chatMessages.push({ id: ++chatSeq, from, text: text.slice(0, 4000), at: Date.now() })
    if (chatMessages.length > 100) chatMessages.shift()
    saveChat()
    notifyChat()
  }
  const unreadFromUser = () => chatMessages.filter((m) => m.from === 'user' && m.id > agentReadUpTo)
  const chatHandlers: Record<string, (payload?: Record<string, unknown>) => unknown> = {
    chatPost: (payload) => {
      const text = String(payload?.message ?? '').trim()
      if (!text) throw new Error('chat_send needs a non-empty message')
      pushChat('agent', text)
      return { shown: true, unreadFromUser: unreadFromUser().length }
    },
    chatRead: () => {
      const unread = unreadFromUser()
      agentReadUpTo = chatSeq
      saveChat()
      return unread.length > 0
        ? { messages: unread.map(({ text, at }) => ({ text, at })) }
        : { messages: [], note: 'Nothing new from the user.' }
    },
  }

  const pageMeta = () => {
    let app: string | undefined
    try {
      app = w.__qdadm?.kernel?.options?.app?.name
    } catch {
      /* not booted yet */
    }
    return { app, title: document.title, location: window.location.pathname, userAgent: navigator.userAgent, transport: 'relay' }
  }

  /** The app's name exists only once the kernel is up — tell the relay when it is. */
  const announceApp = (ws: WebSocket) => {
    let tries = 0
    const timer = setInterval(() => {
      const meta = pageMeta()
      if (!meta.app && ++tries < 40 && ws.readyState === 1) return
      clearInterval(timer)
      if (meta.app && ws.readyState === 1) ws.send(JSON.stringify({ kind: 'meta', meta }))
    }, 250)
  }

  // ── history (#2231): what agents did in this tab ─────────────────────
  const savedActivity = parse(tabStore.getItem(ACTIVITY_KEY)) as { seq?: number; entries?: RelayActivityEntry[] } | null
  const activityEntries: RelayActivityEntry[] = Array.isArray(savedActivity?.entries) ? savedActivity.entries : []
  const activityListeners = new Set<(entries: readonly RelayActivityEntry[]) => void>()
  let activitySeq = typeof savedActivity?.seq === 'number' ? savedActivity.seq : 0
  const recordActivity = (entry: Omit<RelayActivityEntry, 'id'>) => {
    activityEntries.push({ id: ++activitySeq, ...entry })
    if (activityEntries.length > 100) activityEntries.shift()
    tabStore.setItem(ACTIVITY_KEY, JSON.stringify({ seq: activitySeq, entries: activityEntries }))
    for (const listener of activityListeners) {
      try {
        listener(activityEntries)
      } catch {
        /* a broken listener must not break the history */
      }
    }
  }

  const answer = async (ws: WebSocket, msg: Record<string, unknown>) => {
    let reply: Record<string, unknown>
    const type = String(msg.type)
    const payload = msg.payload as Record<string, unknown> | undefined
    const { tool, detail } = describeRequest(type, payload)
    // The feedback window around an action is plumbing, not something an agent did.
    const logged = !type.startsWith('feedback')
    const at = Date.now()
    try {
      const data = chatHandlers[type] ? chatHandlers[type](payload) : await page.handle(type, payload)
      reply = { kind: 'reply', id: msg.id, ok: true, data }
      if (logged) recordActivity({ at, tool, detail, ok: true, ms: Date.now() - at })
    } catch (e) {
      reply = { kind: 'reply', id: msg.id, ok: false, error: (e as Error).message }
      if (logged) recordActivity({ at, tool, detail, ok: false, error: (e as Error).message, ms: Date.now() - at })
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
            meta: pageMeta(),
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
        announceApp(ws)
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
        meta: pageMeta(),
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
    // A dev page is already connected, with no code to exchange.
    if (mode === 'auto') return
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

  // ── dev auto-connect (#2231) ─────────────────────────────────────────
  const autoPath = (w as unknown as Record<string, unknown>)[RELAY_AUTO_GLOBAL]
  const mode: QdadmRelayController['mode'] = url && token ? 'token' : typeof autoPath === 'string' ? 'auto' : 'pairing'
  let autoAttempt = 0

  const retryAuto = (message: string) => {
    const retryInMs = AUTO_DELAYS_MS[Math.min(autoAttempt++, AUTO_DELAYS_MS.length - 1)]
    setState({ status: 'offline', message, retryInMs })
    setTimeout(() => void autoConnect(), retryInMs)
  }

  const autoConnect = async (): Promise<void> => {
    if (state.status !== 'offline') setState({ status: 'connecting' })
    let config: RelayAutoConfig
    try {
      // Asked every time: a restarted relay has a new port or token, and the
      // dev server starts one when there is none.
      const res = await fetch(String(autoPath), { cache: 'no-store' })
      const body = (await res.json().catch(() => ({}))) as Partial<RelayAutoConfig> & { error?: string }
      if (!res.ok || typeof body.port !== 'number' || typeof body.token !== 'string') {
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      config = body as RelayAutoConfig
    } catch (e) {
      return retryAuto(`The dev server could not provide the relay (${(e as Error).message}).`)
    }
    const result = await probe(config.port)
    if (result.outcome !== 'relay') return retryAuto(`No relay answered on port ${config.port}.`)

    const ws = result.ws
    socket = ws
    ws.onmessage = (event) => {
      const msg = parse(event.data)
      if (!msg) return
      if (msg.kind === 'request' && msg.type) {
        void answer(ws, msg)
      } else if (msg.kind === 'welcome') {
        autoAttempt = 0
        page.armSignals()
        announceApp(ws)
        setState({ status: 'connected', relay: result.relay, instanceId: id })
      }
    }
    ws.onerror = null
    ws.onclose = () => {
      if (socket !== ws) return
      socket = null
      retryAuto('The connection to the relay dropped.')
    }
    ws.send(JSON.stringify({ kind: 'hello', token: config.token, sessionId: id, meta: pageMeta() }))
  }

  const controller: QdadmRelayController = {
    instanceId: id,
    mode,
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
    chat: {
      get messages() {
        return chatMessages
      },
      send(text: string) {
        const trimmed = String(text ?? '').trim()
        if (trimmed) pushChat('user', trimmed)
      },
      clear() {
        chatMessages.length = 0
        // Ids keep counting: nothing wiped can come back as unread.
        agentReadUpTo = chatSeq
        saveChat()
        notifyChat()
      },
      subscribe(listener) {
        chatListeners.add(listener)
        listener(chatMessages)
        return () => chatListeners.delete(listener)
      },
    },
    activity: {
      get entries() {
        return activityEntries
      },
      subscribe(listener) {
        activityListeners.add(listener)
        listener(activityEntries)
        return () => activityListeners.delete(listener)
      },
    },
  }
  w.__qdadmRelay = controller

  if (mode === 'auto') {
    // A dev page: connect before the app runs, so boot capture sees a crash
    // during boot.
    page.arm()
    void autoConnect()
  } else if (mode === 'pairing' && readSaved()) {
    // A tab paired before re-pairs now, for the same reason, and the agent
    // keeps its target across the reload.
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
  let logSeq = 0
  const cap = (arr: BootEntry[], entry: BootEntry) => {
    arr.push({ ...entry, seq: ++logSeq })
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

  /** Signal data kept small and JSON-safe: an agent reads it, a page may emit anything. */
  const compact = (data: unknown): unknown => {
    if (data === undefined) return undefined
    try {
      const text = JSON.stringify(data)
      return text.length <= 600 ? JSON.parse(text) : `${text.slice(0, 599)}…`
    } catch {
      return '[unserializable]'
    }
  }
  const signalBuffer: Array<{ seq: number; at: number; name?: string; data?: unknown }> = []
  let signalSeq = 0
  let signalsArmed = false
  const armSignals = () => {
    if (signalsArmed) return
    const signals = q().signals
    if (!signals) return
    try {
      signals.on('**', (event) => {
        signalBuffer.push({ seq: ++signalSeq, at: Date.now(), name: event?.name, data: compact(event?.data) })
        if (signalBuffer.length > 200) signalBuffer.shift()
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

  // ── what happened during an action (#2247) ─────────────────────────────
  const currentRoute = () => {
    try {
      const r = q().router?.currentRoute?.value
      return r ? { name: r.name ?? null, fullPath: r.fullPath ?? null, params: r.params ?? {} } : null
    } catch {
      return null
    }
  }

  const feedbackSince = (mark: FeedbackMark) => {
    const newLogs = (arr: BootEntry[]) => arr.filter((e) => (e.seq ?? 0) > mark.log).map((e) => e.msg)
    const signals = signalBuffer.filter((e) => e.seq > mark.signal)
    const route = currentRoute()
    const feedback: Record<string, unknown> = { ms: Date.now() - mark.at }
    const add = (key: string, list: unknown[]) => {
      if (list.length > 0) feedback[key] = list
    }
    if ((route?.fullPath ?? null) !== mark.route) {
      feedback.route = { from: mark.route, to: route?.fullPath ?? null, name: route?.name ?? null }
    }
    add('errors', newLogs(bootlog.errors))
    add('pageErrors', newLogs(bootlog.pageErrors))
    add('rejections', newLogs(bootlog.rejections))
    add('warnings', newLogs(bootlog.warns))
    add(
      'toasts',
      signals
        .filter((e) => e.name?.startsWith('toast:'))
        .map((e) => ({ severity: e.name!.slice('toast:'.length), ...(typeof e.data === 'object' && e.data ? e.data : {}) }))
    )
    const missing = new Map<string, unknown>()
    for (const e of signals) {
      if (e.name !== 'i18n:missing') continue
      missing.set(JSON.stringify(e.data), e.data)
    }
    add('i18nMissing', [...missing.values()])
    add('apiErrors', signals.filter((e) => e.name === 'api:error').map((e) => e.data))
    add('signals', signals.map((e) => e.name))
    return feedback
  }

  /** Resolve once no signal arrived for `quietMs` — the page has settled — or after `maxMs`. */
  const settle = async (quietMs = 250, maxMs = 3000) => {
    const started = Date.now()
    let lastSeq = signalSeq
    let quietSince = Date.now()
    while (Date.now() - started < maxMs) {
      await new Promise((r) => setTimeout(r, 50))
      if (signalSeq !== lastSeq) {
        lastSeq = signalSeq
        quietSince = Date.now()
      } else if (Date.now() - quietSince >= quietMs) {
        return
      }
    }
  }

  const handlers: Record<string, (payload?: Record<string, unknown>) => unknown | Promise<unknown>> = {
    feedbackMark: (): FeedbackMark => {
      armSignals()
      return { log: logSeq, signal: signalSeq, route: currentRoute()?.fullPath ?? null, at: Date.now() }
    },
    feedbackSince: (payload) => {
      const mark = payload?.mark as FeedbackMark | undefined
      if (!mark || typeof mark.log !== 'number') throw new Error('feedbackSince requires { mark }')
      return feedbackSince(mark)
    },
    navigate: async (payload) => {
      const router = q().router
      if (!router?.push) throw new Error('router not ready')
      armSignals()
      const target = payload?.path
        ? String(payload.path)
        : payload?.route
          ? { name: String(payload.route), params: payload.params ?? {}, query: payload.query ?? {} }
          : null
      if (!target) throw new Error('navigate needs a path ("/books") or a route name ("book-edit", with params)')
      // vue-router resolves (does not throw) when a guard blocks the navigation.
      const failure = await router.push(target)
      await settle()
      let breadcrumb: unknown = null
      try {
        breadcrumb = await q().debug?.bridge?.call('router', 'getBreadcrumb', {})
      } catch {
        /* no router collector */
      }
      return { route: currentRoute(), title: document.title, breadcrumb, ...(failure ? { blocked: String(failure) } : {}) }
    },
    waitFor: async (payload) => {
      armSignals()
      const timeoutMs = Math.min(Number(payload?.timeoutMs) || 5000, 30000)
      const wantedRoute = payload?.route ? String(payload.route) : null
      const signalPattern = payload?.signal ? new RegExp(String(payload.signal)) : null
      if (!wantedRoute && !signalPattern) {
        throw new Error('wait_for needs a route (a name, or a path prefix starting with "/") or a signal pattern')
      }
      const fromSeq = signalSeq
      const started = Date.now()
      const routeReached = () => {
        const r = currentRoute()
        if (!r || !wantedRoute) return false
        return r.name === wantedRoute || (wantedRoute.startsWith('/') && String(r.fullPath ?? '').startsWith(wantedRoute))
      }
      while (Date.now() - started < timeoutMs) {
        if (routeReached()) return { matched: 'route', route: currentRoute(), waitedMs: Date.now() - started }
        if (signalPattern) {
          const hit = signalBuffer.find((e) => e.seq > fromSeq && e.name && signalPattern.test(e.name))
          if (hit) {
            return { matched: 'signal', signal: { name: hit.name, data: hit.data }, route: currentRoute(), waitedMs: Date.now() - started }
          }
        }
        await new Promise((r) => setTimeout(r, 50))
      }
      const seen = signalBuffer.filter((e) => e.seq > fromSeq).map((e) => e.name).slice(-10)
      throw new Error(
        `wait_for timed out after ${timeoutMs} ms — route is ${currentRoute()?.fullPath ?? 'unknown'}; ` +
          `signals meanwhile: ${seen.length > 0 ? seen.join(', ') : 'none'}`
      )
    },
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
