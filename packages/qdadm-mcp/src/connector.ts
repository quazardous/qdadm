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
import { createRefs } from './page/refs.ts'
import { pause } from './page/timing.ts'
import type { UploadFile } from './page/actions.ts'

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
  network?: number
  route: string | null
  at: number
}

/** The part of the Navigation API that tells a same-document history entry from a page load. */
interface NavigationLike {
  currentEntry: { index: number } | null
  entries(): Array<{ index: number; sameDocument: boolean; url: string | null }>
}

interface LogEntry extends BootEntry {
  level: string
}

/** A fetch or XMLHttpRequest the tab made (#2247). */
interface NetworkEntry {
  seq: number
  at: number
  kind: 'fetch' | 'xhr'
  method: string
  url: string
  status?: number
  ms?: number
  error?: string
}

/** What the page header reads from a matched route record: the mounted component, else the resolved one (#2342). */
interface RouteRecordLike {
  components?: Record<string, unknown> | null
  instances?: Record<string, { $?: ComponentInstanceLike } | null | undefined>
}

interface ComponentInstanceLike {
  type?: { name?: string; __name?: string; __file?: string }
  subTree?: { component?: ComponentInstanceLike | null } | null
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
    currentRoute: {
      value: {
        name?: unknown
        fullPath?: string
        params?: Record<string, unknown>
        meta?: Record<string, unknown>
        matched?: RouteRecordLike[]
      }
    }
    getRoutes(): Array<{ name?: unknown; path: string; meta?: Record<string, unknown> }>
    push?(to: unknown): Promise<unknown>
    afterEach?(hook: () => void): unknown
  }
  signals?: { on(pattern: string, cb: (event: { name?: string; data?: unknown }) => void): unknown }
  zones?: {
    inspect?(zone: string): { blocks: Array<{ id: string | null; component: string }>; default: string | null } | null
  }
  activeStack?: { getLevels?(): Array<{ entity?: string; id?: string | null }> }
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

/** A screenshot the user annotated in the MCP tab and sent in the chat (#2309). */
export interface RelayChatImage {
  mimeType: string
  /** Base64, without the `data:` prefix. */
  data: string
}

