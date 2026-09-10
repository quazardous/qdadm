/**
 * qdadm-mcp-relay (#1400, #2231) — MCP access to a qdadm app through the tab you pair.
 *
 * The relay is the AGENT's tool. Spawned by the agent over stdio, it lives
 * exactly as long as the agent session, so restarting the app never takes
 * the MCP server away — Claude Code does not retry an HTTP server that was
 * down when the session started (measured in #2231).
 *
 *   claude mcp add qdadm -- npx qdadm-mcp-relay --stdio
 *
 * Then in the app: debug bar → "Pair MCP" → read the code to the agent,
 * which calls `pair_accept`.
 *
 *   npx qdadm-mcp-relay [--stdio] [--port <p>] [--origin <origin>]...
 *                       [--mcp-port 7778] [--token <fixed>] [--read-only]
 *
 * The token fragment of #1400 still works:
 *   https://your-site/#qdadm-relay=ws://localhost:<port>/<token>
 */
import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { basename } from 'node:path'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createQdadmMcpServer } from '../server.ts'
import { RELAY_PORTS, RELAY_PROTOCOL, type RelayIdentity } from '../protocol.ts'
import { RelayBroker } from './broker.ts'
import { AllPortsBusyError, listenOnFirstFreePort, openWebSocketServer } from './ports.ts'

interface CliOptions {
  /** One explicit port; null walks RELAY_PORTS. */
  port: number | null
  mcpPort: number
  stdio: boolean
  token: string
  readOnly: boolean
  origins: string[]
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    port: null,
    mcpPort: 7778,
    stdio: false,
    token: randomUUID().slice(0, 8),
    readOnly: false,
    origins: [],
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--port') opts.port = Number(argv[++i])
    else if (a === '--mcp-port') opts.mcpPort = Number(argv[++i])
    else if (a === '--stdio') opts.stdio = true
    else if (a === '--token') opts.token = String(argv[++i])
    else if (a === '--read-only') opts.readOnly = true
    else if (a === '--origin') opts.origins.push(String(argv[++i]))
  }
  return opts
}

const buildServer = (broker: RelayBroker, readOnly: boolean) =>
  createQdadmMcpServer(broker, { readOnly, name: 'qdadm-relay' })

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv)
  // Under --stdio, stdout IS the MCP channel: every human line goes to stderr.
  const log = opts.stdio ? console.error : console.log

  const ports = opts.port ? [opts.port] : RELAY_PORTS
  let listening: Awaited<ReturnType<typeof listenOnFirstFreePort<Awaited<ReturnType<typeof openWebSocketServer>>>>>
  try {
    listening = await listenOnFirstFreePort(ports, (p) => openWebSocketServer(p))
  } catch (e) {
    if (!(e instanceof AllPortsBusyError)) throw e
    log(
      opts.port
        ? `[qdadm-mcp-relay] port ${opts.port} is already in use. Pick another with --port.`
        : `[qdadm-mcp-relay] every relay port is in use (${ports.join(', ')}). Pass --port <free port>, ` +
            'and give the app the same one: installQdadmRelayConnector({ ports: [<port>] }).'
    )
    process.exitCode = 1
    return
  }
  const { port, value: wss, busy } = listening
  if (busy.length > 0) log(`[qdadm-mcp-relay] in use, skipped: ${busy.join(', ')}`)
  if (opts.port && !RELAY_PORTS.includes(port)) {
    log(`[qdadm-mcp-relay] ${port} is not a default port: the app needs installQdadmRelayConnector({ ports: [${port}] })`)
  }

  const identity: RelayIdentity = {
    name: 'qdadm-mcp-relay',
    protocol: RELAY_PROTOCOL,
    project: basename(process.cwd()),
    cwd: process.cwd(),
    port,
    pid: process.pid,
    startedAt: Date.now(),
  }
  const broker = new RelayBroker({
    token: opts.token,
    identity,
    allowedOrigins: opts.origins.length > 0 ? opts.origins : undefined,
    onSession: (event, id, detail) =>
      log(`[qdadm-mcp-relay] tab ${event}: ${id.slice(0, 8)}${detail ? ` (${detail})` : ''}`),
  })
  wss.on('connection', (socket, req) => broker.attach(socket, { origin: req.headers.origin }))
  wss.on('error', (e) => log(`[qdadm-mcp-relay] listener error: ${e.message}`))

  log(`[qdadm-mcp-relay] listening       ws://localhost:${port}  (${identity.project})`)
  log('[qdadm-mcp-relay] pair a tab:     debug bar → "Pair MCP", then give the agent the code')
  log(`[qdadm-mcp-relay] token fragment  #qdadm-relay=ws://localhost:${port}/${opts.token}`)

  if (opts.stdio) {
    const server = buildServer(broker, opts.readOnly)
    await server.connect(new StdioServerTransport())
    log('[qdadm-mcp-relay] MCP on stdio')
    return
  }

  const http = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (url.pathname !== '/mcp') {
      res.statusCode = 404
      res.end(JSON.stringify({ error: 'POST /mcp (MCP Streamable HTTP)' }))
      return
    }
    try {
      const server = buildServer(broker, opts.readOnly)
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => {
        void transport.close()
        void server.close()
      })
      await server.connect(transport)
      await transport.handleRequest(req, res)
    } catch (e) {
      if (!res.headersSent) {
        res.statusCode = 500
        res.end(
          JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32603, message: (e as Error).message },
            id: null,
          })
        )
      }
    }
  })
  http.on('error', (e: NodeJS.ErrnoException) => {
    log(
      `[qdadm-mcp-relay] the MCP endpoint cannot listen on ${opts.mcpPort} (${e.code ?? e.message}). ` +
        'Pass --mcp-port <free port>, or let the agent spawn the relay with --stdio.'
    )
    process.exit(1)
  })
  http.listen(opts.mcpPort, '127.0.0.1', () => {
    log(`[qdadm-mcp-relay] MCP endpoint    http://localhost:${opts.mcpPort}/mcp`)
    log(`  claude mcp add --transport http qdadm-relay http://localhost:${opts.mcpPort}/mcp`)
  })
}
