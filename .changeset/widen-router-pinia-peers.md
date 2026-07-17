---
'@quazardous/qdadm': minor
---

Support vue-router 5 and pinia 4 (#1384)

- Peer ranges widened: `vue-router: ^4 || ^5`, `pinia: ^2 || ^3 || ^4` — a plain
  `npm install @quazardous/qdadm vue-router pinia` no longer hits ERESOLVE with
  npm's current latest. Compatibility verified end-to-end (build, routing, auth
  guard, child routes) against vue-router 5.2 / pinia 4.0.
- Kernel auth guard migrated from the deprecated `next()` callback to
  return-style navigation guards (vue-router 4 compatible, silences the
  `VUE_ROUTER_R0025` deprecation on vue-router 5).
- Sidebar version badge no longer renders a dangling `v` chip when
  `app.version` is not configured (#1382 audit).
