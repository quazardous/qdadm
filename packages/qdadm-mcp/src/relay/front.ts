/**
 * `qdadm-mcp-relay --stdio` (#2231) — the agent's MCP server, attached to THE relay.
 *
 * The agent spawns this. It finds the machine's relay through
 * `~/.qdadm_relay.run`, starts one when there is none, and forwards every MCP
 * request to it. `QDADM_RELAY_URL` points it at a relay somewhere else
 * instead — a container, a proxy, another machine — and then it starts
 * nothing. It never fails at startup: Claude Code marks a server that
 * fails then as failed for the whole session (measured in #2231). While no
 * relay can be reached, the tool list still answers and tool calls come back
 * as actionable errors; the next call tries again.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'
import { createQdadmMcpServer } from '../server.ts'
import { WRITE_TOOLS, type DebugBrokerApi } from '../tools.ts'
import { relayBaseUrl, relayMcpEndpoint } from './ports.ts'
import { ensureRelay } from './runfile.ts'
import { keepScreenshot } from './screenshots.ts'

export interface StdioFrontOptions {
  readOnly?: boolean
  /** Keep every screenshot under `.aiball/screenshots/` in the project (#2284). Default true. */
  saveScreenshots?: boolean
  /** The project: the directory the agent's client started this front in. Default: process.cwd(). */
  cwd?: string
  now?: () => Date
  log?: (message: string) => void
  /** Test seam: how to reach the relay's MCP endpoint. */
  resolveEndpoint?: () => Promise<URL>
  /** Test seam: the upstream MCP client itself. */
  connectUpstream?: () => Promise<Client>
}

const errorResult = (text: string): CallToolResult => ({ isError: true, content: [{ type: 'text', text }] })

/** The tool list without a relay: the same definitions, built locally. */
async function offlineTools(): Promise<Tool[]> {
  const unreachable = () => Promise.reject(new Error('relay unreachable'))
  const stub: DebugBrokerApi = {
    ask: unreachable,
    pickSession: () => null,
    listSessions: () => [],
    prefix: '/relay',
    pairing: { status: () => ({ waiting: [] }), accept: () => unreachable() },
  }
  const server = createQdadmMcpServer(stub, { name: 'qdadm-relay' })
  const client = new Client({ name: 'qdadm-mcp-front', version: '1.0.0' })
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair()
  await Promise.all([server.connect(serverSide), client.connect(clientSide)])
  const { tools } = await client.listTools()
  await client.close()
  return tools
}

export function createStdioFront(options: StdioFrontOptions = {}): Server {
  const log = options.log ?? ((m: string) => console.error(m))
  const resolveEndpoint =
    options.resolveEndpoint ??
    (async () => {
      const base = relayBaseUrl()
      if (base) {
        // Its relay, not ours: starting a local one would answer about the wrong browser.
        log(`[qdadm-mcp-relay] the relay at ${base.href} (QDADM_RELAY_URL) — starting none here`)
        return relayMcpEndpoint(base)
      }
      const { info, started } = await ensureRelay()
      if (started) log(`[qdadm-mcp-relay] started the relay: pid ${info.pid}, ws://localhost:${info.port}`)
      return new URL(`http://127.0.0.1:${info.port}/mcp`)
    })

  let upstream: Client | null = null
  const connect =
    options.connectUpstream ??
    (async () => {
      const client = new Client({ name: 'qdadm-mcp-front', version: '1.0.0' })
      await client.connect(new StreamableHTTPClientTransport(await resolveEndpoint()))
      return client
    })
  /** One retry with a fresh connection: the relay may have been restarted since the last call. */
  const withUpstream = async <T>(fn: (client: Client) => Promise<T>): Promise<T> => {
    let lastError: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        upstream ??= await connect()
        return await fn(upstream)
      } catch (e) {
        lastError = e
        const stale = upstream
        upstream = null
        await stale?.close().catch(() => {})
      }
    }
    throw lastError
  }

  const server = new Server({ name: 'qdadm-relay', version: '1.0.0' }, { capabilities: { tools: {} } })
  // Closing the front closes its line to the relay: an open HTTP client keeps a one-shot `--call` from exiting (#2263).
  server.onclose = () => {
    const stale = upstream
    upstream = null
    void stale?.close().catch(() => {})
  }

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    let tools: Tool[]
    try {
      tools = (await withUpstream((c) => c.listTools())).tools
    } catch {
      tools = await offlineTools()
    }
    return { tools: options.readOnly ? tools.filter((t) => !WRITE_TOOLS.has(t.name)) : tools }
  })

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    if (options.readOnly && WRITE_TOOLS.has(name)) {
      return errorResult(`'${name}' is disabled: this MCP server runs with --read-only.`)
    }
    let result: CallToolResult
    try {
      result = (await withUpstream((c) => c.callTool({ name, arguments: args ?? {} }))) as CallToolResult
    } catch (e) {
      let configured: URL | null = null
      try {
        configured = relayBaseUrl()
      } catch {
        /* the message below carries the reason */
      }
      return errorResult(
        configured
          ? `The qdadm relay at ${configured.href} could not be reached (${(e as Error).message}). Check that it runs ` +
              'there and that this machine can reach it — QDADM_RELAY_URL says where to look, and nothing is started here.'
          : `The qdadm relay could not be reached or started (${(e as Error).message}). Retry the call; if it keeps ` +
              'failing, run `npx qdadm-mcp-relay` in a terminal to see why.'
      )
    }
    if (options.saveScreenshots ?? true) {
      const keep = { cwd: options.cwd ?? process.cwd(), now: options.now }
      if (name === 'screenshot' && args?.save !== false) return keepScreenshot(result, keep)
      // #2309: the screenshots the user annotated and sent in the chat.
      if (name === 'chat_read') return keepScreenshot(result, { ...keep, label: 'chat' })
    }
    return result
  })

  return server
}

export async function runStdioFront(options: StdioFrontOptions = {}): Promise<void> {
  const log = options.log ?? ((m: string) => console.error(m))
  const server = createStdioFront({ ...options, log })
  await server.connect(new StdioServerTransport())
  log('[qdadm-mcp-relay] MCP on stdio — attached to the machine relay')
}
