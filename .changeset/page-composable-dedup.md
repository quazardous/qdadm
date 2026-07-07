---
"@quazardous/qdadm": patch
---

Dedup the page/composable copy-paste clusters (#1193, KPI-6). New shared units: `CardShell` (conditional Card wrapper — ShowPage and FormPage no longer duplicate their entire content body per branch), `useActionRegistry<A, Ctx, R>` (the map + ordered add/remove/resolve skeleton behind the list/form/show action registries; per-page resolution stays local), `createOrchestratorToast()` (was verbatim ×3), `runFieldValidators` (required → type → custom pipeline shared by validateField/validate), `formatFetchError` (utils). `useListPage`/`useEntityItemPage` now use the canonical `useOrchestrator()` injection (same error message). Also: `editRouteSuffix` option is now honored in the create→edit redirect, small dead code removed. Pure refactor, zero behavior change.
