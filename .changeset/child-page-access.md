---
'@quazardous/qdadm': minor
---

A child page is governed by its parent item: the router guard refuses a `ctx.childPage()` to whoever cannot read the parent (it was open to anyone signed in), `childPage({ permission })` adds a permission on top, and `PageNav` leaves out the links the user cannot open. The guard, the menu and `PageNav` share one rule, `canOpenRoute(route, { orchestrator, checker })` in `@quazardous/qdadm/security` (#4962).
