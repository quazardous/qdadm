/**
 * qdadm-mcp-relay (#1400, #2231) — the machine's relay between app tabs and agents.
 *
 * ONE relay serves every app and tab of the user. It listens on the first
 * free port of 47761–47765 — or on `QDADM_RELAY_PORT` when that is set — and
 * carries, on that single port:
 *   - app tabs, over WebSocket;
 *   - `GET /identity` — who answers here;
 *   - `POST /mcp` — the agents' MCP endpoint, refused to any web page.
 * It writes `~/.qdadm_relay.run` (pid, port, page token) so the vite plugin
 * and the stdio front find it, and holds a lock so it stays the only one.
 *
 * You rarely start it yourself:
 *   - `npm run dev` does, through qdadmMcpPlugin, and dev tabs connect to it;
 *   - the agent's MCP client does, running `npx qdadm-mcp-relay --stdio`.
 *
 *   npx qdadm-mcp-relay [--stdio] [--read-only] [--origin <origin>]...
 *                       [--port <p>] [--bind <host>] [--token <fixed>]
 *                       [--background]
 *   npx qdadm-mcp-relay --call <tool> ['<json args>']
 *
 * `--call` makes one tool call on the machine relay, prints the answer and
 * exits (#2263): 0 done, 1 the tool answered with an error, 2 a wrong command.
 *
 * `--port` runs a private relay on that port — no run file, no lock. To move
 * the SHARED relay instead, set `QDADM_RELAY_PORT`.
 *
 * `--bind` (or `QDADM_RELAY_HOST`) is the interface it listens on, `127.0.0.1`
 * by default. A relay inside a container needs `0.0.0.0`: a loopback socket
 * refuses what Docker forwards to it, so a published port is unusable
 * otherwise. Then the page token and `--origin` are what limit who gets in.
 * `--background` (how the plugin and the front spawn it) exits after 30
 * minutes with no connected tab and no MCP call.
 */
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename } from 'node:path'
import { WebSocketServer } from 'ws'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createQdadmMcpServer } from '../server.ts'
import { RELAY_PROTOCOL, type RelayIdentity } from '../protocol.ts'
import { RelayBroker } from './broker.ts'
import {
  AllPortsBusyError,
  isLoopbackHost,
  listenOnFirstFreePort,
  openHttpServer,
  relayBindHost,
  relayPorts,
} from './ports.ts'
import {
  acquireRelayLock,
  findRunningRelay,
  releaseRelayLock,
  removeRunFile,
  runFilePath,
  writeRunFile,
} from './runfile.ts'
import { runStdioFront } from './front.ts'
import { runChatHookCli } from './chatHook.ts'
import { runCall } from './call.ts'

interface CliOptions {
  /** One explicit port — a private relay. Null: the shared relay, on QDADM_RELAY_PORT or RELAY_PORTS. */
  port: number | null
  stdio: boolean
  /** `--chat-hook <event>`: act as an agent hook for the MCP tab's chat (#2252), then exit. */
  chatHook: string | null
  /** `--call <tool> [json]`: one tool call on the machine relay, printed, then exit (#2263). */
  call: { tool: string; args?: string } | null
  background: boolean
  /** The interface to listen on. `127.0.0.1` unless asked otherwise. */
  bind: string
  token: string
  readOnly: boolean
  /** `--no-save-screenshots`: the stdio front keeps no picture in the project (#2284). */
  saveScreenshots: boolean
  origins: string[]
  idleMs: number
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    port: null,
    stdio: false,
    chatHook: null,
    call: null,
    background: false,
    bind: relayBindHost(),
    token: randomUUID(),
    readOnly: false,
    saveScreenshots: true,
    origins: [],
    idleMs: 30 * 60 * 1000,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--port') opts.port = Number(argv[++i])
    else if (a === '--stdio') opts.stdio = true
    else if (a === '--chat-hook') opts.chatHook = String(argv[++i] ?? '')
    else if (a === '--call') {
      const tool = String(argv[++i] ?? '')
      const next = argv[i + 1]
      opts.call = { tool, args: next !== undefined && !next.startsWith('--') ? argv[++i] : undefined }
    }
    else if (a === '--bind') opts.bind = String(argv[++i] ?? '')
    else if (a === '--background') opts.background = true
    else if (a === '--token') opts.token = String(argv[++i])
    else if (a === '--read-only') opts.readOnly = true
    else if (a === '--no-save-screenshots') opts.saveScreenshots = false
    else if (a === '--origin') opts.origins.push(String(argv[++i]))
    else if (a === '--mcp-port') {
      i++
      console.error('[qdadm-mcp-relay] --mcp-port is gone: the MCP endpoint is /mcp on the relay port itself.')
    }
  }
  return opts
}

