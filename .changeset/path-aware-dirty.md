---
'@quazardous/qdadm': minor
---

Path-addressable dirty detection (#1396): `isFieldDirty('config.login')`
tracks sub-fields of JSON objects like root fields — `FormField` accepts
dot paths in `name` with zero changes, dot-free names keep the exact
previous behavior. Kills the flatten-and-repack pattern for pages editing
nested objects.
