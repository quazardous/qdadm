---
"@quazardous/qdadm": minor
---

`RoleGrantsEditor`: a role's composition, made readable (#2313).

- **What it shows:** the roles a role inherits, an entity × action matrix of the registry's entity grants, and the named grants grouped by namespace.
- **Every checked grant says where it comes from:** the role's own key, one of its wildcards (`via entity:*:read`), or an inherited role (`via ROLE_USER`). Inherited and covered grants are greyed and can't be unchecked there.
- **`v-model`** is `{ inherits, permissions }`, the role's own composition only. Keys the registry does not know are kept and listed.
- **It judges nothing.** The roles to inherit from and what they bring (`inherited: [{ permission, via }]`) come from the app. qdadm's roles provider computes them with the new `inheritedGrants()`; an app whose server judges sends them.
- **`SecurityModule`'s role form** now uses it, instead of the role-name autocomplete and the raw-key `PermissionEditor`. `PermissionEditor` is still there for raw keys.
- **New from `@quazardous/qdadm/security`:** `composeGrants`, `inheritedGrants`, `originOf`, `setGrant` and their types.
- **Wording:** new `core.roles.*` keys in the en and fr defaults.
