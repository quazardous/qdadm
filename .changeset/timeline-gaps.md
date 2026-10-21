---
'@quazardous/qdadm': patch
---

EntityTimeline (#4147): with `gaps`, each gap reads from the row above it in either order, and the first event under a day separator has none, so it no longer sits over the date in `desc`.
