/**
 * qdadm Vite dev plugin — exposes the running app's DebugBridge over HTTP.
 *
 * Endpoints (default prefix `/__qdadm`):
 *   GET  /__qdadm/                    — index of endpoints + cache stats
 *   GET  /__qdadm/sessions            — list of connected client sessions
 *   GET  /__qdadm/describe.json       — bridge.describe() (manifests)
 *   GET  /__qdadm/snapshot.json       — bridge.dump() (live state)
 *   POST /__qdadm/call                — body {collector, action, args?}
 *
 * Session selection: every browser tab that loads the app gets a fresh
 * session id (uuid in the injected client). All endpoints accept a
 * `?session=<id|latest>` query param. Default is `latest` (the most recently
 * active session).
 *
 * Wire-up: the plugin injects a small ESM script via `transformIndexHtml`.
 * That inline script lives in Vite's HMR pipeline (so `import.meta.hot`
 * works), polls for `window.__qdadm.debug.bridge`, then pushes describe +
 * snapshot on every reactive tick. The plugin caches per-session payloads
 * in memory; GETs are served from cache (no round-trip needed).
 *
 * `call` is always request-response — it mutates state in the live page.
 *
 * Cache responses include `X-Qdadm-Stale-Ms`, `X-Qdadm-Source: cache|live`,
 * and `X-Qdadm-Session: <id>` headers.
 */

