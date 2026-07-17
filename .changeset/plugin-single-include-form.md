---
'@quazardous/qdadm': patch
---

qdadmVitePlugin picks ONE CJS-transitive include form per install mode
(nested for npm installs, plain for symlinked) instead of declaring both —
kills the cosmetic "Failed to resolve dependency" optimizer warning
(skybot testbed feedback).
