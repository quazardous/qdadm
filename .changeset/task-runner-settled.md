---
'@quazardous/qdadm': minor
---

TaskRunner (#4147): `run.finished` settles with the run once it ends, and `onSettled(run)` (run option or task kind) is called then. The follow dialog re-reads the task record as soon as its log ends (`LogStream` emits `done`; `getTaskStore().poke(id)` does the same for anything else). `confirm` without `typed` is a plain confirmation, with a primary button; `confirm.severity` sets it.
