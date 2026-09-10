# @quazardous/qdadm-mcp

**MCP server for qdadm apps — an agent debugs your live app in one connection.**

Two setups, same tools:

- **Relay (recommended)** — the agent spawns a small relay, and you pair ONE
  browser tab with it from the debug bar. Works on the dev server and on any
  static hosting, and survives app restarts.
- **Dev server** — a Vite plugin serves the MCP on the dev server itself.
  One line, but the MCP server lives and dies with the dev server.

```bash
npm install -D @quazardous/qdadm-mcp
```

## Setup A — the relay (recommended)

**1. Wire the connector** — FIRST import of your entry (that is what
enables pre-boot error capture):

```ts
// main.ts — first import
import { installQdadmRelayConnector } from '@quazardous/qdadm-mcp/connector'
installQdadmRelayConnector()
```

It exposes the pairing controller the debug bar drives, and nothing else: a
tab that never pairs opens no socket and wraps nothing. Safe to ship.

**2. Let the agent spawn the relay** (Node ≥ 22.18, no build step):

```bash
claude mcp add qdadm -- npx qdadm-mcp-relay --stdio
```

The relay lives exactly as long as the agent session. Restarting the app does
not touch it.

**3. Pair a tab.** In the app's debug bar, click **MCP**. The button shows a
code — `958 975`. Give the code to your agent; it calls `pair_accept`. The
button turns active, and every tool now targets that tab.

After that:

| When | What happens |
|---|---|
| The tab reloads, or the app restarts | The tab re-pairs on load, same instance, before the app runs — boot capture still sees a crash. A tool called meanwhile answers "reloading — retry". |
| Another tab is paired | It replaces this one: one paired tab at a time. This tab's button says so. |
| The relay restarts (new agent session) | The new relay does not know the pairing; the button says so. Pair again. |
| You click the active button | Unpaired on both sides. |

**Why a code.** The relay shows it in the tab only — `pairing_status` lists
waiting tabs without their codes. The agent cannot pair a tab you did not
point at, and a local process posing as a relay would show a code your
agent's relay never issued.

### Flags

| Flag | Default | |
|---|---|---|
| `--stdio` | off | MCP over stdio — the agent spawns the relay |
| `--port` | first free of 47761–47765 | WebSocket listener the tab connects to |
| `--origin` | any | Only pages from this origin may pair (repeatable) |
| `--mcp-port` | 7778 | Streamable HTTP endpoint (`/mcp`), without `--stdio` |
| `--token` | random | Token of the URL fragment flow |
| `--read-only` | off | Drop the three write tools |

The **MCP** button scans 47761–47765, and the relay skips any of them already
in use. A relay pinned elsewhere with `--port` needs the app to scan it:
`installQdadmRelayConnector({ ports: [<port>] })`. Both listeners bind to
`127.0.0.1`.

**Public https origins** (GitHub Pages, any hosted site). Chrome holds
connections to `localhost` until the user allows local network access for the
site, and nothing reaches the relay meanwhile. The button says the browser is
holding the connection: allow it in the prompt by the address bar, then click
again. Pages served from `http://localhost` get no prompt.

**No debug bar?** Drive the controller from the console:
`window.__qdadmRelay.pair()`, `.state`, `.unpair()`.

### Over HTTP instead of stdio

```bash
npx qdadm-mcp-relay
claude mcp add --transport http qdadm-relay http://localhost:7778/mcp
```

The relay must then be running before the agent session starts — see the
restart caveat in Setup B, which applies to any HTTP MCP server.

### URL fragment

The startup log prints `#qdadm-relay=ws://localhost:<port>/<token>`. Opening
the site with it connects that tab directly, with no code. The fragment is
read at load only.

## Setup B — dev server

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

**Restarts.** The endpoint lives inside vite. Restarting vite mid-session is
survivable: calls fail while it is down and work again once it is back. But
an agent session that STARTS while the dev server is down marks the server
failed and never retries it — run `/mcp` › Reconnect. Setup A has no such
window.

Each tab keeps its session id across reloads, so `session: <id>` stays valid
through F5; tools default to the most recently active connected tab.

## Tools

Curated debugging arsenal. Every response carries a session stamp; `session`
defaults to the paired tab (relay) or the most recently active tab (dev
server).

| Tool | What it answers |
|---|---|
| `session_info` | Which app/session am I talking to? (zombie-tab detector; pairing state on the relay) |
| `boot_errors` | What broke — **including before the app booted** |
| `routes` | Route names/paths/meta |
| `entity_state` | Entities, idField, field schema, current-user permissions, storage key |
| `entity_list` / `entity_get` | Read through the EntityManager (permissions + cache apply) |
| `entity_create` / `entity_update` / `entity_delete` | Act like the UI would (disabled by `readOnly`) |
| `storage_dump` | RAW localStorage view — diff against `entity_list` to catch seed/cache bugs |
| `recent_signals` | Last signal names on the bus |
| `describe` / `bridge_call` | Collector discovery + escape hatch |
| `pairing_status` / `pair_accept` | Relay only: which tab is paired or waiting; complete a pairing with the code the user reads out |

## Agent playbook

Typical debugging moves, grounded in real sessions:

- **Always start with `session_info`** — it tells you which tab you're
  driving (app name/version, current route, session age). A stale
  `ageMs` means you're talking to a zombie tab: have the page reloaded.
- **Relay says no tab is paired** → ask the user to click **MCP** in the
  debug bar and read you the code, then `pair_accept`. Never guess a code.
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

Error messages are actionable on purpose: nothing paired → how to pair;
tab reloading → retry; unknown entity → the list of registered names.

## Scope & security

The MCP acts **within the browser session of whoever has the tab open** —
manager permissions apply; it can do what that user can do, nothing more.

- Dev plugin: the endpoint exists only on the dev server.
- Relay: listens on `127.0.0.1` only. A tab is served only once paired —
  by a code the human carries from the tab to the agent, bound to the tab's
  origin — or when opened with the token fragment. `--origin` narrows who
  may pair.
- `readOnly` drops the write tools on either setup.

Full documentation: [DEBUG.md](https://github.com/quazardous/qdadm/blob/main/docs/DEBUG.md)

## License

MIT
