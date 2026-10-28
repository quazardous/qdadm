---
'@quazardous/qdadm': minor
---

The YAML editors move to `@quazardous/vanilla-yamleditor` 0.3 (peer `^0.3.0`, install the v0.3.0 release tarball). `VanillaYamlEditor` has three views: `text`, a technical `tree` (nested `key: value` lines) and `form` (the schema form, previously called `tree`). The default stays the form when there is a schema, the tree otherwise. Code that passes `mode="tree"` to get the form now passes `mode="form"`.

Valid YAML that is likely a typo (`port :: 8080`, a quoted key with spaces around it) is flagged as a warning, which never blocks a save; the new `lint` prop (default `true`) turns it off. `YamlConfigEditor` gains the `mode` and `lint` props, passed to its editor. New labels in `core.yamlEditor`: `form`, `warnings`, `colonKey`, `spacedKey`; `tree` is now "Tree" / "Arbre".
