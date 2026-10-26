---
'@quazardous/qdadm': minor
---

Route guard by permission (#4332): the router refuses a page whose `meta.permission` (a string, or a list needing every entry; a parent's covers its children) is not granted, with the "Access Denied" toast, the `auth:access-denied` signal (`{ path, permission }`) and a redirect to `/`. It waits for a judge's `ready()` and fails closed; without a security checker nothing is checked. `ctx.routes(path, routes, { permission })` sets it on a group, and a route menu entry without its own `permission` follows its route's. A route that carried `meta.permission` for display only is now guarded.
