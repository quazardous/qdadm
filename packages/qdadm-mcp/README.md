# @quazardous/qdadm-mcp

**MCP server for qdadm apps — an agent debugs your live app in one connection.**

One **relay** per machine sits between your app's browser tabs and your
agents. `npm run dev` starts it and connects every tab to it; the agent
attaches to it. Each tab is an **instance** the tools can target.

```bash
npm install -D @quazardous/qdadm-mcp
```

## Setup

**1. Wire the connector** — FIRST import of your entry (that is what
enables pre-boot error capture):

```ts
// main.ts — first import
import { installQdadmRelayConnector } from '@quazardous/qdadm-mcp/connector'
installQdadmRelayConnector()
```

On its own it does nothing: a page that is neither served by the dev server
nor paired opens no socket and wraps nothing. Safe to ship.

**2. Add the vite plugins** (qdadm's debug broker first):

```ts
// vite.config.ts
import { qdadmVitePlugin } from '@quazardous/qdadm/vite'
import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
import { qdadmMcpPlugin } from '@quazardous/qdadm-mcp'

export default defineConfig({
  plugins: [vue(), qdadmVitePlugin(), qdadmDebugPlugin(), qdadmMcpPlugin()],
})
```

`npm run dev` now starts the relay if none is running, and every page the
dev server serves connects to it at startup — no click, no code.

**3. Attach the agent.** Give its MCP client this stdio server:

```bash
npx qdadm-mcp-relay --stdio
```

With Claude Code, for instance: `claude mcp add qdadm -- npx qdadm-mcp-relay --stdio`.

The stdio server attaches to the running relay, or starts one. It never
fails at startup: while no relay can be reached, its tools answer with an
error to act on, and the next call tries again.

## Instances

Every connected tab is an instance: one id per tab, kept across reloads.

- `instances` lists them: id, app, page, origin, how each connected, and
  whether it is connected or reloading.
- Every tool takes `instance`: an id, or its first 8 characters. While a
  single instance is connected, leave it out.
- Several connected and no `instance` → the error lists them.
- A tab that reloads stays known for 30 s; a tool called meanwhile answers
  "reloading — retry".

## The relay

One relay serves every app and tab of the user. It outlives whoever started
it: restarting the dev server, or ending an agent session, leaves it serving
the others. Started in the background, it stops after 30 minutes with no tab
connected and no MCP call.

It listens on the first free port of **47761–47765**, on `127.0.0.1` only.
That one port carries:

- app tabs, over WebSocket;
- `GET /identity`: who answers there;
- `POST /mcp`: the agents' endpoint. It refuses any request carrying an
  `Origin` header, so no web page can drive it.

**`~/.qdadm_relay.run`** tells everyone where it is (override the path with
`QDADM_RELAY_RUN`):

```json
{ "pid": 189379, "port": 47761, "token": "…", "startedAt": 1789103000791,
  "cwd": "/path/where/it/started", "log": "/tmp/qdadm-mcp-relay.log" }
```

It is written once the relay listens and removed when it stops. Mode 0600:
the token is what lets a dev page connect without a code. A stale file (dead
process, or its port answering for something else) is ignored, and a new
relay is started. A lock keeps a single relay even when the dev server and
an agent start one at the same time.

To run it in a terminal and watch it: `npx qdadm-mcp-relay`.

| Flag | |
|---|---|
| `--stdio` | Be the agent's MCP server, attached to the machine relay |
| `--read-only` | Leave out the tools that change data or act in the page |
| `--origin <origin>` | Only pages from this origin may pair (repeatable) |
| `--port <p>` | A private relay on that port: no run file, not shared |
| `--token <t>` | A fixed page token instead of a random one |
| `--background` | How the plugin and the agent start it: idle stop after 30 minutes |

## The MCP tab

With the connector installed, the debug bar gets an **MCP** tab. The tab's
instance id sits at the top — click it to copy it, and give it to your agent
when several tabs are open. Three sub-tabs:

- **Status**: how this tab reaches the relay (connected, offline, or Pair).
- **Chat**: the agent writes with `chat_send`; what you type, it reads with
  `chat_read`.
- **History**: every MCP request this tab served — tool, detail, success or
  error, duration.

Chat and history are kept for the browser tab, across reloads. The tab icon,
**Chat** and **History** count what the agent said and did since that sub-tab
was last on screen; **Status** shows a dot while the relay is offline,
something failed, or a code waits.

**Status** also offers **Allow real screenshots**. Agent screenshots are
rendered from the page's DOM by default. Once you share the tab there, they
are the real pixels, until **Stop sharing**.

## Hear the chat: a Stop hook

An agent only sees what you type in the MCP tab's chat when it calls
`chat_read`. For agents with hooks, a Stop hook closes that gap: when the
agent is about to stop and someone wrote in a tab's chat without an answer,
the hook keeps it going, with the message.

Claude Code, in `.claude/settings.json` (or `~/.claude/settings.json`):

```json
{
  "hooks": {
    "Stop": [
      { "hooks": [{ "type": "command", "command": "npx qdadm-mcp-relay --chat-hook stop", "timeout": 10 }] }
    ]
  }
}
```

- Each message stops the agent once; `chat_read` still returns it.
- No relay, no tab, nothing new: the hook prints nothing, and the agent stops
  as usual.
- Agent sessions share the relay: the first to stop gets the message.

## Outside dev: pairing

A tab not served by the dev server — a static build, `vite preview`, GitHub
Pages — has no token. Pair it from the debug bar:

1. Make sure a relay runs: the agent's `--stdio` server starts one.
2. Open the **MCP** tab of the debug bar and click **Pair**. It shows a code
   such as `958 975`.
3. Give the code to your agent; it calls `pair_accept`.

The code is shown in the tab only, never to the agent: an agent cannot pair a
tab you did not point at, and a process posing as a relay would show a code
your relay never issued. A paired tab re-pairs on reload. **Unpair** forgets
it on both sides.

**Public https origins.** Chrome holds connections to `localhost` until the
user allows local network access for the site. Until then nothing reaches
the relay, and the MCP tab says so: allow it in the prompt by the address
bar, then click **Pair** again.

**No debug bar?** Drive the controller from the console:
`window.__qdadmRelay.pair()`, `.state`, `.unpair()`.

The `#qdadm-relay=ws://localhost:<port>/<token>` URL fragment, printed when
the relay runs in a terminal, connects a tab directly, with no code.

## The dev-server endpoint

`qdadmMcpPlugin()` also serves an MCP endpoint on the dev server itself,
targeting that server's tabs, over Streamable HTTP:
`http://localhost:5174/__qdadm/mcp` (adjust the port).

It lives and dies with the dev server. A client that starts while the dev
server is down may give up on it: Claude Code, for one, marks it failed
until `/mcp` › Reconnect. The relay has no such window.

Options: `qdadmMcpPlugin({ readOnly: true })` leaves out the tools that change data or act in the page;
`relay: false` neither starts the relay nor connects the pages to it. The
plugin is dev-only by construction (`apply: 'serve'`): none of it exists in
a production build.

## Tools

Every response carries a session stamp. On the relay, `navigate`,
`bridge_call` and the entity writes also carry a **`feedback`** block: what
happened in the tab while the call ran.

```json
{ "ms": 412,
  "route": { "from": "/books", "to": "/books/7/edit", "name": "book-edit" },
  "i18nMissing": [{ "key": "books.fields.isbn", "locale": "en" }],
  "errors": ["…console.error text…"],
  "toasts": [{ "severity": "success", "summary": "Saved" }],
  "apiErrors": [{ "status": 422, "message": "…", "url": "…" }],
  "signals": ["stack:change", "i18n:missing", "entity:books:updated"] }
```

Only what happened is listed: an empty category is left out.

| Tool | What it answers |
|---|---|
| `instances` | Which tabs you can target |
| `navigate` | Relay: open a path or a route like a user, wait for the page to settle, get route, title, breadcrumb and feedback |
| `wait_for` | Relay: wait for a route or a signal, with a timeout that says where the tab is |
| `page_snapshot` | Relay: what the user sees, as an accessibility tree — role, name, states, value and a **ref** per element; `filter: "interactive"`, or one part by `ref` |
| `find` | Relay: elements by role and/or text, with their ref and where they sit (row, dialog, form) |
| `page_text` | Relay: the visible text of the tab, or of one element |
| `click` / `type_text` / `press_key` | Relay: act on a ref like a user — real event order, focus, browser defaults (Enter submits, Tab moves focus); refused on a disabled or covered element, unless `force: true`, and the answer then lists what was skipped |
| `fill` | Relay: set any field — text, checkbox, select, PrimeVue dropdown, autocomplete, date |
| `hover` / `scroll` / `drag` / `upload_file` | Relay: the rest of what a pointer does |
| `console_messages` / `network_requests` | Relay: the tab's console, and its fetch / XMLHttpRequest calls with status |
| `page_eval` | Relay: run JavaScript in the tab; elements come back with a ref |
| `screenshot` | Relay: an image of the viewport, one element or the whole page — rendered from the DOM, or the real pixels once the user allowed it in the MCP tab |
| `session_info` | Which app/instance am I talking to? (zombie-tab detector) |
| `boot_errors` | What broke — **including before the app booted** |
| `routes` | Route names/paths/meta |
| `entity_state` | Entities, idField, field schema, current-user permissions, storage key |
| `entity_list` / `entity_get` | Read through the EntityManager (permissions + cache apply) |
| `entity_create` / `entity_update` / `entity_delete` | Act like the UI would (disabled by `readOnly`) |
| `storage_dump` | RAW localStorage view — diff against `entity_list` to catch seed/cache bugs |
| `recent_signals` | Last signal names on the bus |
| `describe` / `bridge_call` | Collector discovery + escape hatch |
| `chat_send` / `chat_read` | Relay only: talk with whoever looks at the tab, in its MCP tab's chat |
| `pair_accept` | Relay only: complete a pairing with the code the user reads out |

## Agent playbook

Typical debugging moves, grounded in real sessions:

- **Start with `instances`, then `session_info`** — which tabs are there,
  and which app, route and age the one you drive has. A stale `ageMs` means
  a zombie tab: have the page reloaded.
- **"Several instances are connected"** → pick one from the list and pass
  `instance`.
- **No instance at all** → the app is not running under its dev server, or
  the tab is not paired: ask the user to open the **MCP** tab of the debug
  bar, click **Pair**, and read you the code, then `pair_accept`. Never
  guess a code.
- **Drive the app** → `navigate`, then read its `feedback`: a missing i18n
  key, a console error or a failed API call on the way shows up right there.
  `wait_for` when something happens later (a save, a redirect).
- **What does the page show?** → `page_snapshot`: the tree the user sees,
  with a ref on every element. `filter: "interactive"` for just the
  controls, `find` to locate one ("the Save button", "the row of Dune"),
  `page_text` for the prose.
- **Act like the user** → refs from `page_snapshot` or `find`, then `click`,
  `fill`, `type_text`, `press_key`. Each returns the dialog it opened or
  closed (with its ref), what has focus, and the feedback block; a refusal
  names the reason (disabled, covered by a dialog). Re-snapshot after a
  re-render: old refs fail on purpose. The tab may stay in the background.
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

Error messages are actionable on purpose: several instances → the list; tab
reloading → retry; nothing connected → how to connect; unknown entity → the
registered names.

## Scope & security

The MCP acts **within the browser session of whoever has the tab open** —
manager permissions apply; it can do what that user can do, nothing more.

- The relay listens on `127.0.0.1` only, and its MCP endpoint refuses web
  pages.
- A tab is served only once it presents the page token — which only the dev
  server hands out, to its own pages, read from a 0600 file — or once paired
  with a code a human carried from the tab to the agent.
- `--origin` narrows who may pair; `readOnly` leaves out the entity writes,
  the page actions and `page_eval`.

Full documentation: [DEBUG.md](https://github.com/quazardous/qdadm/blob/main/docs/DEBUG.md)

## License

MIT
