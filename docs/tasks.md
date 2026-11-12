# TaskRunner: long backend tasks, queued and followed

Some actions are long tasks run by workers: create a box, refresh its
database, load a git ref, run a scenario. Such an action must neither block
the screen nor be fire-and-forget. The task runner starts the task, then
follows the task record until it ends. A dialog shows its status, progress,
current step, live log, and then the result or the error. A tray in the
sidebar lists the running tasks.

```js
// In the module: the kind (how to follow, cancel and show a task), and the
// manager's method that queues it (docs/RULES.md, rule 2)
registerTaskKind('create-box', {
  task: { entity: 'tasks' },
  log: (id) => ({ poll: (from) => api.get(`/tasks/${id}/log`, { params: { from } }).then((r) => r.data) }),
  cancel: (id) => api.post(`/tasks/${id}/cancel`),
  to: (id) => ({ name: 'task-show', params: { id } }),
})
class BoxesManager extends EntityManager {
  create(name) { return api.post('/boxes', { name }).then((r) => r.data) }   // → { task_id: 42 }
}
```

```js
// In the page
import { useTaskRunner, useOrchestrator } from '@quazardous/qdadm'

const tasks = useTaskRunner()
const boxes = useOrchestrator().getManager('boxes')
tasks.run({ kind: 'create-box', label: `Create box ${name}`, start: () => boxes.create(name) })
```

## Starting

`start()` queues the task and returns its id: a string or number, or an
object with `task_id`, `taskId` or `id`. If it throws, or returns no id, the
run fails at once with that reason.

`run()` opens the follow dialog (unless `open: false`) and resolves with the
run as soon as the task is queued. The run then moves on by itself.

A `label` may be a function, `label: () => t('stock.check', { name })`: it is
read each time the run shows (tray, dialog, end toast), so it follows the
locale.

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

Anywhere else in the app, the signal bus says it: `task:settled`
`{ run, kind, status, meta }` at the end of every run, a step of a sequence
included, and `task:sequence-settled` `{ sequence, status, meta }` at the end
of a sequence. Both fire for a run followed again after a reload too.

### Refreshing what a task changed

A task that changes records says which, and every screen showing them reads
them again when it ends, whatever the outcome: a failed or cancelled task may
have changed things too.

```js
registerTaskKind('deploy', {
  task: { entity: 'tasks' },
  invalidates: [{ entity: 'instances', id: (run) => run.meta.instance }],
})
tasks.run({ kind: 'deploy', label: 'Deploy', meta: { instance: 'prod' } })
```

