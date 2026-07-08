---
"@quazardous/qdadm": minor
---

Four TypeScript consumer-experience fixes (#1253):

- **`QdadmManagerRegistry`** — consumer-augmentable interface (vue-router
  `RouteNamedMap` pattern). Declare your entity-name → manager-subclass map
  once via `declare module '@quazardous/qdadm'` and `getManager('bots')` /
  `useEntity('bots')` return the concrete subclass; unregistered names keep
  the historical `EntityManager<T>` fallback.
- **`StorageResolution` / `ResolvedStorage` exported** from the main barrel —
  typing a `resolveStorage()` override no longer needs `ReturnType<...>`
  archaeology. (`undefined` was already legal in the union.)
- **`baseClass` option in `generateManagers`** — global or per-entity
  `{ import, name }`; generated managers extend (classMode) or instantiate
  (instance mode) your own EntityManager subclass instead of the hardwired
  `EntityManager`.
- **`VanillaJsonEditor.mode`** accepts `'tree' | 'text' | 'table'` string
  literals (the JSDoc example finally typechecks); the `Mode` enum is also
  re-exported from `@quazardous/qdadm/editors`.
