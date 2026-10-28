---
'@quazardous/qdadm': minor
---

The YAML editors move to `@quazardous/vanilla-yamleditor` 0.8 (peer `^0.8.0`, install the v0.8.0 release tarball). Nothing changes in qdadm's API; the text view's line numbers no longer drift after switching from the tree or the form. The lib's linked views (`createYamlDocument`, `mount*View`) are reachable through `VanillaYamlEditor`'s exposed `editor().document`.
