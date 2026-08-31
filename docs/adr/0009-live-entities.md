# 0009 — Live entities: the app declares which entities the backend mutates out of session

**Status:** Accepted (2026-08-31) — written before implementation, to test
whether the feature belongs in qdadm at all; accepted and shipped the same day.
The Consequences below were the test, and they are now obligations.

## Context

qdadm already carries server events: `SSEBridge` holds an `EventSource`,
reconnects, and republishes every frame on the `SignalBus` under `sse:{event}`.
What is missing is everything after that — nothing connects a received frame to
the invalidation of the relevant `EntityManager`, and nothing refreshes an
already-mounted screen.

A consumer (BookShepherd, #1887) filled the gap downstream: roughly 170 lines
plus one call per screen. Their claim is that none of it is specific to their
application.

The question this ADR settles is not *how* to do it, but **whether it is
qdadm's job**.

### For

- **The page pays today.** With no mechanism, every screen has to write
  `useEntityRefresh('runs', () => list.loadItems({}, { force: true }))`. That is
  logic in the presentation layer — exactly what [ADR 0001](0001-pac-not-mvc.md)
  forbids. The current gap actively *pushes* consumers into violating the
  architecture.
- **The cache already belongs to the framework.** `invalidateCache()`,
  `invalidateDetailCache()` and `entity:data-invalidate` exist and are internal
  to `EntityManager` ([ADR 0002](0002-entitymanager-centric-domain.md)). Making
  the application drive them from outside asks it to know an implementation
  detail hidden from it everywhere else.
- **The gap is a design blind spot, not an oversight.** The invalidation signals
  were written for *local* mutations, where the manager that mutates repairs its
  own cache. A mutation coming from elsewhere repairs nothing. The asymmetry is
  structural.

### Against

- Every added feature is surface to maintain one-against-one (the bus-factor
  finding, and [ADR 0004](0004-extractible-satellites.md)).
- A screen that reloads on its own is behaviour to debug, and the reports will
  land on qdadm rather than on the application.
- The need comes from **one** consumer. One case is not a generality.

## Decision (proposed)

qdadm owns the path from external mutation to up-to-date screen,
**declaratively**:

```js
sse: {
  url: '/events',
  entities: ['runs', 'jobs'],   // or true / '*'
}
```

The application declares **which entities have an external writer**. It wires
nothing by default: the framework routes, invalidates, and refreshes the mounted
screens of those entities.

Note who declares: the **app**, not the backend. The backend knows nothing about
this configuration — it only emits. The declaration is the front stating what it
knows about the backend serving it.

Six design points are fixed here:

1. **Two separate things, two separate homes.** *That* an entity has an
   external writer is a property of the backend serving it — the same entity is
   live behind a pushing backend and inert behind a `MockApiStorage` in tests —
   so it is declared in the kernel config, not baked into the domain model.
   *What the entity does about it* is behaviour, and belongs to the entity:

   ```js
   new EntityManager({
     name: 'runs',
     live: { refresh: 'mounted', coalesceMs: 300 },   // pre-wired default
   })
   ```

   The front-side entity listens and applies **its own policy**. A default is
   pre-wired so nothing has to be written for the common case, and it stays
   overridable per entity — a heavy `logs` entity may want to invalidate without
   refetching, while `runs` refreshes on sight. One uniform behaviour across
   every declared entity would be the wrong answer for any app with more than a
   handful.
2. **The backend never sets the policy.** It emits facts; the entity decides.
   This is point 3 seen from the other end: were the policy expressed in the
   payload, the backend would be configuring the front.
3. **Scope and origin are two different things.** The declaration says *which*
   entities are concerned; a `source: 'local' | 'remote'` marker on the event
   says *where it came from*. Without the second, a local write on a declared
   entity would trigger a pointless reload.
4. **The event carries a fact, never an instruction.** The backend says "entity
   `runs` changed, id 42". It does not say "reload", "invalidate", or "this is
   urgent". SSE is a feedback channel from back to front; **the refresh
   mechanics stay entirely the front's business** — nothing more, nothing less.
   The payload is therefore closed to front-side directives: no `refresh: true`,
   no `strategy`, no priority. Without that boundary written down, a backend
   that knows nothing of the UI ends up driving it.
5. **The security scope is the front's.** An incoming event says what changed,
   never who may see it. A remote event must never trigger a request the current
   user could not have issued: the refresh goes back through the normal path —
   `canRead()`, `SecurityChecker`, the manager's own filters — and an event for
   an entity the user cannot read is dropped rather than refetched. Skipping
   that check would spray 401/403 for every pushed event and risk tripping
   `auth:expired` over a stream unrelated to the session.
6. **The seam is transport-agnostic.** The concept is "this entity has an
   external writer", not "this entity is wired to SSE". SSE is the first
   transport; the same path must accept a WebSocket, or a `BroadcastChannel`
   between two tabs of the same admin — a real case that needs no server at all
   and that an SSE-shaped design would exclude from the start. This follows from
   point 4: if all the mechanics are front-side, where the fact came from is
   irrelevant.

## Consequences

- Wiring a live backend collapses to one config key. Pages write nothing, which
  restores PAC where the current gap forced consumers to break it.
- **The declaration makes silence diagnosable**: an event received for an
  undeclared entity can raise a dev warning instead of being dropped without a
  trace, and a declared entity that never receives anything becomes a visible
  symptom.
- The framework inherits three problems it must solve once and cannot delegate
  to the application: **coalescing** a burst of events into a single reload,
  **filtering by `id`** so that changing one record does not reload every open
  detail page, and **preserving scroll and selection** — a list reloading under
  the cursor disrupts someone mid-click.
- The reload path becomes a place where a regression is spectacular: get the
  coalescing wrong and a burst turns into a request storm for every consumer
  that declared an entity.
- Declaring nothing costs nothing: no remote events, no behaviour change.
  Inertia stays the default.
- A server contract becomes public (`event: entity:updated`,
  `data: {"entity": "..."}`, optional `id`) and therefore has to be honoured
  over time.
- What the stream discloses stays the backend's call, and the front does not
  compensate for it: pushing `entity: payroll` to every connected client leaks
  that the entity exists, even to users who cannot read it. The front ignores
  such an event (point 5); it cannot un-send it.
- A per-entity policy is one more thing to document and to get wrong. The
  mitigation is that the default has to be right often enough that most apps
  never name it.

## The test, and how it came out

The test was: if the Consequences above look disproportionate to the benefit,
do **not** take the feature in — publish a recipe in
[`../signals.md`](../signals.md) instead and let consumers keep writing it
downstream, knowingly.

It came out in favour, on the argument the doc-first pass surfaced and the
original report did not contain: the gap does not merely inconvenience
consumers, it **pushes them into breaking the architecture**, since the only
workaround is a refresh call in every page. Closing it removes logic from the
presentation layer rather than adding a convenience.

Shipped in four increments — async stream token, origin-marked invalidation,
the declaration and its router, and mounted-screen refresh — with
[`../live-entities.md`](../live-entities.md) as the user-facing documentation
and `examples/live-entities/` as the reference implementation.
