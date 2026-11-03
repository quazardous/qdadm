---
'@quazardous/qdadm': minor
---

Tasks on a record's page (#4695). `TaskRunStatus` shows a run in a line: its status (the dialog's words and colours), progress and step while it runs, the error once it failed, a `#result` slot once it succeeded, Follow to reopen its dialog, and "Not run yet" without a run. `tasks.isActive(run)` tells a run still going. The follow dialog, modal, now closes when the user goes to another page and the run goes on in the tray; `dialog: { keepOnNavigate: true }` keeps it open.
