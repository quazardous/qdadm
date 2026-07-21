# AGENTS.md

> Entry point for AI agents working on or against a qdadm app.

qdadm exposes a self-describing **debug bridge** — every running app in dev mode
publishes a JSON manifest of its collectors plus a live snapshot, and accepts
remote actions. An agent can introspect the app without touching the source.

## Where to start

1. **Codebase navigation** for source-code questions: see [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md).
2. **Live introspection** of a running app: hook up the [MCP server](#mcp--one-connection-recommended) (recommended), or use the raw `/__qdadm/*` endpoints described below.
3. **Architecture & conventions**: [`docs/QDADM_CREDO.md`](docs/QDADM_CREDO.md), [`docs/DEBUG.md`](docs/DEBUG.md) (runtime debug bridge), [`docs/architecture.md`](docs/architecture.md).
4. **i18n surface**: [`docs/i18n.md`](docs/i18n.md) — keys, fallbacks, providers.

## "I want to build a page" — quick routing

| Need | Go to |
|---|---|
| Pick the right page composition (list / form / show / parent+child hybrids) | [`docs/page-compositions.md`](docs/page-compositions.md) |
| Build a CRUD page (list / form / show / child) | [`docs/crud.md`](docs/crud.md) |
| Render & edit fields — the form façade (`FormInput`), field widgets (`LookupField`, `KeyValueEditor`, `Scope`/`PermissionEditor`, JSON editors, structured/raw JSON dual), non-entity forms (`useBareForm`) | [`docs/forms.md`](docs/forms.md) |
| Extensibility (hooks / signals / zones / decorators) | [`docs/extension.md`](docs/extension.md) |
| Full source-code index | [`docs/AGENT_GUIDE.md`](docs/AGENT_GUIDE.md) |

## MCP — one connection (recommended)

[`@quazardous/qdadm-mcp`](packages/qdadm-mcp) fronts the debug bridge as an
MCP server with a curated 13-tool arsenal (`session_info`, `boot_errors`,
`entity_*`, `storage_dump`, …) and actionable errors — no curl plumbing:

```bash
npm install -D @quazardous/qdadm-mcp
# vite.config: plugins [vue(), qdadmVitePlugin(), qdadmDebugPlugin(), qdadmMcpPlugin()]
claude mcp add --transport http qdadm http://localhost:5174/__qdadm/mcp
```

Static site / no dev server? The same package ships `npx qdadm-mcp-relay`
(the page dials out, token pairing). Full setup guide + agent playbook:
[`packages/qdadm-mcp/README.md`](packages/qdadm-mcp/README.md).

The raw surfaces below remain available and are what the MCP is built on.

## Live debug bridge — `/__qdadm/*` (dev only)

The Vite plugin `qdadm/vite-plugin-debug` exposes the running app's
`DebugBridge` over HTTP. Wire it in your `vite.config.js`:

```js
import { qdadmDebugPlugin } from '@quazardous/qdadm/vite-plugin-debug'
export default defineConfig({ plugins: [vue(), qdadmDebugPlugin()] })
```

The endpoints (default prefix `/__qdadm`) are JSON, no auth, dev-only:

| Endpoint | What it returns |
|---|---|
| `GET /__qdadm/` | Index of endpoints. |
| `GET /__qdadm/describe.json` | Manifest of every collector — entry shapes, available actions. |
| `GET /__qdadm/snapshot.json` | Live JSON snapshot of every collector. |
| `POST /__qdadm/call` | Invoke an action — body `{collector, action, args?}`. |

The browser-side bridge **pushes** describe + snapshot over the Vite HMR
WebSocket on every change, so the plugin caches them in memory. Once you've
opened the app in a browser at least once during the dev session, GETs are
served from cache without round-tripping the page — works as a true HTTP API.

GET responses include a `X-Qdadm-Stale-Ms` header (age of the cached payload)
and `X-Qdadm-Source: cache|live` so consumers know what they got.

`POST /__qdadm/call` always round-trips the live page (it mutates state) and
times out after 3 s if no client is connected.

### Quick recipes

```bash
# What can I see?
curl -s http://localhost:5174/__qdadm/describe.json | jq '.collectors | keys'

# What's the current state?
curl -s http://localhost:5174/__qdadm/snapshot.json | jq '.collectors.i18n.state'

# Resolve an i18n key
curl -s -X POST http://localhost:5174/__qdadm/call \
  -H 'content-type: application/json' \
  -d '{"collector":"i18n","action":"translate","args":{"key":"core.actions.update"}}'

# List registered entities
curl -s http://localhost:5174/__qdadm/snapshot.json \
  | jq '.collectors.entities.state.registered'

# Force-refresh an entity cache
curl -s -X POST http://localhost:5174/__qdadm/call \
  -H 'content-type: application/json' \
  -d '{"collector":"entities","action":"refreshCache","args":{"entity":"books","reload":true}}'
```

## Built-in collectors

Every collector exposes the universal verbs `clear`, `markSeen`, `getEntries`
plus its own actions. Run `describe.json` for the authoritative list.

| Collector | Records / State | Notable actions |
|---|---|---|
| `errors` | records | (universal only) |
| `signals` | records | `getByDomain`, `getByPattern`, `emit` |
| `toasts` | records | `getBySeverity` |
| `zones` | state | `highlight`, `setShowCurrentPageOnly`, `setShowInternalZones` |
| `auth` | state + event log | (universal only) |
| `entities` | state | `refreshCache`, `invalidateCache`, `testFetch`, `testStorageFetch` |
| `router` | records + state | `navigate`, `getCurrentRoute`, `getRoutes`, `getBreadcrumb` |
| `i18n` | records + state | `resolve`, `translate`, `dumpBundle`, `changeLocale`, `asJsonSkeleton`, `byNamespace`, `getLocaleHistory` |

## Browser console (parallel surface)

Same data, same shape, accessible without HTTP from devtools:

```js
window.__qdadm.debug.describe()                       // → BridgeManifest
window.__qdadm.debug.dump()                           // → BridgeSnapshot
await window.__qdadm.debug.call('i18n','translate',{key:'core.actions.update'})
```

`window.__qdadm` also exposes `kernel`, `orchestrator`, `signals`, `hooks`,
`zones`, `router`, `i18n`, `get(name)`, `managers()` for ad-hoc inspection.

## Adding a custom collector

Subclass `Collector` from `qdadm/modules/debug` and override `describe()`,
`snapshot()`, and `call()` for any custom actions. The bridge picks it up
automatically and your collector becomes visible to agents through the same
endpoints.

```ts
import { Collector } from '@quazardous/qdadm/modules/debug'
class MyCollector extends Collector {
  static collectorName = 'mything'
  override describe() {
    return {
      name: this.name,
      records: true,
      summary: 'What this collector tracks.',
      entryShape: { foo: 'string', bar: 'number' },
      actions: [
        ...this._builtinActionManifests(),
        { name: 'doIt', summary: 'Trigger the thing.', mutates: true },
      ],
    }
  }
  override async call(name, args) {
    if (name === 'doIt') return { ok: true }
    return super.call(name, args)
  }
}
```

## Constraints for agents

- Endpoints are **dev-only** — they are never registered in production builds.
- Mutating actions (`mutates: true` in the manifest) change live app state. Treat them like POSTs against a real backend.
- The bridge serializes via `JSON.stringify`; non-serializable values from collectors are surfaced as `[Object]` placeholders by `SignalCollector`'s sanitizer.
- The bridge timeout is 5 s by default. Long-running actions should resolve fast or use signals.
