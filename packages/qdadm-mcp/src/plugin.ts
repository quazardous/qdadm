/**
 * qdadmMcpPlugin — MCP for a running qdadm app, from `npm run dev` (#1398, #2231).
 *
 * Vite DEV plugin (apply: 'serve' — by construction absent from production
 * builds). Two things:
 *
 * 1. **The relay.** It finds the machine's qdadm-mcp-relay, or starts one
 *    detached — it outlives this dev server, so restarting the app never
 *    takes the agents' MCP away. Every page it serves connects to the relay
 *    on its own, with no pairing code: the plugin serves the relay's page
 *    token at `<prefix>/relay.json` and marks the page as a dev page. Agents
 *    attach through the MCP stdio server `npx qdadm-mcp-relay --stdio`.
 *    `relay: false` turns this off.
 *
 * 2. **A dev-server MCP endpoint** at `<prefix>/mcp` (default
 *    `/__qdadm/mcp`), over the broker of qdadm's `qdadmDebugPlugin`:
 *    Streamable HTTP, e.g. `http://localhost:5174/__qdadm/mcp`.
 *    It lives and dies with the dev server.
 *
 * ```ts
 * // vite.config.ts
 * import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
 * import { qdadmMcpPlugin } from '@quazardous/qdadm-mcp'
 * plugins: [vue(), qdadmVitePlugin(), qdadmDebugPlugin(), qdadmMcpPlugin()]
 * ```
 *
 * The page must also install the connector (`@quazardous/qdadm-mcp/connector`,
 * first import of the entry) — it is what answers the relay.
 */
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createQdadmMcpServer } from './server.ts'
import type { DebugBrokerApi, ToolsetOptions } from './tools.ts'
import { RELAY_AUTO_GLOBAL, type RelayAutoConfig } from './protocol.ts'
import { ensureRelay } from './relay/runfile.ts'

export interface QdadmMcpPluginOptions extends ToolsetOptions {
  /**
   * Endpoint path. Default: `<debug plugin prefix>/mcp` (`/__qdadm/mcp`).
   */
  path?: string
  /** MCP server identity (shown to clients). */
  serverInfo?: { name?: string; version?: string }
  /**
   * Start (or find) the machine's relay and connect every dev page to it
   * (default true).
   */
  relay?: boolean
}

export function qdadmMcpPlugin(options: QdadmMcpPluginOptions = {}): Plugin {
  let broker: DebugBrokerApi | null = null
  let mcpPath = options.path ?? null
  let relayPath = '/__qdadm/relay.json'
  const relayEnabled = options.relay ?? true

  const buildServer = () =>
    createQdadmMcpServer(broker!, {
      ...options,
      name: options.serverInfo?.name ?? 'qdadm',
      version: options.serverInfo?.version ?? '1.0.0',
    })

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
      relayPath = `${api.prefix}/relay.json`
    },

    transformIndexHtml() {
      if (!relayEnabled) return
      // Before any module script: the connector reads it at install.
      return [
        {
          tag: 'script',
          injectTo: 'head-prepend',
          children: `window.${RELAY_AUTO_GLOBAL}=${JSON.stringify(relayPath)}`,
        },
      ]
    },

    configureServer(s) {
      if (relayEnabled) {
        // Now rather than on the first page load, so the page finds it up.
        ensureRelay()
          .then(({ info, started }) =>
            s.config.logger.info(
              `  [qdadm-mcp] relay ${started ? 'started' : 'running'} on ws://localhost:${info.port} — ` +
                'agents: MCP stdio server `npx qdadm-mcp-relay --stdio`'
            )
          )
          .catch((e: Error) =>
            s.config.logger.warn(`  [qdadm-mcp] relay unavailable (${e.message}) — dev pages will not connect to it`)
          )
      }

      s.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (!req.url) return next()
        const url = new URL(req.url, 'http://localhost')

        if (relayEnabled && url.pathname === relayPath) {
          // The token lets a tab drive a logged-in session through the relay:
          // only this app's own pages may read it.
          if (req.headers['sec-fetch-site'] === 'cross-site') {
            res.statusCode = 403
            res.end()
            return
          }
          res.setHeader('content-type', 'application/json; charset=utf-8')
          res.setHeader('cache-control', 'no-store')
          try {
            const { info } = await ensureRelay()
            res.end(JSON.stringify({ port: info.port, token: info.token } satisfies RelayAutoConfig))
          } catch (e) {
            res.statusCode = 503
            res.end(JSON.stringify({ error: (e as Error).message }))
          }
          return
        }

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
