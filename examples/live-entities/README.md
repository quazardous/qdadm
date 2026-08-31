# Live entities — reference implementation

A backend mutates data on its own and pushes a one-line fact over SSE; a list
page that is **already open** updates itself. Nothing in the page subscribes to
anything.

```sh
npm run live        # from the repo root
```

Then open <http://localhost:5177> and watch the rows change without touching
anything. The backend mutates a run every 3 seconds.

**Dev-only.** This example is not deployed to GitHub Pages, unlike
`hello-world` and `tutorial-mini-admin`: it needs a running backend, so a
static build would show a table that never moves.

## What to read, in order

| File | What it shows |
|---|---|
| [`server.mjs`](server.mjs) | **The other side of the contract.** Node stdlib only — nothing qdadm-specific. Implement the same three endpoints in any language. |
| [`main.js`](main.js) | The declaration (`sse.entities`), the per-entity policy, and the async ticket fetch. |
| [`RunList.vue`](RunList.vue) | Notable for what it does *not* contain. |

## The frame contract

```
event: entity:updated                      (or entity:created / entity:deleted)
data: {"entity": "runs", "id": 3}          id optional
```

The frame carries a **fact**, never an instruction. There is no `refresh: true`,
no `strategy`, no priority — the backend does not know what the front is
showing and must not drive it. The front decides what a change implies.

It also carries **no row data**. Sending the new record would look helpful and
would be a mistake: the front would then be trusting data that bypassed its own
permission filters. It asks again instead, through the same read path as
everything else.

## Why a ticket rather than the session token

`EventSource` cannot send headers, so the SSE credential travels in the query
string — and query strings land in access logs, browser history and `Referer`
headers, all of which outlive the session by months.

So `/ticket` issues a credential that is worthless once used: 30 seconds, one
connection. The front fetches one before each connect, which is why
`sse.getToken` accepts a promise.

If your deployment authenticates the stream some other way — a cookie with
`withCredentials`, or a gateway that injects identity — omit `getToken` and
qdadm falls back to the session token. Just know what you are writing to the
logs before you do.

## Wiring your own backend

1. Serve the entity data however you already do.
2. Emit `entity:{created,updated,deleted}` frames with `{"entity": "<name>"}`
   and an optional `id`, on every mutation the browser did not cause.
3. Declare those entity names in the kernel's `sse.entities`.

That is the whole integration. Anything not declared is ignored, so a stream
already carrying progress or telemetry needs no changes.

## Background

[`docs/adr/0009-live-entities.md`](../../docs/adr/0009-live-entities.md) — the
design decision, including the arguments against it and the boundaries that
keep it honest.
