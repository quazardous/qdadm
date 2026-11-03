---
'@quazardous/qdadm': minor
---

A module brings its own grants (#4694): `ctx.grant(role, permissions)` in `connect()` adds default grants to the roles provider (persistable or static), so a feature needs no edit to the app's `main.js`. A role saved from the Roles screen with `createLocalStorageRolesProvider` (or `trackDefaults: true` on a persistable provider) now records the defaults it saw (`defaults_snapshot`): on the next load it keeps its own list plus the defaults added since, while a grant the user removed stays removed. Saves from before keep their list as it is.
