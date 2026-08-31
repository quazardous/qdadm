# @quazardous/qdadm-mcp

## 0.2.2

### Patch Changes

- 5c5c1e2: Fix: the built entry points exist after a plain `npm install`, not only after `npm pack`. Pointing `exports` at `dist/` (#1895) paired it with a `prepack` hook, which npm runs when packing or publishing — but not on install. A workspace link or a `file:` dependency therefore had no `dist/`, and any bundler resolving `@quazardous/qdadm/vite` or `@quazardous/qdadm-mcp` failed with "Failed to resolve entry for package". The hook is now `prepare`, which npm runs on install _and_ before pack and publish, so every consumption path gets the build.

## 0.2.1

### Patch Changes

- e4fd1dd: Fix: the MCP vite plugin can be imported from a real npm install (#1895, BookShepherd report). `exports` pointed at raw `.ts`, and Node refuses to strip types under `node_modules` — so a `vite.config.js` importing `qdadmMcpPlugin` died with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, exactly as `@quazardous/qdadm` did before 2.16.1. Fixing qdadm alone moved the failure rather than removing it: a vite config does not load halfway, so one raw `.ts` under `node_modules` still took the whole config down. The package now builds to `dist/` via `prepack`. Unlike qdadm it is compiled end to end, because nothing here is bundled by a consumer's app — it is a vite plugin and an MCP server, both loaded by Node. The consumer-smoke gate now packs and imports this package alongside qdadm, and resolves a vite config using all three plugins: a gate watching one package of a family reports green while the consumer is blocked.

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
