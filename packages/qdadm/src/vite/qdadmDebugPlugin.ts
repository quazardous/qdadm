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

interface DebugRequest {
  id: string
  type: 'describe' | 'dump' | 'call'
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

  return {
    name: 'qdadm-debug',
    apply: 'serve',

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
          return sendJson(res, 404, { error: `unknown ${req.method} ${path}` })
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
const hot = import.meta.hot
if (!hot) {
  console.warn('[qdadm-debug] import.meta.hot unavailable in injected script')
} else {
  const sessionId = crypto.randomUUID()
  const meta = { userAgent: navigator.userAgent, location: location.pathname }
  let bridge = null
  let lastTick = -1

  const w = /** @type {any} */ (window)

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
