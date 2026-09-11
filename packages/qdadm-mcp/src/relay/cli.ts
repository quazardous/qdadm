/**
 * qdadm-mcp-relay (#1400, #2231) — the machine's relay between app tabs and agents.
 *
 * ONE relay serves every app and tab of the user. It listens on the first
 * free port of 47761–47765 and carries, on that single port:
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
 *                       [--port <p>] [--token <fixed>] [--background]
 *
 * `--port` runs a private relay on that port — no run file, no lock.
 * `--background` (how the plugin and the front spawn it) exits after 30
 * minutes with no connected tab and no MCP call.
 */
import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { basename } from 'node:path'
import { WebSocketServer } from 'ws'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createQdadmMcpServer } from '../server.ts'
import { RELAY_PORTS, RELAY_PROTOCOL, type RelayIdentity } from '../protocol.ts'
import { RelayBroker } from './broker.ts'
import { AllPortsBusyError, listenOnFirstFreePort, openHttpServer } from './ports.ts'
import {
  acquireRelayLock,
  findRunningRelay,
  releaseRelayLock,
  removeRunFile,
  runFilePath,
  writeRunFile,
} from './runfile.ts'
import { runStdioFront } from './front.ts'

interface CliOptions {
  /** One explicit port — a private relay. Null: the shared relay on RELAY_PORTS. */
  port: number | null
  stdio: boolean
  background: boolean
  token: string
  readOnly: boolean
  origins: string[]
  idleMs: number
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    port: null,
    stdio: false,
    background: false,
    token: randomUUID(),
    readOnly: false,
    origins: [],
    idleMs: 30 * 60 * 1000,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--port') opts.port = Number(argv[++i])
    else if (a === '--stdio') opts.stdio = true
    else if (a === '--background') opts.background = true
    else if (a === '--token') opts.token = String(argv[++i])
    else if (a === '--read-only') opts.readOnly = true
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

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv)
  if (opts.stdio) return runStdioFront({ readOnly: opts.readOnly })

  const log = (m: string) => console.log(`${new Date().toISOString().slice(11, 19)} [qdadm-mcp-relay] ${m}`)
  const shared = opts.port === null
  const runFile = runFilePath()

  if (shared) {
    const running = await findRunningRelay(runFile)
    if (running) {
      log(`already running — pid ${running.pid}, ws://localhost:${running.port} (${runFile})`)
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
    sendJson(res, 404, { error: 'GET /identity · POST /mcp · WebSocket for app tabs' })
  }

  const ports = opts.port ? [opts.port] : RELAY_PORTS
  let listening: { port: number; value: Awaited<ReturnType<typeof openHttpServer>>; busy: number[] }
  try {
    listening = await listenOnFirstFreePort(ports, (p) => openHttpServer(p, (req, res) => void handle(req, res)))
  } catch (e) {
    if (shared) releaseRelayLock(runFile)
    if (!(e instanceof AllPortsBusyError)) throw e
    log(
      opts.port
        ? `port ${opts.port} is already in use. Pick another with --port.`
        : `every relay port is in use (${ports.join(', ')}). Free one, or run a private relay with --port <free port> ` +
            'and give the app the same one: installQdadmRelayConnector({ ports: [<port>] }).'
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

  log(`listening      ws://localhost:${port}  (MCP: http://localhost:${port}/mcp)`)
  if (shared) log(`run file       ${runFile}`)
  log('dev tabs       connect on their own (qdadmMcpPlugin)')
  log('other tabs     debug bar → MCP tab → Pair, then give the agent the code')
  log('agents         MCP stdio server: npx qdadm-mcp-relay --stdio')
  // The token lets a tab in without a code: print it to a terminal, never into a log file.
  if (!opts.background) log(`token fragment #qdadm-relay=ws://localhost:${port}/${opts.token}`)
}