const sendJson = (res: ServerResponse, status: number, data: unknown) => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.end(JSON.stringify(data, null, 2))
}

/** A small JSON request body, or null: a hook's request is a few bytes. */
function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (chunk) => {
      raw += chunk
      if (raw.length > 10_000) req.destroy()
    })
    req.on('end', () => {
      try {
        const value = JSON.parse(raw || 'null')
        resolve(value && typeof value === 'object' ? value : null)
      } catch {
        resolve(null)
      }
    })
    req.on('error', () => resolve(null))
  })
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv)
  if (opts.chatHook !== null) return runChatHookCli(opts.chatHook)
  if (opts.call) {
    process.exitCode = await runCall(opts.call.tool, opts.call.args, { readOnly: opts.readOnly, saveScreenshots: opts.saveScreenshots })
    return
  }
  if (opts.stdio) return runStdioFront({ readOnly: opts.readOnly, saveScreenshots: opts.saveScreenshots })

  const log = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)} [qdadm-mcp-relay] ${m}`)
  const shared = opts.port === null

  let ports: readonly number[]
  let runFile: string
  try {
    ports = opts.port ? [opts.port] : relayPorts()
    runFile = runFilePath()
  } catch (e) {
    log((e as Error).message)
    process.exitCode = 2
    return
  }

  if (shared) {
    const running = await findRunningRelay(runFile)
    if (running) {
      log(`already running — pid ${running.pid}, ws://localhost:${running.port} (${runFile})`)
      // It was started before QDADM_RELAY_PORT said otherwise: saying so beats looking ignored.
      if (!ports.includes(running.port)) {
        log(`QDADM_RELAY_PORT asks for ${ports.join(', ')} — stop that relay (kill ${running.pid}) to move it there.`)
      }
      return
    }
    if (!acquireRelayLock(runFile)) {
      log('another relay is starting — leaving it to that one')
      return
    }
  }

  const broker = new RelayBroker({
    token: opts.token,
    allowedOrigins: opts.origins.length > 0 ? opts.origins : undefined,
    onSession: (event, id, detail) => log(`instance ${event}: ${id.slice(0, 8)}${detail ? ` (${detail})` : ''}`),
  })
  let identity: RelayIdentity | null = null
  let lastMcpCall = Date.now()

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (req.method === 'GET' && url.pathname === '/identity') return sendJson(res, 200, identity)
    if (url.pathname === '/mcp') {
      // A browser attaches an Origin header to every cross-origin request: no
      // web page may drive the MCP, which acts inside logged-in sessions.
      if (req.headers.origin) {
        return sendJson(res, 403, { error: 'the relay MCP endpoint does not answer web pages' })
      }
      lastMcpCall = Date.now()
      try {
        const server = createQdadmMcpServer(broker, { readOnly: opts.readOnly, name: 'qdadm-relay' })
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
        res.on('close', () => {
          void transport.close()
          void server.close()
        })
        await server.connect(transport)
        await transport.handleRequest(req, res)
      } catch (e) {
        if (!res.headersSent) {
          sendJson(res, 500, { jsonrpc: '2.0', error: { code: -32603, message: (e as Error).message }, id: null })
        }
      }
      return
    }
    if (url.pathname === '/chat/pending') {
      // What users typed in the MCP tab, for agent hooks (#2252): refused to web pages, like /mcp.
      if (req.headers.origin) return sendJson(res, 403, { error: 'the relay chat endpoint does not answer web pages' })
      if (req.method !== 'POST') return sendJson(res, 405, { error: 'POST /chat/pending with { "mark": true | false }' })
      const body = await readJsonBody(req)
      return sendJson(res, 200, { instances: await broker.chatPending(body?.mark === true) })
    }
    sendJson(res, 404, { error: 'GET /identity · POST /mcp · POST /chat/pending · WebSocket for app tabs' })
  }

  let listening: { port: number; value: Awaited<ReturnType<typeof openHttpServer>>; busy: number[] }
  try {
    listening = await listenOnFirstFreePort(ports, (p) =>
      openHttpServer(p, (req, res) => void handle(req, res), opts.bind)
    )
  } catch (e) {
    if (shared) releaseRelayLock(runFile)
    if (!(e instanceof AllPortsBusyError)) throw e
    log(
      opts.port
        ? `port ${opts.port} is already in use. Pick another with --port.`
        : ports.length === 1
          ? `port ${ports[0]} is already in use (QDADM_RELAY_PORT). Free it, or set QDADM_RELAY_PORT to a free port.`
          : `every relay port is in use (${ports.join(', ')}). Free one, set QDADM_RELAY_PORT to a free port, or run ` +
              'a private relay with --port <free port> and give the app the same one: ' +
              'installQdadmRelayConnector({ ports: [<port>] }).'
    )
    process.exitCode = 1
    return
  }
  const { port, value: http, busy } = listening
  if (busy.length > 0) log(`in use, skipped: ${busy.join(', ')}`)

  identity = {
    name: 'qdadm-mcp-relay',
    protocol: RELAY_PROTOCOL,
    project: basename(process.cwd()),
    cwd: process.cwd(),
    port,
    pid: process.pid,
    startedAt: Date.now(),
  }
  broker.setIdentity(identity)

  const wss = new WebSocketServer({ server: http })
  wss.on('connection', (socket, req) => broker.attach(socket, { origin: req.headers.origin }))
  wss.on('error', (e) => log(`listener error: ${e.message}`))
  http.on('error', (e) => log(`listener error: ${e.message}`))

  if (shared) {
    writeRunFile(
      {
        pid: process.pid,
        port,
        token: opts.token,
        startedAt: identity.startedAt,
        cwd: identity.cwd,
        log: process.env.QDADM_RELAY_LOG ?? null,
      },
      runFile
    )
  }

  const shutdown = (why: string) => {
    log(`stopping: ${why}`)
    if (shared) {
      removeRunFile(process.pid, runFile)
      releaseRelayLock(runFile)
    }
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  if (opts.background) {
    const idle = setInterval(() => {
      if (broker.connectedCount() === 0 && Date.now() - lastMcpCall > opts.idleMs) {
        shutdown(`idle for ${Math.round(opts.idleMs / 60000)} min — no tab, no agent`)
      }
    }, 60 * 1000)
    idle.unref()
  }

  // The host it really listens on: 'localhost' printed for a wider bind would be a half-truth.
  const shown = opts.bind === '0.0.0.0' || opts.bind === '::' ? 'localhost' : opts.bind
  log(`listening      ws://${shown}:${port}  (MCP: http://${shown}:${port}/mcp)`)
  if (!isLoopbackHost(opts.bind)) {
    // Said out loud: this is no longer a socket only this machine can reach.
    log(`bound to       ${opts.bind} — anything that reaches this port can try, this machine or not`)
    log('who gets in    tabs need the page token; --origin limits which pages may pair')
  }
  if (shared) log(`run file       ${runFile}`)
  log('dev tabs       connect on their own (qdadmMcpPlugin)')
  log('other tabs     debug bar → MCP tab → Pair, then give the agent the code')
  log('agents         MCP stdio server: npx qdadm-mcp-relay --stdio')
  // The token lets a tab in without a code: print it to a terminal, never into a log file.
  if (!opts.background) log(`token fragment #qdadm-relay=ws://${shown}:${port}/${opts.token}`)
}
