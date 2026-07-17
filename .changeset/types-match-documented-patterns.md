---
'@quazardous/qdadm': patch
---

Shipped types now match the documented patterns — no more `as any` in a
strict TS consumer (#1387)

- `KernelOptions.authAdapter` accepts session-adapter subclasses (removed
  the index signature that rejected class instances).
- `entityAuthAdapter` accepts the documented function form
  (`() => authAdapter.getUser()`).
- `ChildConfig` gains `foreignKey` / `label` (the README parent-child shape).
- `FormInput` accepts generated fields (`ResolvedFieldConfig`) and binds
  v-model over `Record<string, unknown>` indexes; `ShowField.value` accepts
  arbitrary values.
- `useEntityItemShowPage` data defaults to `Record<string, unknown>`;
  `parentData` is a typed record (property access works).
- The tutorial patterns are now a cast-free type-conformance fixture inside
  the consumer-smoke CI gate — docs and types can no longer drift apart.
