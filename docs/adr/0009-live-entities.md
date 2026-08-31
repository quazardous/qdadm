# 0009 — Live entities: the backend declares what it mutates out of session

**Status:** Proposed (2026-08-31) — written BEFORE implementation, to test
whether the feature belongs in qdadm at all. Rejecting it is a legitimate
outcome; this file records the decision either way.

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
nothing: the framework routes, invalidates, and refreshes the mounted screens of
those entities.

Three design points are fixed here:

1. **The declaration lives in the kernel config, not on the `EntityManager`.**
   "Mutated out of session" is a property of the backend serving the entity, not
   of its domain: the same entity is live behind a pushing backend and inert
   behind a `MockApiStorage` in tests. Declaring it on the entity would freeze a
   deployment characteristic into the domain model.
2. **Scope and origin are two different things.** The declaration says *which*
   entities are concerned; a `source: 'local' | 'remote'` marker on the event
   says *where it came from*. Without the second, a local write on a declared
   entity would trigger a pointless reload.
3. **The seam is transport-agnostic.** The concept is "this entity has an
   external writer", not "this entity is wired to SSE". SSE is the first
   transport; the same path must accept a WebSocket, or a `BroadcastChannel`
   between two tabs of the same admin — a real case that needs no server at all
   and that an SSE-shaped design would exclude from the start.

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

## The test to re-run before accepting

If the Consequences above look disproportionate to the benefit, the right call
is **not** to take the feature in, and to publish a recipe in
[`../signals.md`](../signals.md) instead — consumers keep writing it downstream,
knowingly.
