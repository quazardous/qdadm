# 0004 — qdcore / qddebug as extractible satellites

**Status:** Accepted (backfilled 2026-08-20)

## Context

Parts of qdadm are not admin-specific. The signal bus, hook registry,
navigation stack and SSE bridge are generic application primitives; the debug
bridge, its collectors and the debug bar are a debugging product in their own
right. A sibling project (qdcms) needed the same primitives and the same debug
bar without taking on an entity/CRUD framework.

The choice was to keep everything in one package and let qdcms depend on the
whole framework, or to carve the generic parts out.

## Decision

Two satellite packages, published from this monorepo and consumed by qdadm as
ordinary npm dependencies:

- **`@quazardous/qdcore`** — framework-agnostic primitives: signals, hooks,
  navigation stack, SSE bridge. Explicitly no Vue, no router, no CRUD.
- **`@quazardous/qddebug`** — `DebugBridge`, collectors, debug bar.

They are **extractible**: nothing in them imports qdadm, so either can be moved
to its own repository without a breaking change for consumers. The dependency
arrow only ever points qdadm → satellite.

Versions move in lockstep with qdadm through Changesets, which re-pins internal
dependency ranges on every bump.

## Consequences

- qdcms consumes the primitives and the debug bar without pulling in the admin
  framework.
- The extraction cost is already paid. Moving a satellite out later is a repo
  operation, not a refactor.
- The boundary needs defending: the natural pull is to reach for a qdadm type
  from inside a satellite, which would silently make it non-extractible.
- Three packages means three release trains and three changelogs. Changesets'
  internal-dependency re-pinning is what keeps them consistent — hand-editing a
  version range is how a consumer ends up on a fossilised transitive.
- qdadm re-exports satellite symbols (`SSEBridge` and friends) from its own
  entry points, so consumers see one surface and the split stays an
  implementation detail.
