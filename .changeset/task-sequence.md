---
'@quazardous/qdadm': minor
---

Tasks in a row, in one window (#4934). `tasks.sequence(label, steps, { stopOnError, meta, confirm, open, onSettled })` runs tasks one after the other, and a step's `start` gets the previous step's run. `TaskSequenceDialog` lists the steps with their state, duration and a recap. A click shows a step's detail, then "Back to the list". A failure stops the rest, which show "not run", and one toast marks each step. Stop cancels the running step. The tray and the notification zone show the sequence as one line. `sequenceFor(meta)` and `isActive(sequence)` let a page keep its button pressed while it runs. A kind may carry a `start(meta)`: `run({ kind, meta })` then needs no `start`, and a sequence of such kinds goes on after a reload. A kind's `summary(run)` sets a step's recap. The body of `TaskDialog` is now `TaskRunView`, exported.
