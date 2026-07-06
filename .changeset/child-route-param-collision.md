---
"@quazardous/qdadm": minor
---

Fix the child-route `:id` collision (#1201): `ctx.crud(child, { show/form }, { parentRoute })` generated `parent/:id/child/:id` when parent and child both used `idField: 'id'` — the child param shadowed the parent, breaking parent resolution (breadcrumb, parentChain, FK filter) on every child show/edit page.

**New naming policy (`parentParamMode: 'auto'`, default):**
- List-only child families keep the bare param — `/jobs/:id/tasks` URLs are **unchanged**.
- Families with show/edit routes namespace the parent and keep the principal (child) id bare: `/jobs/:jobId/tasks/:id`.

**Overrides** (by precedence): per-call `CrudOptions.parentParam` (e.g. `'jobUuid'`) > kernel `routeParamResolver(ctx)` global mapping service > kernel `parentParamMode` (`'auto' | 'always' | 'bare'`; `bare` = legacy naming with an explicit registration error on collision instead of silent shadowing).

Framework consumers read the resolved name from `route.meta.parent.param`, so breadcrumbs, parent chains and FK filters adapt automatically. Only app code reading `route.params.id` directly in a child show/edit page to get the **parent** id needs updating — that pattern was broken by the shadowing anyway.
