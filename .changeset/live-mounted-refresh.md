---
"@quazardous/qdadm": minor
---

A screen showing a live entity now follows changes made outside the session (#1888 lot D, reported in #1887). Invalidating marks a cache stale but repaints nothing, so a list already on screen kept its rows until the user navigated away and back — precisely the case a pushing backend exists for. `useListPage` and `useEntityItemShowPage` now reload themselves, with no page-level opt-in to forget: the gate is upstream, since only an entity declared in `sse.entities` ever produces a remote event. Each entity carries its own policy, pre-wired and overridable — `live: { refresh: 'mounted' | false, coalesceMs: 300 }` on the `EntityManager`, so a heavy `logs` list can drop its stale cache without refetching while `runs` refreshes on sight. A burst of events collapses into one reload; a detail page only reacts to its own record; and a list refreshing under someone mid-bulk-action keeps their selection, re-matched by key.