import type { Plugin, ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface PendingRequest {
  resolve: (data: unknown) => void
  reject: (err: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

/** Typed page-side queries (#1398) — served by the injected client. */
export type DebugQueryType =
  | 'describe'
  | 'dump'
  | 'call'
  | 'sessionInfo'
  | 'routes'
  | 'entityState'
  | 'entityCall'
  | 'storageDump'
  | 'bootlog'
  | 'recentSignals'

interface DebugRequest {
  id: string
  type: DebugQueryType
  payload?: unknown
  /** Target a specific session (server → client). */
  sessionId?: string
}

interface DebugReply {
  id: string
  ok: boolean
  data?: unknown
  error?: string
  sessionId?: string
}

interface DebugPush {
  type: 'describe' | 'snapshot' | 'hello' | 'bye'
  data?: unknown
  sessionId: string
  /** Free-form metadata sent on hello (user agent, route, etc.). */
  meta?: Record<string, unknown>
}

interface SessionState {
  id: string
  firstSeenAt: number
  lastSeenAt: number
  describe: { data: unknown; at: number } | null
  snapshot: { data: unknown; at: number } | null
  meta: Record<string, unknown>
}

/** Broker surface exposed to sibling plugins via `plugin.api` (#1398). */
export interface QdadmDebugPluginApi {
  /** Send a typed query to the page and await its reply. */
  ask: (type: DebugQueryType, payload?: unknown, sessionId?: string) => Promise<unknown>
  /** Resolve a session param ('latest' or id) to a live session, if any. */
  pickSession: (
    sessionParam: string | null
  ) => { id: string; lastSeenAt: number; meta: Record<string, unknown> } | null
  listSessions: () => Array<{
    id: string
    firstSeenAt: number
    lastSeenAt: number
    ageMs: number
    hasDescribe: boolean
    hasSnapshot: boolean
    meta: Record<string, unknown>
  }>
  prefix: string
}

export interface QdadmDebugPluginOptions {
  /** URL prefix (default '/__qdadm') */
  prefix?: string
  /** Request timeout ms for live fallback (default 3000) */
  timeoutMs?: number
  /** Drop sessions inactive for this many ms (default 10 min) */
  sessionTtlMs?: number
}

export function qdadmDebugPlugin(options: QdadmDebugPluginOptions = {}): Plugin {
  const prefix = options.prefix ?? '/__qdadm'
  const timeoutMs = options.timeoutMs ?? 3000
  const sessionTtlMs = options.sessionTtlMs ?? 10 * 60 * 1000

  const sessions = new Map<string, SessionState>()
  const pending = new Map<string, PendingRequest>()
  let server: ViteDevServer | null = null
  let nextId = 1

  function pruneStaleSessions(): void {
    const cutoff = Date.now() - sessionTtlMs
    for (const [id, s] of sessions) {
      if (s.lastSeenAt < cutoff) sessions.delete(id)
    }
  }

  function pickSession(sessionParam: string | null): SessionState | null {
    pruneStaleSessions()
    if (!sessionParam || sessionParam === 'latest') {
      let best: SessionState | null = null
      for (const s of sessions.values()) {
        if (!best || s.lastSeenAt > best.lastSeenAt) best = s
      }
      return best
    }
    return sessions.get(sessionParam) ?? null
  }

  function ask(
    type: DebugRequest['type'],
    payload?: unknown,
    sessionId?: string
  ): Promise<unknown> {
    if (!server) return Promise.reject(new Error('[qdadm-debug] vite server not ready'))
    const id = String(nextId++)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id)
        reject(
          new Error(
            `[qdadm-debug] timeout waiting for ${type} — open the app in a browser at least once`
          )
        )
      }, timeoutMs)
      pending.set(id, { resolve, reject, timeout })
      server!.ws.send('qdadm:debug:request', { id, type, payload, sessionId } satisfies DebugRequest)
    })
  }

  async function serveCachedOrLive(
    res: ServerResponse,
    sessionParam: string | null,
    field: 'describe' | 'snapshot',
    liveType: 'describe' | 'dump'
  ): Promise<void> {
    const session = pickSession(sessionParam)
    if (session) {
      const cache = session[field]
      if (cache) {
        res.setHeader('x-qdadm-stale-ms', String(Date.now() - cache.at))
        res.setHeader('x-qdadm-source', 'cache')
        res.setHeader('x-qdadm-session', session.id)
        return sendJson(res, 200, cache.data)
      }
    }
    try {
      const data = await ask(liveType, undefined, session?.id)
      res.setHeader('x-qdadm-stale-ms', '0')
      res.setHeader('x-qdadm-source', 'live')
      if (session) res.setHeader('x-qdadm-session', session.id)
      return sendJson(res, 200, data)
    } catch (e) {
      return sendJson(res, 503, {
        error: (e as Error).message,
        sessions: listSessions(),
        hint:
          sessions.size === 0
            ? 'No connected client. Load http://<dev>/ in a browser once.'
            : 'No cached payload yet for the chosen session — try ?session=latest.',
      })
    }
  }

  function listSessions(): Array<{
    id: string
    firstSeenAt: number
    lastSeenAt: number
    ageMs: number
    hasDescribe: boolean
    hasSnapshot: boolean
    meta: Record<string, unknown>
  }> {
    pruneStaleSessions()
    const now = Date.now()
    return Array.from(sessions.values())
      .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
      .map((s) => ({
        id: s.id,
        firstSeenAt: s.firstSeenAt,
        lastSeenAt: s.lastSeenAt,
        ageMs: now - s.lastSeenAt,
        hasDescribe: !!s.describe,
        hasSnapshot: !!s.snapshot,
        meta: s.meta,
      }))
  }

  function ensureSession(id: string, meta?: Record<string, unknown>): SessionState {
    let s = sessions.get(id)
    if (!s) {
      s = {
        id,
        firstSeenAt: Date.now(),
        lastSeenAt: Date.now(),
        describe: null,
        snapshot: null,
        meta: meta ?? {},
      }
      sessions.set(id, s)
    } else {
      s.lastSeenAt = Date.now()
      if (meta) s.meta = { ...s.meta, ...meta }
    }
    return s
  }

  /** Inter-plugin API (#1398) — consumed by @quazardous/qdmcp. */
  const api: QdadmDebugPluginApi = {
    ask,
    pickSession: (sessionParam) => {
      const s = pickSession(sessionParam)
      return s ? { id: s.id, lastSeenAt: s.lastSeenAt, meta: s.meta } : null
    },
    listSessions,
    prefix,
  }

  return {
    name: 'qdadm-debug',
    apply: 'serve',
    api,

    transformIndexHtml: {
      order: 'pre',
      handler() {
        return [
          {
            tag: 'script',
            attrs: { type: 'module' },
            injectTo: 'head' as const,
            children: HMR_CLIENT_SCRIPT,
          },
        ]
      },
    },

    configureServer(s) {
      server = s

      s.ws.on('qdadm:debug:reply', (data: DebugReply) => {
        const p = pending.get(data.id)
        if (!p) return
        clearTimeout(p.timeout)
        pending.delete(data.id)
        if (data.ok) p.resolve(data.data)
        else p.reject(new Error(data.error ?? '[qdadm-debug] unknown error'))
      })

      s.ws.on('qdadm:debug:push', (msg: DebugPush) => {
        if (!msg?.sessionId) return
        const session = ensureSession(msg.sessionId, msg.meta)
        const at = Date.now()
        if (msg.type === 'describe' && msg.data !== undefined) {
          session.describe = { data: msg.data, at }
        } else if (msg.type === 'snapshot' && msg.data !== undefined) {
          session.snapshot = { data: msg.data, at }
        } else if (msg.type === 'bye') {
          sessions.delete(msg.sessionId)
        }
      })

      s.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith(prefix)) return next()
        const url = new URL(req.url, 'http://localhost')
        const path = url.pathname.slice(prefix.length)
        const sessionParam = url.searchParams.get('session')

        try {
          if (req.method === 'GET' && (path === '' || path === '/')) {
            return sendJson(res, 200, {
              version: '1',
              description:
                'qdadm debug bridge — read collector manifests and snapshots, invoke actions.',
              endpoints: {
                'GET /sessions': 'list connected client sessions',
                'GET /describe.json?session=<id|latest>':
                  'manifest for every collector (entry shapes + actions)',
                'GET /snapshot.json?session=<id|latest>':
                  'live JSON snapshot of every collector',
                'POST /call?session=<id|latest>':
                  'invoke an action — body { collector, action, args? }',
              },
              sessions: listSessions(),
              prefix,
            })
          }
          if (req.method === 'GET' && path === '/sessions') {
            return sendJson(res, 200, { sessions: listSessions() })
          }
          if (req.method === 'GET' && path === '/describe.json') {
            return await serveCachedOrLive(res, sessionParam, 'describe', 'describe')
          }
          if (req.method === 'GET' && path === '/snapshot.json') {
            return await serveCachedOrLive(res, sessionParam, 'snapshot', 'dump')
          }
          if (req.method === 'POST' && path === '/call') {
            const body = await readBody(req)
            const parsed = body ? JSON.parse(body) : {}
            const session = pickSession(sessionParam)
            if (!session) {
              return sendJson(res, 503, {
                error: 'no connected session',
                sessions: listSessions(),
              })
            }
            const data = await ask('call', parsed, session.id)
            res.setHeader('x-qdadm-session', session.id)
            return sendJson(res, 200, data)
          }
          // Unknown subpath: fall through — sibling plugins (e.g.
          // @quazardous/qdadm-mcp) mount their own endpoints under the
          // same prefix (#1398).
          return next()
        } catch (e) {
          return sendJson(res, 500, { error: (e as Error).message })
        }
      })
    },
  }
}

