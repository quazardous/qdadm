---
"@quazardous/qdadm": patch
---

Fix `query()` returning `{items: [], total: 0}` for any entity whose total exceeds `effectiveThreshold` (#1204). `list()` never filled the cache above the threshold but also never flagged the overflow, so `query()` — which `useListPage` uses — filtered an empty cache instead of hitting the API: **any entity growing past ~100 rows silently rendered an empty list**.

The cache is an optional layer and now behaves like one: `list()` marks the cache `overflowed` when the total exceeds the threshold, the `overflow` getter reflects it, `query()` skips the futile cache-fill and goes straight to the API (server-side pagination), and `invalidateCache()` resets the flag so a shrunk entity can re-cache. Small entities keep the local-cache fast path unchanged.
