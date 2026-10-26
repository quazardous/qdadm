---
"@quazardous/qdadm": minor
---

YAML editors (#4303), in a new `@quazardous/qdadm/editors/yaml` subpath on `@quazardous/vanilla-yamleditor` (an optional peer):
- `VanillaYamlEditor`: v-model on a YAML text, with a text view and a form view built from a JSON Schema. Edits keep the file's comments and formatting.
- `YamlConfigEditor`: edits a live configuration end to end: server check, before/after diff, required reason, save against the revision, a conflict view on 409, history and restore.
- `restYamlAdapter`: speaks the REST contract for both.
