# TaskRunner: long backend tasks, queued and followed

Some actions are long tasks run by workers: create a box, refresh its
database, load a git ref, run a scenario. Such an action must neither block
the screen nor be fire-and-forget. The task runner starts the task, then
follows the task record until it ends. A dialog shows its status, progress,
current step, live log, and then the result or the error. A tray in the
sidebar lists the running tasks.

```js
import { useTaskRunner } from '@quazardous/qdadm'

const tasks = useTaskRunner()
tasks.run({
  label: `Create box ${name}`,
  start: () => api.post('/boxes', { name }).then((r) => r.data),   // → { task_id: 42 }
  task: { entity: 'tasks' },
  log: (id) => ({ poll: (from) => api.get(`/tasks/${id}/log`, { params: { from } }).then((r) => r.data) }),
  cancel: (id) => api.post(`/tasks/${id}/cancel`),
  to: (id) => ({ name: 'task-show', params: { id } }),
})
```

## Starting

`start()` queues the task and returns its id: a string or number, or an
object with `task_id`, `taskId` or `id`. If it throws, or returns no id, the
run fails at once with that reason.

`run()` opens the follow dialog (unless `open: false`) and resolves with the
run as soon as the task is queued. The run then moves on by itself.

## Following

`task` says how to read the task record:

| | Default | |
|---|---|---|
| `entity` | — | the task entity, read through its manager (`get(id)`, never from a list cache) |
| `get` | — | or `(taskId) → Promise<record>` |
| `status` | `'status'` | the field, or `(record) → value` |
| `statusMap` | — | backend values to `queued`, `running`, `succeeded`, `failed` or `cancelled` |
| `progress` | `'progress'` | percent, 0–100; without it the bar is indeterminate |
| `step` | `'step'` | the current step, under the bar |
| `result` | `'result'` | what a finished task produced, shown in the dialog |
| `error` | `'error'` | why it failed |
| `intervalMs` | 2000 | the poll interval |

The usual status names are understood without a map: `pending` or
`waiting` mean queued; `in_progress`, `processing` or `started` mean running;
`done`, `completed` or `success` mean succeeded; `error` means failed;
`canceled` or `aborted` mean cancelled. An unknown value counts as running.

When `entity` is a [live entity](live-entities.md), a change of that task's
record is read at once, and polling becomes a 10 s fallback. Otherwise the
record is polled. A read that fails is retried, with longer and longer
waits, and does not end the run.

## The dialog

- The status, the time elapsed, and the task id.
- A progress bar and the current step.
- The live log, when `log(taskId)` returns a [LogStream](log-stream.md)
  source.
- At the end, the result (an object shows as JSON) or the error.
- A link to the task's page when `to(taskId)` is given.
- **Cancel** when `cancel(taskId)` is given. It calls the backend; the run
  ends when the record says it was cancelled.
- Closing the dialog stops nothing: the task goes on in the tray, and the
  tray reopens its dialog.

When a task ends, a toast says so (`notify: false` turns that off). A
failure stays in the notification history, and the toast leads to the
task's page.

## Dangerous tasks

`confirm: { typed, message?, accept? }` asks before starting. The user must
type `typed` (a box name, an environment) before the start button
enables. If they decline, nothing starts and `run()` resolves with null.

## Actions

`taskAction` turns run options into an action handler. It works for list
row actions, header actions, show-page actions and plain buttons:

```js
import { taskAction } from '@quazardous/qdadm'

list.addAction('destroy', {
  icon: 'pi pi-trash',
  severity: 'danger',
  onClick: taskAction((box) => ({
    kind: 'destroy-box',
    label: `Destroy ${box.name}`,
    start: () => api.delete(`/boxes/${box.id}`).then((r) => r.data),
    confirm: { typed: box.name, message: 'The box and its database are deleted.' },
  })),
})
```

## Surviving a reload

Register the kinds of task in a module's `connect()`:

```js
import { registerTaskKind } from '@quazardous/qdadm'

registerTaskKind('create-box', { task: { entity: 'tasks' }, cancel, log, to })
```

A run started with `kind: 'create-box'` takes those settings as defaults.
Its id is kept in `sessionStorage` while it runs, so after a reload it is
followed again: in the tray, and in its dialog when reopened. Runs without a
registered kind live as long as the page.

## Where the dialogs live

`AppLayout` mounts the tray in the sidebar and a `TaskHost`, which renders
the follow dialog and the typed confirmation. An app with its own layout
mounts `<TaskHost />` once near its root, and `<TaskTray />` where it wants
it. Without a host, a task that needs a confirmation does not start (a
warning says why).

The demo has a page for it: Features → Tasks. Create a box, close the
dialog, reload, cancel one, make one fail, destroy one.
