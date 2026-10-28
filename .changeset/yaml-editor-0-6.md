---
'@quazardous/qdadm': minor
---

The YAML editors move to `@quazardous/vanilla-yamleditor` 0.6 (peer `^0.6.0`, install the v0.6.0 release tarball); its main entry no longer brings `@codemirror/merge`, and the consumer smoke now fails if an app that imports `@quazardous/qdadm/editors/yaml` gets it in its bundle. `YamlConfigEditor` lists the keys a change touches above the review diff (up to 8, then "+N more"; a click goes back to that field), and the keys the other person changed in the 409 dialog. New labels `core.yamlEditor.changedKeys`, `theyChanged`, `moreKeys`.
