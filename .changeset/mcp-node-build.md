---
"@quazardous/qdadm-mcp": patch
---

Fix: the MCP vite plugin can be imported from a real npm install (#1895, BookShepherd report). `exports` pointed at raw `.ts`, and Node refuses to strip types under `node_modules` — so a `vite.config.js` importing `qdadmMcpPlugin` died with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`, exactly as `@quazardous/qdadm` did before 2.16.1. Fixing qdadm alone moved the failure rather than removing it: a vite config does not load halfway, so one raw `.ts` under `node_modules` still took the whole config down. The package now builds to `dist/` via `prepack`. Unlike qdadm it is compiled end to end, because nothing here is bundled by a consumer's app — it is a vite plugin and an MCP server, both loaded by Node. The consumer-smoke gate now packs and imports this package alongside qdadm, and resolves a vite config using all three plugins: a gate watching one package of a family reports green while the consumer is blocked.