An entry without `id` covers the whole entity. A run's own `invalidates` add to
its kind's; a sequence takes `invalidates` too, whose `id` gets the sequence,
and each of its steps applies its own as it ends. It goes through
[`manager.invalidate(id)`](live-entities.md#saying-it-from-the-app); an entity
that is not registered is skipped with a warning.

When the backend is still refreshing what the task changed after the task
itself has ended, `ready(run)` is awaited first: the invalidation waits for it,
up to `readyTimeoutMs` (30 s by default), then goes ahead anyway, even if
`ready` failed. The signal, the toast and the next step of a sequence do not
wait.

```js
invalidates: [{ entity: 'instances', id: (run) => run.meta.instance }],
ready: (run) => api.get(`/instances/${run.meta.instance}/refreshed`),
```

## Following

`task` says how to read the task record:

| | Default | |
|---|---|---|
| `entity` | — | the task entity, read through its manager (`get(id)`, never from a list cache) |
| `get` | — | or `(taskId) → Promise<record>` |
| `status` | `'status'` | the field, or `(record) → value` |
| `statusMap` | — | backend values to `queued`, `running`, `succeeded`, `failed` or `cancelled` |
| `progress` | `'progress'` | percent, 0–100; without it the bar is indeterminate. The field, or `(record) → value` |
| `step` | `'step'` | the current step, under the bar. The field, or `(record) → value` |
| `result` | `'result'` | what a finished task produced, shown in the dialog. The field, or `(record) → value` |
| `error` | `'error'` | why it failed. The field, or `(record) → value` |
| `intervalMs` | 2000 | the poll interval |

A reader is how a backend that answers in codes gets words on screen: `step:
(r) => t(\`stock.steps.${r.step}\`)` shows the step in the user's language.

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
- The task's [phases](#phases), when `phases` is given.
- The live log, when `log(taskId)` returns a [LogStream](log-stream.md)
  source.
- At the end, the result (an object shows as JSON) or the error.
- A link to the task's page when `to(taskId)` is given.
- **Cancel** when `cancel(taskId)` is given. It calls the backend; the run
  ends when the record says it was cancelled.
- Closing the dialog stops nothing: the task goes on in the tray, and the
  tray reopens its dialog. Going to another page closes it the same way (it is
  modal, and would otherwise block the page); `dialog: { keepOnNavigate: true }`
  on a kind or in `configureTasks` keeps it open.

When a task ends, a toast says so (`notify: false` turns that off). A
failure stays in the notification history, and the toast leads to the
task's page.

### Phases

A task that goes through steps (check, preview, wait for the crons, deliver,
back up) shows them as a frieze above the log: a row across, a column when the
dialog is narrow.

```ts
registerTaskKind('deliver', {
  task, log,
  phases: (taskId) => api.get(`/v1/tasks/${taskId}/phases`).then((r) => r.data),
  phaseIcons: { deploy: 'pi pi-upload', 'backup-after': 'pi pi-database' },
})
```

- `phases` is a reader, called at the log's pace (else the task's
  `intervalMs`) while the run lasts and once more at its end, or fixed phases.
  Either is `{ steps }` or the steps alone.
- A step is `{ name, state, started, ended, dur, subs }`: `state` is
  `pending`, `running`, `done`, `failed`, `cancelled` or `skipped`, `started`
  and `ended` ISO times, `dur` seconds, `subs` its sub-phases, of the same
  shape.
- Each step shows its state's icon and colour, then its duration, or the time
  since it started while it runs. Sub-phases fold out under their step. A
  failed step stands out and opens its sub-phases; a cancelled one is grey.
- Labels come from the app's catalogue, `phase.<name>`, else the name. A
  sub-phase (`deploy.wait-crons`) tries its full name, then its last segment
  (`phase.wait-crons`), then shows that segment.
- Icons: `phaseIcons`, name to icon class, from the kind or `configureTasks()`.
  A phase without one shows its state's.
- Colours: a running step is orange whatever the theme's primary, with a light
  running back and forth on its bar (still under `prefers-reduced-motion`); a
  done one is green. An app changes them with CSS variables on `.qd-task-phases`:
  `--qd-task-running-color` and `--qd-task-done-color`.
