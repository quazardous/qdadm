---
"@quazardous/qdadm": patch
---

Type-safety / legacy cleanup (#1196, KPI-9 Phase A). `SecurityChecker`'s parallel legacy branch is retired: `rolePermissions`/`roleHierarchy` constructor options are normalized once into a `StaticRoleProvider` (a passed `RoleHierarchy` instance now contributes its config to the provider instead of living in a shadow field) — the config surface is unchanged and back-compat is test-locked. New public `hasSecurityChecker()` on `EntityAuthAdapter`; `EntityManager` no longer reaches into the private `_securityChecker` field through a cast. Phase B start: 3 kernel split files converted from `type Self = any` to their real prototype shape (`Kernel.i18n`, `KernelContext.i18n`, `KernelContext.permissions`) — 7 of 17 prototype-patched files are now this-typed; the rest convert under the standing convert-on-touch rule.
