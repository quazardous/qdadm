---
'@quazardous/qdadm': minor
---

StructuredField and PermissionEditor (#5333).

- `StructuredField`: a structured face (the slot) and a raw face of the same `v-model`, in JSON or YAML (`format`). The raw faces come with their optional peers' subpaths: importing `@quazardous/qdadm/editors/json` or `@quazardous/qdadm/editors/yaml` registers them. `JsonStructuredField` is now `StructuredField` with the JSON face, its props unchanged.
- New subpath `@quazardous/qdadm/editors/json` for the JSON editors; `@quazardous/qdadm/editors` stays as its alias.
- `PermissionEditor` suggests the multi-level wildcards `PermissionMatcher` reads (`**`, `**:read`, `logs:**`, `logs:*:read`), takes a plain `permissions: string[]` besides `permissionRegistry` (`permissionRegistryFromList` exported), and its texts are in the catalogue.
- A form's delete action is rendered: `FormActions` shows it in the footer in edit mode. `addDeleteAction({ label, icon, confirmHeader, confirmMessage })` gives it its own words ("Revoke"), the confirmation's accept button included.
