/**
 * qdadm-mcp-relay (#1400) — MCP access to a STATIC qdadm site.
 *
 * The page dials out (ws) to this relay; agents connect to the relay's MCP
 * front (Streamable HTTP, or stdio with --stdio). Same 13 curated tools as
 * the dev-mode plugin.
 *
 *   npx qdadm-mcp-relay [--port 7777] [--mcp-port 7778] [--stdio]
 *                       [--token <fixed>] [--read-only]
 *
 * Then open the site with the pairing fragment printed at startup:
 *   https://your-site/#qdadm-relay=ws://localhost:7777/<token>
 * and hook the agent:
 *   claude mcp add --transport http qdadm-relay http://localhost:7778/mcp
 */
import { randomUUID } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { WebSocketServer } from 'ws'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createQdadmMcpServer } from '../server.ts'
import { RelayBroker } from './broker.ts'

interface CliOptions {
  port: number
  mcpPort: number
  stdio: boolean
  token: string
  readOnly: boolean
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    port: 7777,
    mcpPort: 7778,
    stdio: false,
    token: randomUUID().slice(0, 8),
    readOnly: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--port') opts.port = Number(argv[++i])
    else if (a === '--mcp-port') opts.mcpPort = Number(argv[++i])
    else if (a === '--stdio') opts.stdio = true
    else if (a === '--token') opts.token = String(argv[++i])
    else if (a === '--read-only') opts.readOnly = true
  }
  return opts
}

const buildServer = (broker: RelayBroker, readOnly: boolean) =>
  createQdadmMcpServer(broker, { readOnly, name: 'qdadm-relay' })

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const opts = parseArgs(argv)
  const log = opts.stdio ? console.error : console.log

  const broker = new RelayBroker({
    token: opts.token,
    onSession: (event, id) => log(`[qdadm-mcp-relay] page ${event}: ${id.slice(0, 8)}`),
  })

  const wss = new WebSocketServer({ port: opts.port })
  wss.on('connection', (socket) => broker.attach(socket))

  log(`[qdadm-mcp-relay] page listener  ws://localhost:${opts.port}`)
  log(`[qdadm-mcp-relay] pairing token  ${opts.token}`)
  log(`[qdadm-mcp-relay] open your site with:`)
  log(`  #qdadm-relay=ws://localhost:${opts.port}/${opts.token}`)

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
  http.listen(opts.mcpPort, () => {
    log(`[qdadm-mcp-relay] MCP endpoint   http://localhost:${opts.mcpPort}/mcp`)
    log(`  claude mcp add --transport http qdadm-relay http://localhost:${opts.mcpPort}/mcp`)
  })
}
