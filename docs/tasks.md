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

## When it ends

`run.finished` settles with the run once it ends, whatever the outcome: read
`run.status` (`succeeded`, `failed` or `cancelled`); it never rejects. Or pass
`onSettled(run)`, which a registered kind can carry too, so it also fires
for a run followed again after a reload:

```js
const run = await tasks.run({ label: 'Read the boxes', start, task: { entity: 'tasks' } })
const done = await run?.finished
if (done?.status === 'succeeded') await boxes.refresh()

tasks.run({ label: 'Refresh db', start, task: { entity: 'tasks' }, onSettled: () => list.refresh() })
```

The run itself is reactive too: a `watch` on `run.status` works.

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

The dialog re-reads the record as soon as the task's log ends, so the status
does not lag behind a log that already says it is done. Anything else that
knows the task moved can do the same: `getTaskStore().poke(run.id)`.

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

### The window

The dialog moves by its title bar, resizes by its corner (the log follows the
height) and goes full screen with its header button. Escape leaves full screen
first, then closes. Its size, position and full screen are kept per app in
`localStorage` (`qdadm.tasks.dialog.<app>`) and come back at the next open,
clamped to the screen. Under 640px it stays a 96vw dialog that neither moves
nor resizes.

### Customising

Options come in layers: qdadm's defaults, then the app's, then the task kind's,
then a page's own `<TaskDialog>` props.

```js
import { configureTasks, registerTaskKind } from '@quazardous/qdadm'

// Once, at boot
configureTasks({
  dialog: { width: '56rem', modal: false },
  slots: { 'after-log': DeliverySummary },
  tray: { item: MyTrayRow },
})

// Per kind
registerTaskKind('deploy', { task, log, dialog: { maximizable: false }, slots: { actions: RollbackButton } })
registerTaskKind('migrate', { task, component: MigrationDialog })
```

| `dialog` option | Default | |
|---|---|---|
| `width` | `46rem` | |
| `modal` | `true` | |
| `draggable` | `true` | Move by the title bar |
| `resizable` | `true` | Resize by the corner |
| `maximizable` | `true` | Full screen button |
| `rememberLayout` | `true` | Keep size, position and full screen |
| `position` | centre | PrimeVue Dialog position |
| `class` | | Extra class on the dialog |

- **Slots:** `header`, `before-log`, `after-log`, `actions` (beside Cancel and
  Close) and `result`, each given `{ run, kind, final }`. An app passes them as
  components (`slots`). A page that renders `<TaskDialog>` or `<TaskHost>` itself
  can also use template slots, which win.
- **A dialog of your own:** `component` renders instead of `TaskDialog`. It gets
  `{ runId, options }`, emits `close`, and reads the run with `getTaskStore()`.
  The TaskRunner still does the queue, the following, the tray and the resume.
- **The tray row:** `tray.item`, or `TaskTray`'s `item` slot, gets `{ run }`.

## Asking first

`confirm: { message?, typed?, accept?, severity? }` asks before starting. If
the user declines, nothing starts and `run()` resolves with null.

- Without `typed`, it is a plain confirmation: the message, a start button
  (`accept` labels it) and a cancel button. For a gesture that is reversible
  but worth a second look: a rollback, a fresh database.
- With `typed` (a box name, an environment), the user must type it before
  the start button enables. For what cannot be undone.

The start button is red with `typed`, plain without; `severity` sets it.

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
the follow dialog and the confirmations. An app with its own layout
mounts `<TaskHost />` once near its root, and `<TaskTray />` where it wants
it. Without a host, a task that needs a confirmation does not start (a
warning says why).

## With notifications on

When the [notification zone](notifications.md) is on, it takes over from
the tray: each running task is a status item of the panel (label and
progress; a click reopens its dialog), the logo badge shows its activity
ring until the task ends, and the end is an entry of the history (with its
`to`, it opens the task's page). The tray is then hidden; the Kernel option
`tasks: { tray: true }` shows it anyway, `tray: false` hides it without
notifications too. `TaskHost` does this, so a custom layout gets it as well.

The demo has a page for it: Features → Tasks. Create a box, close the
dialog, reload, cancel one, make one fail, destroy one.
