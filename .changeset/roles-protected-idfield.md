---
"@quazardous/qdadm": patch
---

`ROLE_ANONYMOUS` stays undeletable when `RolesManager` is given another `idField` (#2406).

The protection read the role code from `name` only, so an app keeping roles behind its own API with `new RolesManager({ storage, idField: 'id' })` silently lost it: the UI offered to delete `ROLE_ANONYMOUS` like any other role. It now reads `name` and the `idField` value.

The security docs now describe `RolesManager` as what it is — the `roles` system entity — including how to keep it on your own storage, and why `system` is set by the framework's managers, not by apps.
