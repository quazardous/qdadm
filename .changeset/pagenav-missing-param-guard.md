---
"@quazardous/qdadm": patch
---

`PageNav` no longer builds navlinks that vue-router rejects (#1205). On a child family with a show route (`jobs/:jobId/tasks/:id`), the sibling/children navlink builders passed only the currently-available params, so `useLink` threw `Missing required param "id"` on every list/detail view (non-fatal console error ×2). Item-level routes (`-show`, like `-create`/`-edit`) are now excluded from navigation tabs, and a `routeParamsSatisfied` guard (exported from `module/moduleRegistry`) drops any navlink whose target route requires params that aren't available — mirroring the breadcrumb's existing guard.
