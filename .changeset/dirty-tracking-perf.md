---
"@quazardous/qdadm": patch
---

Dirty-tracking perf (#1194, KPI-7). `checkDirty` runs on every keystroke (deep watch on the form): the initial-side per-key `JSON.stringify` is now precomputed once at `takeSnapshot()` (cached map) instead of re-stringified on each check, and the snapshot's `JSON.parse(JSON.stringify(state))` deep clone is gone. Measured on a 100-field form with nested values: **checkDirty ×1.6 faster per keystroke, takeSnapshot ×1.85 faster**. Behavior identical (locked by a new dedicated test suite — `useDirtyState` previously had no direct tests); `isFieldDirty` reactivity untouched.
