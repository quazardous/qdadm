---
'@quazardous/qdadm': minor
---

The YAML editors move to `@quazardous/vanilla-yamleditor` 0.7 (peer `^0.7.0`, install the v0.7.0 release tarball). `VanillaYamlEditor` and `YamlConfigEditor` take `modes` (the views offered, e.g. `['form', 'text']`) and `modeSwitch` (hide the view buttons). A text that stops parsing now switches to the text view, even outside `modes`, and back to an offered view once it parses; `v-model:mode` follows both moves.
