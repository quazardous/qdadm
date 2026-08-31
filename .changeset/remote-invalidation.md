---
"@quazardous/qdadm": minor
---

Remote changes now invalidate the list cache (#1888 lot B, reported in #1887). `entity:data-invalidate` carries a `source` marker, and an `EntityManager` receiving `source: 'remote'` for its own entity drops its list cache. Until now no subscriber cleared it: the parent-entity handler only fires for an entity's *parents*, and the own-entity handler is gated on asymmetric mode and only touched the detail cache — so an ordinary entity received nothing, and an app emitting the canonical signal kept serving a stale list while believing it had invalidated everything. Local mutations emit `source: 'local'` and are ignored by that handler, since the manager that mutated has already repaired its own cache: writes cost no extra refetch.
