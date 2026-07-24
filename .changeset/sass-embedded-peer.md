---
"@quazardous/qdadm": patch
---

Declare `sass-embedded` as an optional peerDependency and add it to every quick-start install line (#1514, aihoku feedback). qdadm ships raw `.scss` styles, so Vite consumers need a sass compiler — the requirement is now visible in metadata and docs instead of surfacing as a `Preprocessor dependency "sass-embedded" not found` overlay on first boot.
