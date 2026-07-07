---
"@quazardous/qdadm": patch
---

Fix sort toggling on lists (#1222) — four stacked defects made inverting a sort a visual no-op:

1. **Ghost loading mask**: near-synchronous loads (cache/local storage, fast APIs) flipped `loading` true→false within one frame, interrupting the PrimeVue overlay-mask transition — the invisible mask stayed in the DOM and swallowed every subsequent header click. The loading indicator is now **delayed 150 ms** (no spinner flash on fast loads, unchanged on slow ones).
2. **removableSort's "sort removed" state** (PrimeVue cycles asc → desc → removed) reached the composable as `sortField: ''` / `sortOrder: 1`, loading unsorted; on the cache path this re-served the cache in whatever order the previous sort left it — identical rows. Removed-state now **falls back to the list's `defaultSort`**, and the null mapping is honest end-to-end.
3. **Cache mutation**: the local sort reordered `cache.items` in place, so later unsorted reads returned the last sort's order. The sort now copies first.
4. Session sort entries with an empty field (artifact of 2) are rejected on read.

Also fixes the demo countries storage silently ignoring `sort_by`/`sort_order` (inherited from the dead REST Countries contract), and actually exports the KPI-5 `clientFilter` helpers (`sortItems`/`filterItems`/`searchItems`/`paginate`/`defaultGenerateId`) — the 2.3.1 changeset promised them but the barrel entry was missing.
