# Debug bridge — qdadm for AI agents

Every qdadm app is **self-describing at runtime**: the framework exposes its
kernel, entity managers, routes, signals and state through a debug bridge
that an AI agent (or you, in the console) can introspect and drive — no
source-code access needed.

![An AI agent introspects the live demo and creates a book through window.__qdadm](./assets/qdadm-ai-agent-session.gif)

## `window.__qdadm` — the in-page bridge

Available in every running qdadm app (including static production builds):

| Key | What it gives you |
|-----|-------------------|
| `kernel` | The Kernel instance (options, layouts, features) |
| `orchestrator` | Entity managers: `getRegisteredNames()`, `get(entity)`, `isRegistered(entity)` |
| `router` | The vue-router instance (`getRoutes()`, `push()`) |
| `signals` | Signal bus (`on`, `emit`) |
| `hooks` | Hook registry (alter/invoke) |
| `zones` | Zone registry (UI composition blocks) |
| `activeStack` / `stackHydrator` | Current navigation chain (entity → id → child…) |
| `i18n` | I18n instance (locale, domains) |
| `debug` | Debug collectors (`describe()` manifests, `dump()` snapshots) |

## Agent session (real transcript)

Run against the **public demo** — nothing installed, nothing mocked. This is
the session captured in the GIF above:

```js
// 1. What am I looking at?
const q = window.__qdadm
q.orchestrator.getRegisteredNames()
// → ['users','countries','products','settings','favorites','jp_users',
//    'posts','todos','books','genres','loans','roles']
q.router.getRoutes().length          // → 43

// 2. Read some data
const books = q.orchestrator.get('books')
await books.list({ page_size: 3 })
// → { items: [{ title: 'Dune', … }, …], total: 8 }
books.idField                        // → 'bookId'
books.canCreate()                    // → true (permission-checked)

// 3. Act — same path the UI uses (signals, cache, permissions included)
await books.create({
  title: 'Written by an AI agent',
  author: 'Claude',
  year: 2026,
  genre: 'sci-fi',
})
// → persisted; the list page picks it up like any user-created record
```

`AGENTS.md` (repo root) is the operational how-to for agents working ON the
qdadm codebase; this page is about driving a qdadm APP from the outside.

## MCP server — one connection, full arsenal

[`@quazardous/qdadm-mcp`](https://github.com/quazardous/qdadm/tree/main/packages/qdadm-mcp)
lets any MCP-capable agent debug the live app directly.

```ts
// main.ts — FIRST import (boot capture)
import { installQdadmRelayConnector } from '@quazardous/qdadm-mcp/connector'
installQdadmRelayConnector()
```

```ts
// vite.config.ts
import { qdadmMcpPlugin } from '@quazardous/qdadm-mcp'
plugins: [vue(), qdadmVitePlugin(), qdadmDebugPlugin(), qdadmMcpPlugin()]
```

```bash
npx qdadm-mcp-relay --stdio   # the agent's MCP stdio server
```

(Claude Code: `claude mcp add qdadm -- npx qdadm-mcp-relay --stdio`.)

`npm run dev` starts the machine's relay (found through
`~/.qdadm_relay.run`), and every page the dev server serves connects to it
on its own. The agent attaches to the same relay. Each tab is an instance:
`instances` lists them, and every tool takes `instance`, which may be left
out while a single one is connected. The relay outlives dev-server restarts.

A tab outside dev (static build, preview) pairs instead: debug bar → **MCP**
tab → **Pair** → give the agent the code, which it passes to `pair_accept`.

Tools: `instances`, `session_info` (zombie-tab detector), `navigate` (a
path or a route, like a user, waits for the page to settle), `wait_for` (a
route or a signal), `boot_errors` (captures failures from BEFORE the app
booted), `routes`, `entity_state`, `entity_list/get/create/update/delete`
(through the manager — permissions, cache and signals apply; `readOnly: true`
to disable writes), `storage_dump` (raw localStorage view to diff against the
manager), `recent_signals`, `describe`/`bridge_call` for collector discovery,
`chat_send`/`chat_read`, and `pair_accept`.

`navigate`, the entity writes and `bridge_call` return a **`feedback`**
block: route change, console errors, toasts, missing i18n keys, failed API
calls — what the tab went through while the call ran. Every response carries a
session stamp. The MCP acts within that browser session — manager permissions
apply.

In the app, the debug bar's **MCP** tab shows the instance id (click to copy)
and three sub-tabs: **Status**, **Chat** with the agent, and **History** of
every MCP request the tab served. Relay, run file, pairing and security: the
package README.

## Dev-server HTTP endpoints

With the debug vite plugin enabled, the bridge is also reachable over HTTP —
no browser required:

```ts
// vite.config.ts
import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
plugins: [vue(), qdadmVitePlugin(), qdadmDebugPlugin()]
```

| Endpoint | Returns |
|----------|---------|
| `GET /__qdadm/` | Index + cache stats |
| `GET /__qdadm/sessions` | Connected browser sessions |
| `GET /__qdadm/describe.json` | Collector manifests — what can be inspected/called |
| `GET /__qdadm/snapshot.json` | Live state dump |
| `POST /__qdadm/call` | `{ collector, action, args? }` — invoke a collector action |

Every browser tab gets a session id, kept across reloads; endpoints accept
`?session=<id|latest>` (`latest` = the most recently active connected tab).

## Debug bar

The optional in-app debug bar (`debugBar` kernel option, see the demo)
surfaces the same collectors visually: entities, routes, signals timeline,
auth state, i18n domains.
With the relay connector installed, an **MCP** tab shows how the tab reaches
the relay — connected by the dev server, or paired (see above).

`debugBar: { enabled: false }` turns it off — both the bar and the debug mode
it would otherwise switch on.

### Turning it off without a deploy

Add `?qddebug=off` to any URL. The bar goes, and stays gone across reloads and
redirects until `?qddebug=on` brings it back. It overrides `enabled: true`,
needs no rebuild, and is the way out when the bar itself is the problem.

### The bar cannot take the app down

Two independent guards, because they catch different things:

- a bar that **throws** is dropped and the application keeps rendering, with
  the reason on the console;
- a bar that **loops** — which throws nothing — suspends itself past 60 updates
  in a second and says so on screen in place of itself.

Both are automatic. A suspended bar comes back on reload; if it suspends again,
use `?qddebug=off`.
