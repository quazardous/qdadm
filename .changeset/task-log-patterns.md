---
'@quazardous/qdadm': minor
---

The task dialog's log takes its patterns from the layers: `logPatterns: { errorPattern, timestampPattern }` in `configureTasks`, `registerTaskKind` or a `run()`, the kind's over the app's. `null` turns a pattern off (no error flagging, no "N errors" button). The default error pattern now takes whole words only, `\b(error|fatal|failed)\b`: a line naming `shipping_error.php` or `failed_jobs` is no longer flagged as an error. `TASK_LOG_DEFAULTS` and the `TaskLogPatterns` type are exported.
