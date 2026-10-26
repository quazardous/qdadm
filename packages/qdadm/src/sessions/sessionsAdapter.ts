/**
 * How the sessions module (#4336) reaches the server. `restSessionsAdapter`
 * speaks this contract; any other transport implements SessionsAdapter.
 *
 *   POST   <base>/heartbeat { tab }            → { others: [{ id, login, via, since, seen, tabs }] }
 *   GET    <base>                              → { sessions: [... (+ ip, agent for an admin)], mine }
 *   GET    <base>/history?limit=&offset=       → { history: [{ at, event, login, via, by, reason, source, ip?, agent? }], notice? }
 *   DELETE <base>/<id>?reason=                 (an admin closes a session)
 *
 * Nothing here belongs to one app: a server that reports a degraded history
 * in its own field maps it with `historyNotice`.
 */

export interface SessionPresence {
  id: string | number
  login: string
  /** How they signed in: a provider name, "local"… */
  via?: string
  /** ISO dates */
  since?: string
  seen?: string
  tabs?: number
}

export interface SessionInfo extends SessionPresence {
  ip?: string
  agent?: string
}

export interface SessionHistoryEntry {
  at: string
  /** login, logout, refused, closed… */
  event: string
  login?: string
  via?: string
  /** Who closed it */
  by?: string
  reason?: string
  source?: string
  ip?: string
  agent?: string
}

export interface SessionsAdapter {
  heartbeat(tab: string): Promise<{ others: SessionPresence[] }>
  list(): Promise<{ sessions: SessionInfo[]; mine?: string | number | null }>
  history(page: { limit: number; offset: number }): Promise<{ history: SessionHistoryEntry[]; notice?: string | null }>
  /** Without it, no Close button */
  close?(id: string | number, reason: string): Promise<unknown>
}

export interface RestSessionsAdapterOptions {
  /** The app's fetch (auth headers, base URL…). Default: window.fetch. */
  fetch?: typeof fetch
  headers?: Record<string, string>
  /** Read a notice about the history from the response; default: its `notice` field */
  historyNotice?: (body: Record<string, unknown>) => string | null | undefined
  /** No DELETE on this server: no Close button */
  canClose?: boolean
}

export function restSessionsAdapter(base: string, options: RestSessionsAdapterOptions = {}): SessionsAdapter {
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  const root = base.replace(/\/$/, '')
  const headers = { Accept: 'application/json', ...options.headers }

  async function call(url: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    const res = await doFetch(url, {
      ...init,
      headers: { ...headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...(init.headers as Record<string, string>) },
    })
    const text = await res.text()
    let body: unknown = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = { message: text }
    }
    if (!res.ok) {
      const b = (body ?? {}) as { message?: string; detail?: string }
      throw new Error(String(b.message ?? b.detail ?? `${res.status} ${res.statusText}`))
    }
    return (body ?? {}) as Record<string, unknown>
  }

  const adapter: SessionsAdapter = {
    async heartbeat(tab) {
      const body = await call(`${root}/heartbeat`, { method: 'POST', body: JSON.stringify({ tab }) })
      return { others: Array.isArray(body.others) ? (body.others as SessionPresence[]) : [] }
    },
    async list() {
      const body = await call(root)
      return { sessions: Array.isArray(body.sessions) ? (body.sessions as SessionInfo[]) : [], mine: (body.mine as string | number | null) ?? null }
    },
    async history({ limit, offset }) {
      const body = await call(`${root}/history?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`)
      const notice = options.historyNotice ? options.historyNotice(body) : typeof body.notice === 'string' ? body.notice : null
      return { history: Array.isArray(body.history) ? (body.history as SessionHistoryEntry[]) : [], notice: notice ?? null }
    },
  }
  if (options.canClose !== false) {
    adapter.close = async (id, reason) => call(`${root}/${encodeURIComponent(String(id))}?reason=${encodeURIComponent(reason)}`, { method: 'DELETE' })
  }
  return adapter
}
