---
"@quazardous/qdadm": patch
---

Split `useListPage.ts` (#1195, KPI-8): the two self-contained subsystems are extracted into composables it composes back in — `useListFilters` (filter state, the three option-source modes optionsEntity/optionsEndpoint/optionsFromCache, session persistence, URL sync, registry auto-load) and `useListAlterHooks` (`list:alter`/`filter:alter` wiring). Pure mechanical extraction: the public surface is unchanged and the existing useListPage tests pass untouched; the file drops from 1557 to ~1200 lines and both subsystems now have focused unit tests. `QueryOrchestratorLike` is now exported from FilterQuery.
