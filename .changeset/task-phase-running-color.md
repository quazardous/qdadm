---
'@quazardous/qdadm': minor
---

A running phase no longer looks like a done one when the theme's primary is green (#4662): it is orange, slightly tinted, with a light sweeping its bar (off under `prefers-reduced-motion`). The colours are CSS variables an app may override on `.qd-task-phases`: `--qd-task-running-color` (orange by default) and `--qd-task-done-color` (green).
