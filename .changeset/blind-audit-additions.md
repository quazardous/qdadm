---
'@quazardous/qdadm': minor
---

Small additions a newcomer had to write by hand (#4687). `QdPending` shows a retry button next to "Unavailable" when it has a `:read` (`:retry="false"` drops it). `useAsyncRead(loader, { key })` reads again from scratch when the key changes, so the previous record's answer never shows under the next one. A run takes a `meta` (kept across a reload), and the runner finds it again: `tasks.runFor(kind, meta | taskId)`, `tasks.runsFor({ kind, taskId, meta })`. `MockApiStorage` takes `latency` (ms, or `[min, max]`) and `failRate` to behave like a remote server.
