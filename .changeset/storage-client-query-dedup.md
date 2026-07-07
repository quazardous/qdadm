---
"@quazardous/qdadm": patch
---

Dedup the client-side list pipeline across storage adapters (#1192, KPI-5). The byte-identical sort/search/paginate blocks in MemoryStorage, LocalStorage, MockApiStorage and SdkStorage now live in one shared `query/clientFilter.ts` (`sortItems` / `filterItems` / `searchItems` / `paginate` / `defaultGenerateId` — new public exports). Filtering keeps its historical per-adapter semantics via an explicit `stringMatch` mode (`includes` for Memory/Sdk, `exact` for Local); MockApiStorage keeps delegating operator filters to QueryExecutor. `StorageError` moved to `storage/errors.ts` (still re-exported from MemoryStorage and the storage barrel — no import breaks). The triplicated `generateId` default loses its deprecated `String.substr`. Pure behavior-preserving refactor.
