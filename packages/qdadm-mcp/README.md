# @quazardous/qdadm-mcp

**MCP server for qdadm apps — an agent debugs your live app in one connection.**

Two setups, same 13 tools:

- **Dev server** — a Vite plugin serves the MCP on the dev server itself.
- **Static site / no backend** (GitHub Pages, `vite preview`, any hosting) —
  the page dials out to a small relay CLI, the relay fronts the MCP.

```bash
npm install -D @quazardous/qdadm-mcp
```

## Setup A — dev server

Requires `qdadmDebugPlugin` (the broker) before it in the plugin list:

```ts
// vite.config.ts
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
import { qdadmMcpPlugin } from '@quazardous/qdadm-mcp'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin(), qdadmDebugPlugin(), qdadmMcpPlugin()],
})
```

Hook an agent up (adjust the port to your dev server):

```bash
claude mcp add --transport http qdadm http://localhost:5174/__qdadm/mcp
```

Options: `qdadmMcpPlugin({ readOnly: true })` drops the three write tools.
The endpoint is dev-only by construction (`apply: 'serve'`) — it cannot
exist in a production build. Stateless Streamable HTTP: works behind an
HTTPS vhost/proxy as long as `/__qdadm/*` is forwarded.

## Setup B — static site (the relay)

Browsers can't accept inbound connections, so the page dials OUT:

**1. Wire the connector** — FIRST import of your entry (that's what enables
pre-boot error capture). It is **inert by default**: without the pairing
fragment in the URL, nothing runs, nothing connects.

```ts
// main.ts — first import
import { installQdadmRelayConnector } from '@quazardous/qdadm-mcp/connector'
installQdadmRelayConnector()
```

**2. Start the relay** (needs Node ≥ 22.18, no build step):

```bash
npx qdadm-mcp-relay
# [qdadm-mcp-relay] page listener  ws://localhost:7777
# [qdadm-mcp-relay] pairing token  3f9c21ab
# [qdadm-mcp-relay] open your site with:
#   #qdadm-relay=ws://localhost:7777/3f9c21ab
# [qdadm-mcp-relay] MCP endpoint   http://localhost:7778/mcp
```

| Flag | Default | |
|---|---|---|
| `--port` | 7777 | WebSocket listener the page dials into |
| `--mcp-port` | 7778 | Streamable HTTP MCP endpoint (`/mcp`) |
| `--token` | random | Fixed pairing token instead of a generated one |
| `--read-only` | off | Drop the three write tools |
| `--stdio` | off | Serve MCP on stdio instead of HTTP (see below) |

**3. Open the site with the pairing fragment** printed at startup:

```
https://your-site/#qdadm-relay=ws://localhost:7777/<token>
```

**4. Hook an agent up:**

```bash
claude mcp add --transport http qdadm-relay http://localhost:7778/mcp
```

Or skip the HTTP port entirely — let the agent spawn the relay over stdio
(fix the token so the fragment survives restarts):

```bash
claude mcp add qdadm-relay -- npx qdadm-mcp-relay --stdio --token mytoken
```

Activation is explicit by design: token pairing, never ambient. Shipping
the connector in production is safe — visitors without the fragment run
exactly the app they would without it.

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
| `entity_create` / `entity_update` / `entity_delete` | Act like the UI would (disabled by `readOnly`) |
| `storage_dump` | RAW localStorage view — diff against `entity_list` to catch seed/cache bugs |
| `recent_signals` | Last signal names on the bus |
| `describe` / `bridge_call` | Collector discovery + escape hatch |

## Agent playbook

Typical debugging moves, grounded in real sessions:

- **Always start with `session_info`** — it tells you which tab you're
  driving (app name/version, current route, session age). A stale
  `ageMs` means you're talking to a zombie tab: have the page reloaded.
- **Blank page / app won't boot** → `boot_errors`. Capture starts before
  the app entry runs, so crashes during boot are recorded even though the
  bridge never came up.
- **"The list shows wrong data"** → `entity_list` (what the manager
  serves: permissions + cache applied) vs `storage_dump` (raw
  localStorage). A mismatch localizes the bug to cache/seed vs render.
- **"Is it a permission problem?"** → `entity_state` returns the
  current user's `can.create/read/update/delete` for the entity.
- **Reproduce a user action** → `entity_create`/`update`/`delete` go
  through the manager exactly like the UI (signals fire, cache updates,
  permissions enforced) — not a backdoor write.
- **"Did my action trigger anything?"** → `recent_signals` (first call
  arms the listener; call it once early, then re-read after acting).
- **Anything else** → `describe` lists the debug collectors, then
  `bridge_call {collector, action, args}` invokes one.

Error messages are actionable on purpose: no page connected → the exact
fragment to open; unknown entity → the list of registered names.

## Scope & security

The MCP acts **within the browser session of whoever has the tab open** —
manager permissions apply; it can do what that user can do, nothing more.
Dev plugin: endpoint exists only on the dev server. Relay: connection
requires the explicit pairing fragment (token checked on `hello`, bad
token → rejected and closed). `readOnly` drops the write tools on either
setup.

Full documentation: [DEBUG.md](https://github.com/quazardous/qdadm/blob/main/docs/DEBUG.md)

## License

MIT
