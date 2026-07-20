# @quazardous/qdadm-mcp

**MCP server for running qdadm apps — an agent debugs your live app in one connection.**

## Installation

```bash
npm install -D @quazardous/qdadm-mcp
```

```ts
// vite.config.ts — requires qdadmDebugPlugin (the broker) before it
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
import { qdadmMcpPlugin } from '@quazardous/qdadm-mcp'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin(), qdadmDebugPlugin(), qdadmMcpPlugin()],
})
```

Hook an agent up:

```bash
claude mcp add --transport http qdadm http://localhost:5174/__qdadm/mcp
```

## Tools

Curated debugging arsenal (every response carries a session stamp;
`session` defaults to the most recently active tab):

| Tool | What it answers |
|---|---|
| `session_info` | Which app/session am I talking to? (zombie-tab detector) |
| `boot_errors` | What broke — **including before the app booted** |
| `routes` | Route names/paths/meta |
| `entity_state` | Entities, idField, field schema, current-user permissions, storage key |
| `entity_list` / `entity_get` | Read through the EntityManager (permissions + cache apply) |
| `entity_create` / `entity_update` / `entity_delete` | Act like the UI would (disable with `readOnly: true`) |
| `storage_dump` | RAW localStorage view — diff against `entity_list` to catch seed/cache bugs |
| `recent_signals` | Last signal names on the bus |
| `describe` / `bridge_call` | Collector discovery + escape hatch |

## Scope

Dev-server only by construction (`apply: 'serve'`) — the endpoint cannot
exist in a production build. Stateless Streamable HTTP: works behind an
HTTPS vhost/proxy as long as `/__qdadm/*` is forwarded. The MCP acts within
the browser session of whoever has the tab open — manager permissions apply.

Full documentation: [DEBUG.md](https://github.com/quazardous/qdadm/blob/main/docs/DEBUG.md)

## License

MIT
