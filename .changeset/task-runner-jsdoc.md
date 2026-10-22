---
"@quazardous/qdadm": patch
---

TaskRunner: the `useTaskRunner` JSDoc example and the `run()` JSDoc now say that `run()` resolves once the task has started, not when it ends, and show `await run?.finished` and `onSettled` for its outcome (#4167).