/** One line of the MCP tab's chat (#2231). */
export interface RelayChatMessage {
  id: number
  from: 'agent' | 'user'
  text: string
  at: number
  /** The screenshot sent with the message (#2309). */
  image?: RelayChatImage
  /** It had one, dropped to keep the chat within the tab's storage. */
  imageDropped?: boolean
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

/** Requests that act on or inspect the page (#2247), by the tool they come from. */
const PAGE_TOOLS: Record<string, string> = {
  click: 'click',
  typeText: 'type_text',
  fill: 'fill',
  pressKey: 'press_key',
  hover: 'hover',
  scroll: 'scroll',
  drag: 'drag',
  uploadFile: 'upload_file',
  pageEval: 'page_eval',
  consoleMessages: 'console_messages',
  networkRequests: 'network_requests',
  screenshot: 'screenshot',
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
  if (type === 'pageSnapshot') {
    return { tool: 'page_snapshot', detail: [payload?.ref, payload?.filter].filter(Boolean).map(String).join(' ') }
  }
  if (type === 'find') return { tool: 'find', detail: [payload?.role, payload?.text && brief(payload.text)].filter(Boolean).map(String).join(' ') }
  if (type === 'pageText') return { tool: 'page_text', detail: payload?.ref ? String(payload.ref) : '' }
  if (PAGE_TOOLS[type]) {
    // What was typed stays out of the history: it may be a password.
    const typed = type === 'typeText' || type === 'fill' ? String(payload?.text ?? payload?.value ?? '') : null
    const said = typed !== null ? `(${typed.length} characters)` : (payload?.keys ?? payload?.code ?? payload?.direction ?? payload?.pattern ?? payload?.urlPattern)
    const parts = [payload?.ref, payload?.to ? `→ ${String(payload.to)}` : null, said, payload?.force === true ? 'force' : null]
    return { tool: PAGE_TOOLS[type], detail: parts.filter((p) => p !== undefined && p !== null && p !== '').map((p) => brief(p, 80)).join(' ') }
  }
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
    /** From the person at the tab, with the screenshot they annotated, if any (#2309). */
    send(text: string, image?: RelayChatImage): void
    /** A picture of the viewport for the MCP tab to annotate (#2309): real pixels while a capture runs, otherwise rendered without the debug bar. */
    shoot(): Promise<{ data: string; mimeType: string; width: number; height: number; source: 'dom' | 'tab' }>
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
  /** Real screenshots (#2247): a capture of this tab, started by the user. */
  readonly capture: {
    readonly active: boolean
    /** Whether this browser can capture a tab at all. */
    readonly supported: boolean
    /** Call it from the user's click: the browser asks them to share the tab, and only within a click. */
    start(): Promise<void>
    stop(): void
    /** Called at once with whether a capture runs, then on every change. */
    subscribe(listener: (active: boolean) => void): () => void
    /**
     * Called when an agent's `screenshot` was rendered from the page because no capture runs (#2318): the debug bar
     * offers real screenshots. The agent's picture does not wait for it.
     */
    onSuggest(listener: () => void): () => void
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
  const savedChat = parse(tabStore.getItem(CHAT_KEY)) as {
    seq?: number
    readUpTo?: number
    hookShownUpTo?: number
    messages?: RelayChatMessage[]
  } | null
  const chatMessages: RelayChatMessage[] = Array.isArray(savedChat?.messages) ? savedChat.messages : []
  const chatListeners = new Set<(messages: readonly RelayChatMessage[]) => void>()
  let chatSeq = typeof savedChat?.seq === 'number' ? savedChat.seq : 0
  let agentReadUpTo = typeof savedChat?.readUpTo === 'number' ? savedChat.readUpTo : 0
  // What an agent hook already showed the agent (#2252): each message stops the agent once.
  let hookShownUpTo = typeof savedChat?.hookShownUpTo === 'number' ? savedChat.hookShownUpTo : 0
  // Screenshots in the chat (#2309): the tab's storage holds a few MB, and the text comes first.
  const CHAT_IMAGES_KEPT = 5
  const dropImage = (m: RelayChatMessage) => {
    delete m.image
    m.imageDropped = true
  }
  const saveChat = () => {
    for (;;) {
      const value = JSON.stringify({ seq: chatSeq, readUpTo: agentReadUpTo, hookShownUpTo, messages: chatMessages })
      tabStore.setItem(CHAT_KEY, value)
      if (tabStore.getItem(CHAT_KEY) === value) return
      // Refused, the storage is full: the oldest picture goes, never the text.
      const oldest = chatMessages.find((m) => m.image)
      if (!oldest) return
      dropImage(oldest)
    }
  }
  const notifyChat = () => {
    for (const listener of chatListeners) {
      try {
        listener(chatMessages)
      } catch {
        /* a broken listener must not break the chat */
      }
    }
  }
  const pushChat = (from: RelayChatMessage['from'], text: string, image?: RelayChatImage) => {
    const message: RelayChatMessage = { id: ++chatSeq, from, text: text.slice(0, 4000), at: Date.now() }
    if (image) message.image = { mimeType: image.mimeType, data: image.data }
    chatMessages.push(message)
    if (chatMessages.length > 100) chatMessages.shift()
    const withImages = chatMessages.filter((m) => m.image)
    for (const m of withImages.slice(0, Math.max(0, withImages.length - CHAT_IMAGES_KEPT))) dropImage(m)
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
        ? {
            messages: unread.map(({ text, at, image, imageDropped }) => ({
              text,
              at,
              ...(image ? { image } : imageDropped ? { imageDropped: true } : {}),
            })),
          }
        : { messages: [], note: 'Nothing new from the user.' }
    },
    /** For agent hooks (#2252): what the user wrote that the agent neither read nor was shown. chat_read still returns it. */
    chatPending: (payload) => {
      const pending = unreadFromUser().filter((m) => m.id > hookShownUpTo)
      if (payload?.mark === true && pending.length > 0) {
        hookShownUpTo = pending[pending.length - 1].id
        saveChat()
      }
      // The picture itself stays in the tab: chat_read hands it over.
      return { messages: pending.map(({ text, at, image, imageDropped }) => ({ text, at, ...(image || imageDropped ? { screenshot: true } : {}) })) }
    },
  }

  const pageMeta = () => {
    let app: string | undefined
    try {
      app = w.__qdadm?.kernel?.options?.app?.name
    } catch {
      /* not booted yet */
    }
    return { app, title: document.title, location: pageLocation(), userAgent: navigator.userAgent, transport: 'relay' }
  }

  /** The page as the user sees it (#2317): under hash routing the path alone stays `/`, and the route is `#/books`. */
  const pageLocation = () => {
    const { pathname, hash } = window.location
    return hash.startsWith('#/') ? `${pathname}${hash}` : pathname
  }

  // The relay reads the page from the meta: `instances`, the Stop hook line, screenshot file names (#2317).
  let metaSocket: WebSocket | null = null
  let sentLocation: string | null = null
  const sendMeta = (ws: WebSocket, meta = pageMeta()) => {
    if (ws.readyState !== 1) return
    ws.send(JSON.stringify({ kind: 'meta', meta }))
    sentLocation = meta.location
  }

  /** After a route change, once the router has written the URL: tell the relay where the tab is now. */
  const routeChanged = () => {
    setTimeout(() => {
      const ws = metaSocket
      if (ws && pageLocation() !== sentLocation) sendMeta(ws)
    }, 0)
  }
  window.addEventListener('popstate', routeChanged)
  window.addEventListener('hashchange', routeChanged)
  // An in-app navigation (pushState) fires no event: the router's afterEach does, once the router exists.
  let followingRouter = false
  const followRouter = () => {
    if (followingRouter) return
    try {
      const router = w.__qdadm?.router
      if (typeof router?.afterEach !== 'function') return
      router.afterEach(routeChanged)
      followingRouter = true
    } catch {
      /* no router yet */
    }
  }

  /** The app's name and router exist only once the kernel is up — tell the relay when they do, then on every route change. */
  const announceApp = (ws: WebSocket) => {
    metaSocket = ws
    followRouter()
    let tries = 0
    const timer = setInterval(() => {
      followRouter()
      const meta = pageMeta()
      if (!meta.app && ++tries < 40 && ws.readyState === 1) return
      clearInterval(timer)
      if (meta.app) sendMeta(ws, meta)
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
    // The feedback window around an action, and a hook checking the chat, are plumbing, not something an agent did.
    const logged = !type.startsWith('feedback') && type !== 'chatPending'
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
        announceApp(ws)
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
      send(text: string, image?: RelayChatImage) {
        const trimmed = String(text ?? '').trim()
        const picture = image && typeof image.data === 'string' && image.data && /^image\//.test(String(image.mimeType)) ? image : undefined
        if (trimmed || picture) pushChat('user', trimmed, picture)
      },
      shoot: () => page.shoot(),
      clear() {
        chatMessages.length = 0
        // Ids keep counting: nothing wiped can come back as unread.
        agentReadUpTo = chatSeq
        hookShownUpTo = chatSeq
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
    capture: {
      get active() {
        return page.capture.active()
      },
      get supported() {
        return page.capture.supported()
      },
      start: () => page.capture.start(),
      stop: () => page.capture.stop(),
      subscribe: (listener) => page.capture.subscribe(listener),
      onSuggest: (listener) => page.capture.onSuggest(listener),
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
    armNetwork()
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

  // ── console and network (#2247) ────────────────────────────────────────
  // console.log, info and debug are wrapped only once an agent asks for them:
  // wrapping moves every log's source line in the devtools to this file.
  const logs: LogEntry[] = []
  let consoleArmed = false
  let consoleClearedAt = 0
  const armConsole = () => {
    if (consoleArmed) return
    consoleArmed = true
    for (const level of ['log', 'info', 'debug'] as const) {
      const original = console[level].bind(console)
      console[level] = (...args: unknown[]) => {
        logs.push({ at: Date.now(), msg: fmt(args), level, seq: ++logSeq })
        if (logs.length > 500) logs.shift()
        original(...args)
      }
    }
  }

  const network: NetworkEntry[] = []
  let networkSeq = 0
  let networkClearedAt = 0
  // The relay's own plumbing and vite's are not the app's requests.
  const OWN_REQUEST = /\/__qdadm\/|\/@vite\//
  const recordRequest = (entry: Pick<NetworkEntry, 'kind' | 'method' | 'url'>): NetworkEntry | null => {
    if (OWN_REQUEST.test(entry.url)) return null
    const recorded: NetworkEntry = { seq: ++networkSeq, at: Date.now(), ...entry }
    network.push(recorded)
    if (network.length > 300) network.shift()
    return recorded
  }
  const armNetwork = () => {
    const originalFetch = window.fetch
    if (typeof originalFetch === 'function') {
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const isRequest = typeof Request === 'function' && input instanceof Request
        const entry = recordRequest({
          kind: 'fetch',
          method: String(init?.method ?? (isRequest ? (input as Request).method : 'GET')).toUpperCase(),
          url: isRequest ? (input as Request).url : String(input),
        })
        const started = Date.now()
        try {
          const response = await originalFetch.call(window, input, init)
          if (entry) Object.assign(entry, { status: response.status, ms: Date.now() - started })
          return response
        } catch (e) {
          if (entry) Object.assign(entry, { error: (e as Error).message, ms: Date.now() - started })
          throw e
        }
      }
    }
    const xhr = window.XMLHttpRequest?.prototype as (XMLHttpRequest & { __qdadmRequest?: { method: string; url: string } }) | undefined
    if (xhr) {
      const open = xhr.open as (...args: unknown[]) => void
      const send = xhr.send
      xhr.open = function (this: typeof xhr, ...args: unknown[]) {
        this!.__qdadmRequest = { method: String(args[0]).toUpperCase(), url: String(args[1]) }
        return open.apply(this, args)
      } as XMLHttpRequest['open']
      xhr.send = function (this: NonNullable<typeof xhr>, body?: Document | XMLHttpRequestBodyInit | null) {
        const entry = this.__qdadmRequest ? recordRequest({ kind: 'xhr', ...this.__qdadmRequest }) : null
        const started = Date.now()
        if (entry) {
          this.addEventListener('loadend', () =>
            Object.assign(entry, this.status ? { status: this.status, ms: Date.now() - started } : { error: 'failed or aborted', ms: Date.now() - started })
          )
        }
        return send.call(this, body)
      }
    }
  }
  const failed = (e: NetworkEntry) => !!e.error || (e.status ?? 0) >= 400
  const clockOf = (at: number) => new Date(at).toISOString().slice(11, 23)

  /** A page_eval result an agent can read: JSON-safe, bounded, elements described with a ref. */
  const forAgent = (value: unknown, describe: (element: Element) => string): unknown => {
    const seen = new WeakSet<object>()
    const walk = (v: unknown, depth: number): unknown => {
      if (v === undefined) return '(undefined)'
      if (v === null || typeof v === 'boolean' || typeof v === 'number' || typeof v === 'string') return v
      if (typeof v === 'bigint' || typeof v === 'symbol') return String(v)
      if (typeof v === 'function') return `(function ${v.name || 'anonymous'})`
      if (v instanceof Error) return { error: v.message, stack: v.stack?.split('\n').slice(0, 5).join('\n') }
      if (v instanceof Element) return `(element ${describe(v)})`
      if (typeof v !== 'object') return String(v)
      if (seen.has(v)) return '(circular)'
      if (depth > 5) return '(…)'
      seen.add(v)
      if (v instanceof Date) return v.toISOString()
      if (Array.isArray(v) || v instanceof Set || v instanceof NodeList || v instanceof HTMLCollection) {
        return Array.from(v as ArrayLike<unknown>).slice(0, 100).map((x) => walk(x, depth + 1))
      }
      if (v instanceof Map) return Object.fromEntries(Array.from(v.entries()).slice(0, 100).map(([k, x]) => [String(k), walk(x, depth + 1)]))
      const out: Record<string, unknown> = {}
      for (const key of Object.keys(v).slice(0, 100)) {
        try {
          out[key] = walk((v as Record<string, unknown>)[key], depth + 1)
        } catch (e) {
          out[key] = `(unreadable: ${(e as Error).message})`
        }
      }
      return out
    }
    return walk(value, 0)
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
    add(
      'failedRequests',
      network
        .filter((e) => e.seq > (mark.network ?? networkSeq) && failed(e))
        .map(({ method, url, status, error }) => ({ method, url, ...(status ? { status } : {}), ...(error ? { error } : {}) }))
    )
    add('signals', signals.map((e) => e.name))
    return feedback
  }

  /** Resolve once no signal arrived for `quietMs` — the page has settled — or after `maxMs`. */
  const settle = async (quietMs = 250, maxMs = 3000) => {
    const started = Date.now()
    let lastSeq = signalSeq
    let quietSince = Date.now()
    while (Date.now() - started < maxMs) {
      await pause(50)
      if (signalSeq !== lastSeq) {
        lastSeq = signalSeq
        quietSince = Date.now()
      } else if (Date.now() - quietSince >= quietMs) {
        return
      }
    }
  }

  // ── reading the page (#2247) ───────────────────────────────────────────
  // Loaded on first use: a tab no agent inspects never downloads it.
  const aria = () => import('./page/aria.ts')
  const refs = createRefs()
  const rootOf = (payload?: Record<string, unknown>) => (payload?.ref ? refs.resolve(String(payload.ref)) : null)
  const pageLine = () => {
    const route = currentRoute()
    return `Page: ${JSON.stringify(document.title)} — route ${String(route?.name ?? '?')} (${route?.fullPath ?? window.location.pathname})`
  }

  // ── what the page is made of (#2342) ───────────────────────────────────
  /** A component's source, as short as still clear: `src/…` in the app, or the package it ships in. */
  const sourceOf = (file?: string) => {
    if (!file) return ''
    const inPackage = /(@[\w.-]+\/[\w.-]+|packages\/[\w.-]+)\/(src\/.+)$/.exec(file)
    if (inPackage) return `${inPackage[1]}/${inPackage[2]}`
    const at = file.indexOf('/src/')
    return at >= 0 ? file.slice(at + 1) : file
  }
  const nameOf = (type?: ComponentInstanceLike['type']) => type?.__name || type?.name || null
  /** Layout, page component, entity and what the user may do with it, active stack — lines under `Page:`. */
  const compositionLines = (): string[] => {
    const lines: string[] = []
    let route: NonNullable<QdadmGlobal['router']>['currentRoute']['value'] | undefined
    try {
      route = q().router?.currentRoute?.value
    } catch {
      return lines
    }
    const matched = route?.matched ?? []
    const mounted = (record?: RouteRecordLike) => record?.instances?.default?.$ ?? null
    if (matched.length > 1) {
      // The layout route's component, then the components it renders at its root (MainLayout → AppLayout).
      const chain: string[] = []
      let instance = mounted(matched[0])
      for (let depth = 0; instance && depth < 6; depth++) {
        const name = nameOf(instance.type)
        if (name && !chain.includes(name)) chain.push(name)
        instance = instance.subTree?.component ?? null
      }
      if (chain.length > 0) lines.push(`Layout: ${chain.join(' → ')}`)
    }
    const leaf = matched[matched.length - 1]
    const resolved = leaf?.components?.default
    const page = mounted(leaf)?.type ?? (resolved && typeof resolved === 'object' ? (resolved as ComponentInstanceLike['type']) : undefined)
    const pageName = nameOf(page)
    if (pageName) {
      const file = sourceOf(page?.__file)
      lines.push(`Component: ${pageName}${file ? ` (${file})` : ''}`)
    }
    let levels: Array<{ entity?: string; id?: string | null }> = []
    try {
      levels = (q().activeStack?.getLevels?.() ?? []).filter((level) => level?.entity)
    } catch {
      /* no stack */
    }
    const entity = (route?.meta?.entity as string | undefined) ?? levels[levels.length - 1]?.entity
    if (entity) {
      let line = `Entity: ${entity}`
      try {
        const orch = q().orchestrator
        if (orch?.isRegistered(entity)) {
          const m = orch.get(entity) as Record<string, unknown>
          const can = ['list', 'create', 'update', 'delete'].flatMap((action) => {
            const check = m[`can${action[0].toUpperCase()}${action.slice(1)}`]
            if (typeof check !== 'function') return []
            try {
              return [`${action} ${check.call(m) ? '✓' : '✗'}`]
            } catch {
              return [`${action} ?`]
            }
          })
          if (can.length > 0) line += ` — ${can.join(', ')}`
          const hasChecker = m._hasSecurityChecker as (() => boolean) | undefined
          const keyOf = m._getPermissionString as ((action: string) => string) | undefined
          if (typeof hasChecker === 'function' && hasChecker.call(m) && typeof keyOf === 'function') {
            line += ` (checks ${keyOf.call(m, '<action>')})`
          }
        }
      } catch {
        /* the entity line without its permissions */
      }
      lines.push(line)
    }
    if (levels.some((level) => level.id)) {
      lines.push(`Stack: ${levels.map((level) => (level.id ? `${level.entity} #${level.id}` : level.entity)).join(' › ')}`)
    }
    return lines
  }
  /** What a zone holds, from the zone registry: its blocks in render order, or its default. */
  const zoneBlocks = (zone: string): string | null => {
    try {
      const info = q().zones?.inspect?.(zone)
      if (!info) return null
      if (info.blocks.length > 0) {
        return `blocks: ${info.blocks.map((block) => [block.id, block.component].filter(Boolean).join(' ')).join(', ')}`
      }
      return info.default ? `default: ${info.default}` : null
    } catch {
      return null
    }
  }

  // ── screenshots (#2247) ────────────────────────────────────────────────
  // snapdom loads on the first screenshot. A real capture is a stream the user
  // shared from the MCP tab; it runs until they stop it, or the browser does.
  const shots = (): Promise<typeof import('./page/screenshot.ts')> => import('./page/screenshot.ts')
  let capture: MediaStream | null = null
  const captureListeners = new Set<(active: boolean) => void>()
  const captureLive = () => capture?.getVideoTracks()[0]?.readyState === 'live'
  const captureSupported = () =>
    typeof (navigator.mediaDevices as { getDisplayMedia?: unknown } | undefined)?.getDisplayMedia === 'function'
  const suggestListeners = new Set<() => void>()
  /** An agent picture came out rendered from the page (#2318): the debug bar offers the real pixels. */
  const suggestCapture = () => {
    if (!captureSupported()) return
    for (const listener of suggestListeners) {
      try {
        listener()
      } catch {
        /* a broken listener must not break the screenshot */
      }
    }
  }
  const notifyCapture = () => {
    const active = captureLive()
    for (const listener of captureListeners) {
      try {
        listener(active)
      } catch {
        /* a broken listener must not break the capture */
      }
    }
  }
  const stopCapture = () => {
    const stream = capture
    capture = null
    if (!stream) return
    for (const track of stream.getTracks()) track.stop()
    notifyCapture()
  }
  const startCapture = async () => {
    const devices = navigator.mediaDevices as (MediaDevices & { getDisplayMedia?: (options: object) => Promise<MediaStream> }) | undefined
    if (!devices?.getDisplayMedia) throw new Error('This browser cannot capture a tab.')
    // Asked before anything is awaited: the browser only asks within the user's click.
    const stream = await devices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
    })
    stopCapture()
    capture = stream
    stream.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (capture === stream) capture = null
      notifyCapture()
    })
    notifyCapture()
  }

  // ── acting in the page (#2247) ─────────────────────────────────────────
  type PageActions = typeof import('./page/actions.ts')
  const actions = (): Promise<PageActions> => import('./page/actions.ts')
  /** After typing, lists debounce their search: wait that out before telling what the page shows. */
  const TYPING_QUIET_MS = 450
  const refOf = (payload?: Record<string, unknown>) => {
    if (!payload?.ref) throw new Error('this action needs a ref: take a page_snapshot (or find) and pass the ref of the element')
    return refs.resolve(String(payload.ref))
  }
  /**
   * Run an action, let the app react — render, route, requests — then say where things stand: what it did,
   * a dialog it opened or closed, what has focus, the route.
   */
  const perform = async (run: (page: PageActions, forced: string[]) => Promise<string> | string, quietMs = 150) => {
    const page = await actions()
    page.useRefs((element) => refs.refOf(element))
    armSignals()
    // Named now: a dialog that closes is usually removed, and a detached one loses its title.
    const before = new Map(page.visibleDialogs().map((d) => [d, page.briefOf(d)]))
    // What `force` overruled (#2274), for the answer to say.
    const forced: string[] = []
    const done = await run(page, forced)
    await settle(quietMs, 2500)
    const after = page.visibleDialogs()
    const opened = after.filter((d) => !before.has(d)).map((d) => `${page.briefOf(d)} [ref=${refs.refOf(d)}]`)
    const closed = [...before].filter(([d]) => !after.includes(d)).map(([, name]) => name)
    const active = document.activeElement
    return {
      done,
      ...(forced.length > 0 ? { forced } : {}),
      ...(opened.length > 0 ? { dialogOpened: opened } : {}),
      ...(closed.length > 0 ? { dialogClosed: closed } : {}),
      focused: active && active !== document.body ? `${page.briefOf(active)} [ref=${refs.refOf(active)}]` : null,
      route: currentRoute()?.fullPath ?? window.location.pathname,
      ...(document.hidden ? { tabHidden: 'The tab is in the background: the browser runs no animation and slows its timers.' } : {}),
    }
  }
  const moveInHistory = async (move: string) => {
    if (move === 'reload') {
      setTimeout(() => window.location.reload(), 150)
      return {
        reloading: true,
        next: 'The tab reloads and comes back as the same instance within seconds: call session_info (or wait_for a route) before acting on it.',
      }
    }
    if (move !== 'back' && move !== 'forward') throw new Error('history is "back", "forward" or "reload"')
    const go = () => (move === 'back' ? window.history.back() : window.history.forward())
    // An entry of another document means a page load, which would take this answer down with it:
    // answer first, then go — where the Navigation API can tell.
    const navigation = (window as unknown as { navigation?: NavigationLike }).navigation
    if (navigation?.currentEntry) {
      const index = navigation.currentEntry.index + (move === 'back' ? -1 : 1)
      const entry = navigation.entries().find((e) => e.index === index)
      if (!entry) return { route: currentRoute(), title: document.title, note: `nothing to go ${move} to` }
      if (!entry.sameDocument) {
        setTimeout(go, 150)
        return {
          loadingPage: entry.url,
          next: 'That entry is another page load: the tab comes back as the same instance within seconds — call session_info (or wait_for a route) before acting on it.',
        }
      }
    }
    const before = window.location.href
    go()
    const started = Date.now()
    while (window.location.href === before && Date.now() - started < 1500) await pause(50)
    await settle()
    return { route: currentRoute(), title: document.title, ...(window.location.href === before ? { note: `nothing to go ${move} to` } : {}) }
  }

  const handlers: Record<string, (payload?: Record<string, unknown>) => unknown | Promise<unknown>> = {
    click: (payload) =>
      perform((page, forced) =>
        page.click(refOf(payload), {
          button: payload?.button as string,
          clickCount: payload?.clickCount as number,
          modifiers: payload?.modifiers as string[],
          force: payload?.force === true,
          forced,
        })
      ),
    typeText: (payload) =>
      perform(
        (page, forced) =>
          page.typeText(rootOf(payload), String(payload?.text ?? ''), {
            clear: payload?.clear === true,
            submit: payload?.submit === true,
            force: payload?.force === true,
            forced,
          }),
        TYPING_QUIET_MS
      ),
    fill: (payload) => {
      if (payload?.value === undefined) throw new Error('fill needs a value')
      return perform((page, forced) => page.fill(refOf(payload), payload.value, { force: payload?.force === true, forced }), TYPING_QUIET_MS)
    },
    pressKey: (payload) => perform((page) => page.pressKeys(rootOf(payload), String(payload?.keys ?? '')), TYPING_QUIET_MS),
    hover: (payload) => perform((page, forced) => page.hover(refOf(payload), { force: payload?.force === true, forced })),
    scroll: (payload) =>
      perform((page) => page.scroll(rootOf(payload), payload?.direction as string | undefined, payload?.amount as number | undefined)),
    drag: (payload) => {
      if (!payload?.to) throw new Error('drag needs to: the ref of the element to drop onto')
      return perform((page, forced) => page.drag(refOf(payload), refs.resolve(String(payload.to)), { force: payload?.force === true, forced }))
    },
    uploadFile: (payload) => perform((page) => page.upload(refOf(payload), payload?.files as UploadFile[])),
    screenshot: async (payload) => {
      const source = String(payload?.source ?? 'auto')
      if (!['auto', 'dom', 'tab'].includes(source)) throw new Error('source is "auto", "dom" or "tab"')
      if (source === 'tab' && !captureLive()) {
        throw new Error(
          'No real capture runs: ask the user to click "Allow real screenshots" in the MCP tab of the debug bar — the browser then asks them to share this tab.'
        )
      }
      const { domShot, tabShot } = await shots()
      const options = {
        element: rootOf(payload),
        fullPage: payload?.fullPage === true,
        format: payload?.format as string | undefined,
        quality: payload?.quality as number | undefined,
        withDebugBar: payload?.withDebugBar === true,
      }
      if (source !== 'dom' && capture && captureLive()) return tabShot(capture, options)
      const shot = await domShot(options)
      // Asked for the rendering on purpose: nothing to offer.
      if (source === 'auto') suggestCapture()
      return shot
    },
    pageEval: async (payload) => {
      const code = String(payload?.code ?? '').trim()
      if (!code) throw new Error('page_eval needs code')
      type Run = (ref: (r: string) => Element) => Promise<unknown>
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (...args: string[]) => Run
      let run: Run
      try {
        // An expression first ("document.title"), statements with a return otherwise.
        run = new AsyncFunction('$ref', `return (${code}\n)`)
      } catch {
        run = new AsyncFunction('$ref', code)
      }
      const value = await run((ref: string) => refs.resolve(ref))
      const { briefOf } = await actions()
      const result = forAgent(value, (element) => `${briefOf(element)} [ref=${refs.refOf(element)}]`)
      const text = JSON.stringify(result) ?? 'null'
      return text.length <= 50_000 ? { value: result } : { value: `${text.slice(0, 50_000)}…`, cut: `${text.length} characters, cut at 50000` }
    },
    consoleMessages: (payload) => {
      const startedNow = !consoleArmed
      armConsole()
      const level = payload?.level ? String(payload.level).toLowerCase() : 'all'
      const pattern = payload?.pattern ? new RegExp(String(payload.pattern), 'i') : null
      const limit = Math.min(Math.max(Number(payload?.limit) || 50, 1), 500)
      const entries: LogEntry[] = [
        ...bootlog.errors.map((e) => ({ ...e, level: 'error' })),
        ...bootlog.warns.map((e) => ({ ...e, level: 'warn' })),
        ...bootlog.pageErrors.map((e) => ({ ...e, level: 'pageerror' })),
        ...bootlog.rejections.map((e) => ({ ...e, level: 'rejection' })),
        ...logs,
      ]
        .filter((e) => (e.seq ?? 0) > consoleClearedAt)
        .filter((e) => level === 'all' || e.level === level || (level === 'errors' && ['error', 'pageerror', 'rejection'].includes(e.level)))
        .filter((e) => !pattern || pattern.test(e.msg))
        .sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
      const shown = entries.slice(-limit)
      if (payload?.clear) consoleClearedAt = logSeq
      return {
        messages: shown.map((e) => ({ at: clockOf(e.at), level: e.level, text: e.msg, ...(e.source ? { source: e.source } : {}) })),
        ...(entries.length > shown.length ? { older: entries.length - shown.length } : {}),
        ...(startedNow ? { note: 'console.log, info and debug are captured from now on; errors and warnings since the tab connected.' } : {}),
      }
    },
    networkRequests: (payload) => {
      const pattern = payload?.urlPattern ? String(payload.urlPattern) : null
      const limit = Math.min(Math.max(Number(payload?.limit) || 50, 1), 300)
      const entries = network
        .filter((e) => e.seq > networkClearedAt)
        .filter((e) => !pattern || e.url.includes(pattern))
        .filter((e) => !payload?.failedOnly || failed(e))
      const shown = entries.slice(-limit)
      if (payload?.clear) networkClearedAt = networkSeq
      return {
        requests: shown.map(({ seq: _seq, at, ...request }) => ({
          at: clockOf(at),
          ...request,
          ...(request.status === undefined && !request.error ? { pending: true } : {}),
        })),
        ...(entries.length > shown.length ? { older: entries.length - shown.length } : {}),
        ...(network.length === 0 ? { note: 'No request yet. fetch and XMLHttpRequest calls are recorded from the moment the tab connected.' } : {}),
      }
    },
    pageSnapshot: async (payload) => {
      const { snapshot } = await aria()
      // meta: false gives the tree alone, as before #2342.
      const meta = payload?.meta !== false
      const text = snapshot(refs, {
        filter: payload?.filter as string,
        root: rootOf(payload),
        maxRows: payload?.maxRows as number,
        maxChars: payload?.maxChars as number,
        zoneBlocks: meta ? zoneBlocks : null,
      })
      const head = meta ? [pageLine(), ...compositionLines()] : [pageLine()]
      return { text: `${head.join('\n')}\n\n${text}` }
    },
    find: async (payload) => {
      const { find } = await aria()
      return {
        text: find(refs, { text: payload?.text as string, role: payload?.role as string, root: rootOf(payload), limit: payload?.limit as number, zoneBlocks }),
      }
    },
    pageText: async (payload) => {
      const { pageText } = await aria()
      return { text: `${pageLine()}\n\n${pageText(rootOf(payload), payload?.maxChars as number)}` }
    },
    feedbackMark: (): FeedbackMark => {
      armSignals()
      return { log: logSeq, signal: signalSeq, network: networkSeq, route: currentRoute()?.fullPath ?? null, at: Date.now() }
    },
    feedbackSince: (payload) => {
      const mark = payload?.mark as FeedbackMark | undefined
      if (!mark || typeof mark.log !== 'number') throw new Error('feedbackSince requires { mark }')
      return feedbackSince(mark)
    },
    navigate: async (payload) => {
      if (payload?.history) return moveInHistory(String(payload.history))
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
        await pause(50)
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
    /** The user's own screenshot, from the MCP tab (#2309): the viewport, taken like the agent's screenshot tool. */
    shoot: async () => {
      const { domShot, tabShot } = await shots()
      const options = { format: 'jpeg', quality: 0.85 }
      return capture && captureLive() ? tabShot(capture, options) : domShot(options)
    },
    capture: {
      active: captureLive,
      supported: captureSupported,
      start: startCapture,
      stop: stopCapture,
      subscribe: (listener: (active: boolean) => void) => {
        captureListeners.add(listener)
        listener(captureLive())
        return () => {
          captureListeners.delete(listener)
        }
      },
      onSuggest: (listener: () => void) => {
        suggestListeners.add(listener)
        return () => {
          suggestListeners.delete(listener)
        }
      },
    },
    handle: async (type: string, payload?: Record<string, unknown>) => {
      const handler = handlers[type]
      if (!handler) throw new Error(`unknown request type "${type}"`)
      return await handler(payload)
    },
  }
}

export default installQdadmRelayConnector
