---
"@quazardous/qdadm": patch
---

Local sort (cache path used by `useListPage`/`query()`) now places `null` values **last in both directions** (#1221). The previous direction-aware placement put nulls first on `desc` — a "Last Seen desc" list showed the never-seen rows on top. Aligns with the storage adapters' shared comparator. Note for lazy/server-paginated lists: the network request skybot captured (`limit=100`, no sort) is the #1204 cache-fill, which legitimately fetches everything unsorted — ordering happens in this local sort; `loadItems` does send `sort_by`/`sort_order` on real server-side fetches.
