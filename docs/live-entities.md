# Live entities

Data your backend changes on its own — a worker finishing a job, a peer editing
a record, a cron advancing a status — reaching a screen that is already open.

Declare which entities have an external writer, and qdadm invalidates their
caches and refreshes the screens showing them. Pages write nothing.

Working example: [`examples/live-entities/`](../examples/live-entities/) —
`npm run live`.

## Declare

```js
new Kernel({
  sse: {
    url: '/events',
    entities: ['runs', 'jobs'],   // or true / '*' for every entity
  },
})
```

That is the whole integration on the front. The **app** declares what it knows
about the backend serving it; the backend knows nothing of this config and only
emits. Anything not declared is ignored, so a stream already carrying progress
or telemetry needs no changes — and an app that declares nothing behaves
exactly as before.

An event arriving for an undeclared entity logs a one-off warning in debug mode
rather than disappearing, because a silently dropped frame is the hardest kind
of bug to find.

## The backend contract

```
event: entity:updated                      (or entity:created / entity:deleted)
data: {"entity": "runs", "id": 3}          id optional
```

Two rules make this contract work, and both are deliberate:

**The frame carries a fact, never an instruction.** There is no `refresh: true`,
no `strategy`, no priority. The backend does not know what the front is
displaying, and must not drive it — it reports what changed, and the front
decides what that implies.

**The frame carries no row data.** Sending the new record would look helpful and
would be a mistake: the front would be trusting data that bypassed its own
permission filters. It asks again through the normal read path instead.

## `entities` means entities

The declaration names **registered entities**, and the mechanism works by
invalidating their `EntityManager`. A backend usually pushes more than that —
progress, notifications, and screens that have no manager behind them.

A pushed name with no registered manager is dropped, with a one-off dev
warning. That is the correct behaviour, but it is worth knowing *before* you
meet it: a list backed by something you deliberately never modelled as an
entity — an archive view, a read-only child listing — will not refresh, and no
amount of declaring will change that.

If you have such a screen, you have three options, in increasing order of cost:

1. **Subscribe directly** for that one screen. The frames are on the signal bus
   whatever happens, so `signals.on('sse:entity:updated', …)` — or
   [`useSSEBridge`](../packages/qdadm/src/composables/useSSEBridge.ts) — costs a
   few lines and no modelling change.
2. **Register it as an entity** if it genuinely is one and you were only
   avoiding the ceremony. You then get the whole mechanism for free.
3. **Leave it stale** and reload on navigation, which is what happens today.

Option 1 is usually right: the reason the screen has no manager is generally a
good one, and inventing an entity to unlock a refresh trades a real modelling
decision for a mechanical one.

## Per-entity policy

*That* an entity has an external writer is a property of your deployment, so it
is declared on the kernel. *What the entity does about it* is behaviour, so it
lives on the entity:

```js
new EntityManager({
  name: 'logs',
  live: {
    refresh: false,      // drop the stale cache, leave the screen alone
    coalesceMs: 1000,    // collapse a burst into one reload
  },
})
```

| Option | Default | Meaning |
|---|---|---|
| `refresh` | `'mounted'` | A screen showing this entity reloads itself. `false` invalidates only — the screen updates next time it asks. |
| `coalesceMs` | `300` | Window over which a burst collapses into a single reload. `0` reloads on every frame, which is rarely what you want. |

The defaults suit most entities; declare a policy only where they don't. A
heavy list is the usual reason to set `refresh: false`.

## What the framework handles for you

- **Bursts collapse.** A backend replaying fifty rows costs one reload.
- **Detail pages stay scoped.** A screen showing record 42 ignores an event
  about record 7. An event carrying no `id` concerns the whole entity and
  always applies.
- **Selection survives.** A list refreshing under someone mid-bulk-action keeps
  their checkboxes, re-matched by key; rows that vanished server-side drop out.
- **Local writes cost nothing extra.** Your own mutations are marked as such, so
  a write does not trigger a redundant refetch of a list the manager already
  holds correctly.

## Permissions

The refresh runs inside your existing security scope. An event never causes a
request the current user could not have issued: an entity they cannot read is
dropped rather than refetched — otherwise a pushed stream would spray 401/403
and risk tripping `auth:expired`.

What the stream *discloses* remains your backend's call. Pushing
`entity: payroll` to every connected client tells them all that the entity
exists; the front ignores the event, but it cannot un-send it. Scope the stream
per connection.

## Authenticating the stream

`EventSource` cannot send headers, so the credential travels in the query
string — and query strings land in access logs, browser history and `Referer`
headers, all of which outlive the session.

**By default qdadm sends the session auth token** — the same durable
credential your API calls authenticate with. It works, and for an internal
deployment it is a defensible choice; the point is that it should be a choice.
Omitting `getToken` is not neutral, it selects the most sensitive option
available, and the query string it travels in reaches access logs, browser
history and `Referer` headers that outlive the session by months.

When that is not acceptable, serve a short-lived single-use ticket instead:

```js
sse: {
  url: '/events',
  entities: ['runs'],
  getToken: async () => (await api.get('/ticket')).data.ticket,
}
```

`getToken` may return a promise, awaited before each connect, so a fresh ticket
is fetched every time. Pass `null` to send no token at all — for cookie auth
with `withCredentials`, or a gateway that injects identity.

A configuration key qdadm does not recognise raises a dev-mode warning naming
what happens *instead* — `sse.getToken` on a version that predates it is
ignored, and the session token goes out in its place. "Ignored" reads as "no
effect"; here it means "falls back to a more sensitive secret", which is why
the warning says so.

### A single-use ticket disables the browser's own reconnect

`EventSource` reconnects by itself, replaying **the same URL** — and therefore
the same token. If your ticket is single-use, that native retry can never
succeed: the server is right to refuse a burned credential.

It is not a failure mode you will see. The browser's attempt fails silently,
qdadm's `onerror` handler picks it up, and the bridge reconnects on its own
timer with a fresh ticket. What you lose is the seamless recovery: every
transient drop becomes a `reconnectDelay`-long gap instead of an invisible
reconnect.

Nothing to fix if that trade is acceptable — a few seconds of gap for a
credential that cannot be replayed is usually the right side of it. Just know
which one you chose: shorten `reconnectDelay` if the gap matters, or issue a
ticket that survives one retry if the gap matters more than the replay window.

## Other transports

The mechanics are front-side, so where a fact came from does not matter. SSE is
the transport that ships; `LiveEntityRouter.notify(entity, action, id)` is the
plain entry point, and a WebSocket or a `BroadcastChannel` between two tabs of
the same admin attaches to it the same way.

## Background

[ADR 0009](adr/0009-live-entities.md) — why the feature belongs in qdadm, the
arguments against it, and the boundaries above stated as decisions.
