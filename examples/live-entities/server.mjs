/**
 * Reference backend for the live-entities example (qdadm #1888).
 *
 * This is the OTHER SIDE of the contract — read it before writing your own.
 * Node's stdlib only, no dependencies: the contract is HTTP and SSE, not a
 * library, and nothing here is qdadm-specific. A Python or Go backend
 * implementing the same three endpoints works identically.
 *
 * What it serves:
 *
 *   GET  /api/runs        the entity data, `{ items, total }`
 *   GET  /ticket          a short-lived, single-use SSE ticket (see below)
 *   GET  /events?token=…  the SSE stream
 *
 * And, every few seconds, it mutates a run ON ITS OWN — no click, no request
 * from the browser. That is the entire point: an out-of-band writer. Without
 * one there is nothing to demonstrate, because a mutation made by the UI is
 * already handled by the UI.
 *
 * ── The frame contract ────────────────────────────────────────────────────
 *
 *   event: entity:updated                       (or entity:created / :deleted)
 *   data: {"entity": "runs", "id": 3}           id optional
 *
 * The frame carries a FACT — "this changed" — and never an instruction. There
 * is deliberately no `refresh: true`, no `strategy`, no priority: the backend
 * does not know what the front is displaying, and must not drive it. The front
 * decides what a change implies. See docs/adr/0009-live-entities.md.
 *
 * ── Why a ticket instead of the session token ─────────────────────────────
 *
 * `EventSource` cannot send headers, so the SSE credential travels in the
 * query string — and query strings land in access logs, browser history and
 * `Referer` headers, all of which outlive the session by months. Sending the
 * durable API token there would be a real leak.
 *
 * So /ticket issues a credential that is worthless once used: valid 30s, one
 * connection, tied to nothing else. Compromising it buys an attacker one
 * already-expired stream. The front fetches one before each connect, which is
 * why `sse.getToken` accepts a promise.
 *
 * Run: node server.mjs   (or `npm run live` from the repo root)
 */
import http from 'node:http'
import crypto from 'node:crypto'

const PORT = Number(process.env.PORT ?? 5178)
const TICKET_TTL_MS = 30_000
const MUTATION_INTERVAL_MS = 3_000

// ── State ────────────────────────────────────────────────────────────────────
// A real backend has a database here. The shape is what matters: `runs` is
// written by something the browser never talks to — a worker, a cron, a peer.

const STATUSES = ['queued', 'running', 'succeeded', 'failed']

const runs = Array.from({ length: 6 }, (_, i) => ({
  id: i + 1,
  name: `nightly-build-${String(i + 1).padStart(3, '0')}`,
  status: 'queued',
  progress: 0,
  updated_at: new Date().toISOString(),
}))

/** Single-use tickets: value → expiry. */
const tickets = new Map()

/** Open SSE responses, so a mutation can be pushed to every listener. */
const clients = new Set()

// ── The out-of-band writer ───────────────────────────────────────────────────
// Stands in for whatever really mutates your data behind the UI's back.

setInterval(() => {
  const run = runs[Math.floor(Math.random() * runs.length)]

  if (run.status === 'succeeded' || run.status === 'failed') {
    run.status = 'queued'
    run.progress = 0
  } else if (run.status === 'queued') {
    run.status = 'running'
    run.progress = 10
  } else {
    run.progress = Math.min(100, run.progress + 30)
    if (run.progress >= 100) {
      run.status = Math.random() > 0.25 ? 'succeeded' : 'failed'
    }
  }

  run.updated_at = new Date().toISOString()

  // Announce the fact. Note what is NOT sent: no row payload, no instruction.
  // Sending the new row would look helpful and would be a mistake — the front
  // would then trust data that bypassed its own permission filters. It asks
  // again instead, through the same path as any other read.
  broadcast('entity:updated', { entity: 'runs', id: run.id })
}, MUTATION_INTERVAL_MS)

function broadcast(event, data) {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of clients) res.write(frame)
}

// ── HTTP ─────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // The Vite dev server proxies to us, so these are same-origin in the
  // browser. CORS is here only so you can curl the endpoints directly.
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (url.pathname === '/api/runs' && req.method === 'GET') {
    return json(res, 200, { items: runs, total: runs.length })
  }

  if (url.pathname === '/ticket' && req.method === 'GET') {
    // A real backend authenticates the CALLER here — session cookie or
    // Authorization header — and refuses to issue a ticket otherwise. The
    // ticket must never be easier to obtain than the data it guards.
    const value = crypto.randomUUID()
    tickets.set(value, Date.now() + TICKET_TTL_MS)
    return json(res, 200, { ticket: value, expires_in: TICKET_TTL_MS / 1000 })
  }

  if (url.pathname === '/events' && req.method === 'GET') {
    const token = url.searchParams.get('token')
    const expiry = token ? tickets.get(token) : undefined

    // Burn it before checking: a replayed ticket must fail even if it is
    // still within its window.
    if (token) tickets.delete(token)

    if (!expiry || expiry < Date.now()) {
      return json(res, 401, { error: 'missing, expired or already-used ticket' })
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      // Nginx buffers proxied responses by default, which holds frames back
      // until the buffer fills — the stream then looks broken. Disable it.
      'X-Accel-Buffering': 'no',
    })
    res.write('retry: 3000\n\n')

    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }

  json(res, 404, { error: 'not found' })
})

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(body))
}

server.listen(PORT, () => {
  console.log(`[live-entities] backend on http://localhost:${PORT}`)
  console.log(`[live-entities] mutating a run every ${MUTATION_INTERVAL_MS / 1000}s`)
})
