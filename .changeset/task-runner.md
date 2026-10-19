---
"@quazardous/qdadm": minor
---

feat(tasks): a task runner for long backend tasks (#4114). `useTaskRunner().run({ label, start, task, log?, cancel?, to?, confirm? })` queues a task (`start()` returns its id) and follows the task record to the end: through live entities when the task entity is live, with polling as a fallback, or by polling alone. Status names are mapped, and progress, step, result and error are read from the record. A follow dialog shows the status, progress, step, a live LogStream, the result or the error, a link to the task, and a cancel button. Closing it leaves the task in a "running tasks" tray in the sidebar. A toast reports the end. `confirm.typed` makes the user type a name before a dangerous task starts. `taskAction()` turns run options into an action handler, and `registerTaskKind()` lets runs resume after a reload. `AppLayout` mounts `TaskTray` and `TaskHost`; other layouts can mount them themselves.
