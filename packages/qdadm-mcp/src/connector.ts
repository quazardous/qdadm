/**
 * Browser connector for qdadm-mcp-relay (#1400) — static/no-API sites.
 *
 * OPT-IN and never ambient: import it first in your entry (for boot
 * capture), it stays inert unless the page URL carries the pairing
 * fragment printed by the relay:
 *
 *   https://your-site/#qdadm-relay=ws://localhost:7777/<token>
 *
 * ```ts
 * // main.ts — FIRST import for full boot-error capture
 * import { installQdadmRelayConnector } from '@quazardous/qdadm-mcp/connector'
 * installQdadmRelayConnector()
 * ```
 *
 * When active, the page dials out to the relay and answers the same typed
 * queries as the dev-mode injected client (sessionInfo, routes,
 * entityState, entityCall, storageDump, bootlog, recentSignals, plus the
 * bridge triple describe/dump/call) — the relay's MCP front then serves
 * the standard 13-tool arsenal. The MCP acts within THIS browser session:
 * manager permissions apply.
 */

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

export interface QdadmRelayConnectorOptions {
  /** Explicit relay ws url (overrides the URL fragment). */
  url?: string
  /** Explicit pairing token (overrides the URL fragment). */
  token?: string
  /** Reconnect attempts before giving up (default 20). */
  maxRetries?: number
}

const FRAGMENT_RE = /#qdadm-relay=(wss?:\/\/[^/]+)\/([\w-]+)/

export function installQdadmRelayConnector(options: QdadmRelayConnectorOptions = {}): void {
  if (typeof window === 'undefined') return
  let url = options.url ?? null
  let token = options.token ?? null
  if (!url || !token) {
    const m = window.location.hash.match(FRAGMENT_RE)
    if (!m) return // no opt-in signal → fully inert
    url = url ?? m[1]
    token = token ?? m[2]
  }

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

  const sessionId = crypto.randomUUID()
  const q = (): QdadmGlobal => (window as unknown as { __qdadm?: QdadmGlobal }).__qdadm ?? {}

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

  const maxRetries = options.maxRetries ?? 20
  let retries = 0

  const connect = () => {
    const ws = new WebSocket(url!)
    ws.onopen = () => {
      retries = 0
      ws.send(
        JSON.stringify({
          kind: 'hello',
          token,
          sessionId,
          meta: { userAgent: navigator.userAgent, location: window.location.pathname, transport: 'relay' },
        })
      )
      armSignals()
      console.log(`[qdadm-relay] connected — session ${sessionId.slice(0, 8)}`)
    }
    ws.onmessage = async (event) => {
      let msg: { kind?: string; id?: string; type?: string; payload?: Record<string, unknown> }
      try {
        msg = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (msg.kind !== 'request' || !msg.type) return
      try {
        const handler = handlers[msg.type]
        if (!handler) throw new Error(`unknown request type "${msg.type}"`)
        const data = await handler(msg.payload)
        ws.send(JSON.stringify({ kind: 'reply', id: msg.id, ok: true, data }))
      } catch (e) {
        ws.send(JSON.stringify({ kind: 'reply', id: msg.id, ok: false, error: (e as Error).message }))
      }
    }
    ws.onclose = () => {
      if (retries++ < maxRetries) setTimeout(connect, Math.min(1000 * retries, 5000))
    }
  }
  connect()

  window.addEventListener('beforeunload', () => {
    /* socket close is enough — the relay drops the session on 'close' */
  })
}

export default installQdadmRelayConnector
