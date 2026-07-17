---
'@quazardous/qdadm': patch
---

Published sources now pass a strict consumer typecheck out of the box (#1386)

- Removed the write-only private fields and unused v-for alias that failed
  `noUnusedLocals` in consumer builds (create-vite vue-ts template flags),
  including `EntityRolesProvider._ctx` (caught once the smoke fixture gained
  the `/security` subpath import).
- `@types/pluralize` moved into dependencies — consumers no longer shim it.
- `@quazardous/qdadm/styles` gained a `types` exports condition + d.ts
  companion, so the side-effect import typechecks (was TS2882).
- The consumer-smoke CI gate now runs with the vue-ts template's strict
  flags (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
  `erasableSyntaxOnly`) and no local shims, so this can't regress.
