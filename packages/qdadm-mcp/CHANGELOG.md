# @quazardous/qdadm-mcp

## 0.2.0

### Minor Changes

- ed9c583: Agent-grade error messages across the toolset (#1497, skybot testbed feedback). Tool registration moves to the low-level MCP Server: advertised JSON Schema keeps `required` correctly declared, and argument validation is now ours — failures come back as one actionable sentence (no more raw ZodError dumps), with the registered entity names appended when an `entity` argument is missing and a session is reachable. `boot_errors` tells the truth: its description and its no-session message now say it needs an open tab — a blank page counts, the pre-boot capture loads before the app. Minor (not patch): the exported `ToolDef` shape changed (plain `args` specs replace zod `inputSchema`).

## 0.1.0

### Minor Changes

- 516a440: Initial release: MCP server for running qdadm apps (#1398)

  `qdadmMcpPlugin()` (vite dev plugin) exposes a stateless Streamable-HTTP
  MCP endpoint at `/__qdadm/mcp` over qdadm's debug broker. Curated toolset —
  session_info, boot_errors, routes, entity_state, entity_list/get/create/
  update/delete (readOnly option), storage_dump, recent_signals, describe,
  bridge_call — every response session-stamped. Dev-server only by
  construction; works behind an HTTPS vhost/proxy.

- 9ae1e74: MCP relay for static/no-API sites (#1400): `npx qdadm-mcp-relay` accepts a
  page's outbound WebSocket (token pairing) and fronts the same 13-tool MCP
  (Streamable HTTP + --stdio). Opt-in browser connector at
  `@quazardous/qdadm-mcp/connector` — inert without the
  `#qdadm-relay=<ws-url>/<token>` URL fragment, boot-error capture included.
