/**
 * qdadmMcpPlugin — MCP server over a running qdadm app (#1398).
 *
 * Vite DEV plugin (apply: 'serve' — by construction absent from production
 * builds, the hard prod-gate invariant). Exposes a stateless Streamable-HTTP
 * MCP endpoint at `<debug prefix>/mcp` (default `/__qdadm/mcp`), backed by
 * the broker that qdadm's `qdadmDebugPlugin` exposes through the standard
 * Vite inter-plugin `api` — one page injection, one ws broker, two plugins.
 *
 * Hook an agent up:
 *
 * ```bash
 * claude mcp add --transport http qdadm http://localhost:5174/__qdadm/mcp
 * ```
 *
 * ```ts
 * // vite.config.ts
 * import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
 * import { qdadmMcpPlugin } from '@quazardous/qdadm-mcp'
 * plugins: [vue(), qdadmVitePlugin(), qdadmDebugPlugin(), qdadmMcpPlugin()]
 * ```
 *
 * Works behind an HTTPS vhost/proxy as long as the `/__qdadm/*` path is
 * forwarded — the endpoint is plain middleware and each POST is stateless.
 */
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { buildToolset, type DebugBrokerApi, type ToolsetOptions } from './tools.ts'

export interface QdadmMcpPluginOptions extends ToolsetOptions {
  /**
   * Endpoint path. Default: `<debug plugin prefix>/mcp` (`/__qdadm/mcp`).
   */
  path?: string
  /** MCP server identity (shown to clients). */
  serverInfo?: { name?: string; version?: string }
}

export function qdadmMcpPlugin(options: QdadmMcpPluginOptions = {}): Plugin {
  let broker: DebugBrokerApi | null = null
  let mcpPath = options.path ?? null

  function buildServer(): McpServer {
    const server = new McpServer({
      name: options.serverInfo?.name ?? 'qdadm',
      version: options.serverInfo?.version ?? '1.0.0',
    })
    for (const tool of buildToolset(broker!, options)) {
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputSchema },
        async (args: Record<string, unknown>) => {
          try {
            const result = await tool.handler(args ?? {})
            return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
          } catch (e) {
            return {
              isError: true,
              content: [{ type: 'text' as const, text: (e as Error).message }],
            }
          }
        }
      )
    }
    return server
  }

  return {
    name: 'qdadm-mcp',
    apply: 'serve',

    configResolved(config) {
      const debug = config.plugins.find((p) => p.name === 'qdadm-debug')
      const api = (debug as { api?: DebugBrokerApi } | undefined)?.api
      if (!api || typeof api.ask !== 'function') {
        throw new Error(
          '[qdadm-mcp] qdadmDebugPlugin not found (or too old to expose its broker api). ' +
            'Add qdadmDebugPlugin() from @quazardous/qdadm/vite-plugin-debug BEFORE qdadmMcpPlugin().'
        )
      }
      broker = api
      if (!mcpPath) mcpPath = `${api.prefix}/mcp`
    },

    configureServer(s) {
      s.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url) return next()
        const url = new URL(req.url, 'http://localhost')
        if (url.pathname !== mcpPath) return next()

        try {
          // Stateless mode: one server+transport per request — survives
          // proxies and needs no session affinity (skybot vhost caveat).
          const server = buildServer()
          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
          })
          res.on('close', () => {
            void transport.close()
            void server.close()
          })
          await server.connect(transport)
          await transport.handleRequest(req, res)
        } catch (e) {
          if (!res.headersSent) {
            res.statusCode = 500
            res.setHeader('content-type', 'application/json')
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
    },
  }
}

export default qdadmMcpPlugin
