---
'@quazardous/qdadm': minor
---

The follow dialog shows a task's phases (#4655). A kind's `phases`, read at the log's pace or fixed, give the steps as `{ name, state, started, ended, dur, subs }`, with the states `pending`, `running`, `done`, `failed`, `cancelled` and `skipped`. A frieze above the log shows each step's state, its duration or the time since it started, and folding sub-phases; a failed step stands out. Labels come from `phase.<name>` in the app's catalogue, icons from `phaseIcons`. Log lines may now be `{ text, step, phase }`: picking a step shows only its lines, picking a sub-phase the lines between its markers (LogStream's new `phase` prop). `TaskPhases` is exported.
