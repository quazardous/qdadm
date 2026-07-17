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

Every browser tab gets a session id; endpoints accept `?session=<id|latest>`.

## Debug bar

The optional in-app debug bar (`debugBar` kernel option, see the demo)
surfaces the same collectors visually: entities, routes, signals timeline,
auth state, i18n domains.
