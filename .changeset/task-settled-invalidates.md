---
'@quazardous/qdadm': minor
---

TaskRunner: `task:settled` `{ run, kind, status, meta }` and `task:sequence-settled` `{ sequence, status, meta }` on the signal bus at the end of every run and sequence, and `invalidates: [{ entity, id? }]` on a kind, a run or a sequence: the records a task changed are read again when it ends, whatever the outcome, after an optional `ready()` bounded by `readyTimeoutMs` (#4961).