export default qdadmDebugPlugin

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(data, null, 2))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = ''
    req.setEncoding('utf-8')
    req.on('data', (chunk: string) => {
      buf += chunk
    })
    req.on('end', () => resolve(buf))
    req.on('error', reject)
  })
}

/**
 * Client-side bridge — injected verbatim into index.html as an ES module.
 * Lives in Vite's HMR pipeline (so `import.meta.hot` works here).
 *
 * Each tab gets its own session id (random uuid). Pushes describe + snapshot
 * on every reactive tick of the bridge so the plugin's per-session cache
 * stays fresh. Listens for ad-hoc requests targeted at this session.
 */
const HMR_CLIENT_SCRIPT = String.raw`
// ── Boot capture (#1398): this head module runs BEFORE the app's entry
// module, so console/window errors from the very first app statement are
// buffered — visible over MCP even when the app dies before the bridge
// exists (the class of failure a bridge-only design can never see).
const __bootAt = Date.now()
const __bootlog = { errors: [], warns: [], pageErrors: [], rejections: [] }
function __cap(arr, entry) { arr.push(entry); if (arr.length > 200) arr.shift() }
function __fmt(args) {
  try {
    return Array.from(args).map((a) => {
      if (a instanceof Error) return a.stack || a.message
      if (typeof a === 'object') { try { return JSON.stringify(a) } catch (e) { return String(a) } }
      return String(a)
    }).join(' ').slice(0, 2000)
  } catch (e) { return '[unformattable]' }
}
const __origError = console.error.bind(console)
const __origWarn = console.warn.bind(console)
console.error = function () { __cap(__bootlog.errors, { at: Date.now(), msg: __fmt(arguments) }); __origError.apply(null, arguments) }
console.warn = function () { __cap(__bootlog.warns, { at: Date.now(), msg: __fmt(arguments) }); __origWarn.apply(null, arguments) }
window.addEventListener('error', (e) => {
  __cap(__bootlog.pageErrors, { at: Date.now(), msg: String(e.message || e), source: e.filename ? e.filename + ':' + e.lineno : undefined })
})
window.addEventListener('unhandledrejection', (e) => {
  let msg; try { msg = e.reason && (e.reason.stack || e.reason.message) || String(e.reason) } catch (err) { msg = '[unreadable reason]' }
  __cap(__bootlog.rejections, { at: Date.now(), msg: String(msg).slice(0, 2000) })
})

const hot = import.meta.hot
if (!hot) {
  console.warn('[qdadm-debug] import.meta.hot unavailable in injected script')
} else {
  const sessionId = crypto.randomUUID()
  const meta = { userAgent: navigator.userAgent, location: location.pathname }
  let bridge = null
  let lastTick = -1

  const w = /** @type {any} */ (window)

  // Signal ring buffer — armed once __qdadm.signals is reachable.
  const __signals = []
  let __signalsArmed = false
  function __armSignals() {
    if (__signalsArmed) return
    const q = w.__qdadm
    if (!q || !q.signals || typeof q.signals.on !== 'function') return
    try {
      q.signals.on('**', (event) => { __cap(__signals, { at: Date.now(), name: event && event.name }) ; if (__signals.length > 100) __signals.shift() })
      __signalsArmed = true
    } catch (e) {}
  }

  function __sessionInfo() {
    const q = w.__qdadm || {}
    let app = {}
    try { app = (q.kernel && q.kernel.options && q.kernel.options.app) || {} } catch (e) {}
    let route = null
    try { const r = q.router && q.router.currentRoute && q.router.currentRoute.value; route = r ? { name: r.name, fullPath: r.fullPath } : null } catch (e) {}
    return {
      sessionId, bootAt: __bootAt, now: Date.now(), url: location.href,
      app: { name: app.name, version: typeof app.version === 'function' ? app.version() : app.version },
      route, bridgeReady: !!bridge, signalsArmed: __signalsArmed,
      bootlogCounts: { errors: __bootlog.errors.length, warns: __bootlog.warns.length, pageErrors: __bootlog.pageErrors.length, rejections: __bootlog.rejections.length },
    }
  }

  function __routes() {
    const q = w.__qdadm
    if (!q || !q.router) throw new Error('router not ready')
    return q.router.getRoutes().map((r) => ({
      name: r.name, path: r.path,
      meta: { entity: r.meta && r.meta.entity, layout: r.meta && r.meta.layout, requiresAuth: r.meta && r.meta.requiresAuth, public: r.meta && r.meta.public },
    }))
  }

  function __manager(entity) {
    const q = w.__qdadm
    if (!q || !q.orchestrator) throw new Error('orchestrator not ready')
    if (!q.orchestrator.isRegistered(entity)) throw new Error('entity not registered: ' + entity + ' (known: ' + q.orchestrator.getRegisteredNames().join(', ') + ')')
    return q.orchestrator.get(entity)
  }

  function __entityState(payload) {
    const q = w.__qdadm
    if (!payload || !payload.entity) {
      return { entities: q && q.orchestrator ? q.orchestrator.getRegisteredNames() : [] }
    }
    const m = __manager(payload.entity)
    const safe = (fn) => { try { return fn() } catch (e) { return '[error: ' + (e && e.message) + ']' } }
    const fields = {}
    try {
      const fs = m.fields || m._fields || {}
      for (const k in fs) fields[k] = { type: fs[k] && fs[k].type, label: fs[k] && fs[k].label, required: !!(fs[k] && fs[k].required) }
    } catch (e) {}
    return {
      entity: payload.entity,
      idField: safe(() => m.idField), labelField: safe(() => m.labelField),
      label: safe(() => m.label), labelPlural: safe(() => m.labelPlural),
      can: { create: safe(() => m.canCreate()), read: safe(() => m.canRead()), update: safe(() => m.canUpdate()), delete: safe(() => m.canDelete()) },
      fields,
      storage: safe(() => { const st = m.storage || m._storage; return st ? { kind: st.constructor && st.constructor.name, storageKey: st._storageKey } : null }),
    }
  }

  async function __entityCall(payload) {
    if (!payload || !payload.entity || !payload.op) throw new Error('entityCall requires { entity, op, ... }')
    const m = __manager(payload.entity)
    const op = payload.op
    if (op === 'list') return await m.list(payload.params || {})
    if (op === 'get') return await m.get(payload.id)
    if (op === 'create') return await m.create(payload.data || {})
    if (op === 'update') return await m.update(payload.id, payload.data || {})
    if (op === 'delete') { await m.delete(payload.id); return { deleted: payload.id } }
    throw new Error('unknown op "' + op + '" (list|get|create|update|delete)')
  }

  function __storageDump(payload) {
    if (!payload || !payload.entity) throw new Error('storageDump requires { entity }')
    const m = __manager(payload.entity)
    const st = m.storage || m._storage
    const key = st && st._storageKey
    if (!key) return { storageKey: null, note: 'storage exposes no localStorage key (' + (st && st.constructor && st.constructor.name) + ')' }
    const raw = localStorage.getItem(key)
    let parsed = null
    try { parsed = raw ? JSON.parse(raw) : null } catch (e) { parsed = '[unparsable]' }
    return { storageKey: key, count: Array.isArray(parsed) ? parsed.length : null, data: parsed }
  }

  function helloIfNeeded() {
    try { hot.send('qdadm:debug:push', { type: 'hello', sessionId, meta }) } catch (e) {}
  }
  function pushDescribe() {
    try { hot.send('qdadm:debug:push', { type: 'describe', sessionId, data: bridge.describe() }) }
    catch (e) { console.warn('[qdadm-debug] describe push failed:', e) }
  }
  function pushSnapshot() {
    try { hot.send('qdadm:debug:push', { type: 'snapshot', sessionId, data: bridge.dump() }) }
    catch (e) { console.warn('[qdadm-debug] snapshot push failed:', e) }
  }
  function bye() {
    try { hot.send('qdadm:debug:push', { type: 'bye', sessionId }) } catch (e) {}
  }
  window.addEventListener('beforeunload', bye)

  hot.on('qdadm:debug:request', async (msg) => {
    // Ignore requests addressed to a different session.
    if (msg && msg.sessionId && msg.sessionId !== sessionId) return
    const id = (msg && msg.id) || ''
    try {
      // Typed queries (#1398): bridge-independent — they must answer even
      // when the app died before the bridge existed.
      if (msg.type === 'bootlog') { hot.send('qdadm:debug:reply', { id, ok: true, data: __bootlog, sessionId }); return }
      if (msg.type === 'sessionInfo') { hot.send('qdadm:debug:reply', { id, ok: true, data: __sessionInfo(), sessionId }); return }
      if (msg.type === 'recentSignals') { __armSignals(); hot.send('qdadm:debug:reply', { id, ok: true, data: { armed: __signalsArmed, events: __signals }, sessionId }); return }
      if (msg.type === 'routes') { hot.send('qdadm:debug:reply', { id, ok: true, data: __routes(), sessionId }); return }
      if (msg.type === 'entityState') { hot.send('qdadm:debug:reply', { id, ok: true, data: __entityState(msg.payload), sessionId }); return }
      if (msg.type === 'entityCall') { const data = await __entityCall(msg.payload); hot.send('qdadm:debug:reply', { id, ok: true, data, sessionId }); return }
      if (msg.type === 'storageDump') { hot.send('qdadm:debug:reply', { id, ok: true, data: __storageDump(msg.payload), sessionId }); return }

      const b = w.__qdadm && w.__qdadm.debug && w.__qdadm.debug.bridge
      if (!b) throw new Error('debug bridge not ready')
      let data
      if (msg.type === 'describe') data = b.describe()
      else if (msg.type === 'dump') data = b.dump()
      else if (msg.type === 'call') {
        const p = msg.payload || {}
        if (!p.collector || !p.action) throw new Error('call payload requires { collector, action, args? }')
        data = await b.call(p.collector, p.action, p.args || {})
      } else throw new Error('unknown request type "' + msg.type + '"')
      hot.send('qdadm:debug:reply', { id, ok: true, data, sessionId })
    } catch (e) {
      hot.send('qdadm:debug:reply', { id, ok: false, error: e && e.message ? e.message : String(e), sessionId })
    }
  })

  let attachTimer = setInterval(() => {
    bridge = w.__qdadm && w.__qdadm.debug && w.__qdadm.debug.bridge
    if (!bridge) return
    clearInterval(attachTimer)
    __armSignals()
    helloIfNeeded()
    pushDescribe()
    pushSnapshot()
    lastTick = bridge.tick && bridge.tick.value
    console.log('[qdadm-debug] HTTP bridge wired — session', sessionId.slice(0, 8))
    setInterval(() => {
      if (!bridge || !bridge.tick) return
      if (bridge.tick.value === lastTick) return
      lastTick = bridge.tick.value
      pushSnapshot()
    }, 250)
  }, 100)
}
`