- With a log whose lines carry their step (see [LogStream](log-stream.md#sources)),
  picking a step shows only its lines, under a "Phase: …" chip; picking it again,
  or the chip's cross, gives the whole log back. A sub-phase can be picked when
  the log has its start marker: its lines run from that marker to its end marker.
- `TaskPhases` is exported for a page of its own:
  `<TaskPhases v-model:selected="phase" :phases="phases" selectable />`.

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
- **The log's patterns:** `logPatterns: { errorPattern, timestampPattern }`,
  at the app's level or the kind's (or one `run()`), go to the dialog's
  [LogStream](log-stream.md). `errorPattern` picks the lines flagged as errors and
  counted by the "N errors" button; the default, `\b(error|fatal|failed)\b`
  (case-insensitive), takes whole words only, so `shipping_error.php` is not an
  error. A string is a case-insensitive pattern; `null` turns a pattern off.

  ```js
  registerTaskKind('deliver', { task, log, logPatterns: { errorPattern: /\[error\]|^→ (failed|refused)/ } })
  ```

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

## The run about a record

A page that shows a record finds the run about it again, live and after a
reload: give the run a `meta`, then ask for it.

```js
tasks.run({ kind: 'stock-check', label: `Check ${supplier.name}`, start, meta: { supplierId: supplier.id } })

const check = computed(() => tasks.runFor('stock-check', { supplierId: supplier.id }))
// check.value?.status, .progress, .step… and tasks.open(check.value.id) reopens its dialog
```

`runFor(kind, meta | taskId)` gives the latest such run, or null;
`runsFor({ kind, taskId, meta })` all of them, newest first. `meta` holds plain
values: it is kept with the run in `sessionStorage`.

- `meta` is compared with `===`: a route param is a string, so store the id
  the way the page will ask for it (`{ supplierId: String(id) }`).
- The runner keeps the runs of this tab: a finished run is gone after a
  reload, and a run started elsewhere is not there. "The last check of this
  record" belongs to the backend: read it like any record (an entity, or a
  manager method with `useAsyncRead`), and use `runFor` for the run in
  progress.

On the record's page, `TaskRunStatus` shows that run in a line: its status
(the dialog's words and colours), progress and step while it runs, the error
once it failed, a `#result` slot once it succeeded, and **Follow**, which
reopens its dialog; without a run, "Not run yet".

```vue
<TaskRunStatus :run="check">
  <template #result="{ run }">{{ run.result.count }} in stock</template>
</TaskRunStatus>
<Button label="Check the stock" :disabled="tasks.isActive(check)" @click="startCheck" />
```

`tasks.isActive(run)` is true while a run is starting, queued or running.

## Tasks in a row

A gesture that runs several tasks, one after the other, runs them as a
**sequence**: one window lists the steps, each with its state (waiting,
running, done, failed, not run), its duration and a recap (the error, or the
step reached). A click on a step shows its detail: what the follow dialog
shows (log, phases, result), with **Back to the list**. The tray and the
notification zone show the sequence as one line.

```js
const seq = await tasks.sequence('Verify', [
  { kind: 'check', label: 'Check', start: () => boxes.check(box) },
  { kind: 'conf-check', label: 'Conf check', start: (previous) => boxes.confCheck(box, previous?.result) },
], { meta: { box } })
const end = await seq?.finished   // end.status: succeeded, failed or cancelled
```

- A step is the options of a `run()`. Its `start` gets the previous step's
  run. A step may also be a function of that run that returns the options;
  its line reads "Step n" until it starts.
- A failure stops the rest: those steps show "not run".
  `stopOnError: false` goes on, and the sequence still ends `failed`.
- **Stop the sequence** cancels the running step (when its kind can) and the
  rest is not run.
- One toast at the end, each step marked (`✓ Check · ✗ Conf check: drift`);
  the steps' own toasts are off.
- `confirm` is asked once, before the first step; `open: false` starts it
  without the window; `onSettled(sequence)` is called once it ends.
- One step only is a plain run: its own window, its own toast.

A page finds it again by its `meta`: `tasks.sequenceFor({ box })`, and
`tasks.isActive(sequence)` keeps a button pressed while it runs, without a
flag of its own. `tasks.open(sequence.id)` reopens its window.

**After a reload**, the running step is followed again like any run of a
registered kind. The steps after it start again when their kind has a
`start(meta)`, so a sequence written with kinds and metas goes on:

```js
registerTaskKind('check', { task: { entity: 'tasks' }, start: (meta) => boxes.check(meta.box) })
tasks.sequence('Verify', [
  { kind: 'check', label: 'Check', meta: { box } },
  { kind: 'conf-check', label: 'Conf check', meta: { box } },
], { meta: { box } })
```

A step whose kind cannot start again shows "the page was reloaded", and the
sequence ends `cancelled`. A kind's `summary(run)` sets its line's recap.

The window is `TaskSequenceDialog`, and a step's detail is `TaskRunView`,
the body of `TaskDialog`, which a custom window may use too. The host's
`before-log`, `after-log` and `result` slots reach a step's detail.

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
