---
'@quazardous/qdadm': minor
---

The YAML editors move to `@quazardous/vanilla-yamleditor` 0.4 (peer `^0.4.0`, install the v0.4.0 release tarball). The form now shows value labels (`oneOf: [{ const, title }]` or `enum` + `x-enumLabels`, titles through the catalogue), schema variants (`allOf`, `if` / `then` / `else`, `oneOf` / `anyOf` with a `discriminator`), and the per-field `readOnly`, `deprecated` (a warning that never blocks a save) and `examples`. No change in qdadm's own API.
