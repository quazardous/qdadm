/**
 * useTaskRunner - start a long backend task and follow it (#4114)
 *
 * ```ts
 * const tasks = useTaskRunner()
 * // run() resolves once the task has STARTED (queued), not when it ends;
 * // it resolves with null when the user declines the confirmation.
 * const run = await tasks.run({
 *   label: `Create box ${name}`,
 *   start: () => api.post('/boxes', { name }).then((r) => r.data),   // → { task_id }
 *   task: { entity: 'tasks' },                                     // follow the task record
 *   log: (id) => ({ poll: (from) => api.get(`/tasks/${id}/log`, { params: { from } }).then((r) => r.data) }),
 *   cancel: (id) => api.post(`/tasks/${id}/cancel`),
 *   to: (id) => ({ name: 'task-show', params: { id } }),
 * })
 * // The end: run.finished settles with the final run, whatever the outcome
 * const end = await run?.finished
 * if (end?.status === 'failed') console.warn(end.error)
 *
 * // Or react to the end without awaiting it (also fires after a reload resume)
 * tasks.run({ label: 'Refresh db', start, task: { entity: 'tasks' }, onSettled: () => list.refresh() })
 *
 * // A page finds the run about its record again, live, across a reload
 * tasks.run({ kind: 'stock-check', label, start, meta: { supplierId: id } })
 * const check = computed(() => tasks.runFor('stock-check', { supplierId: id }))
 *
 * // Tasks chained in one window: the list of steps, each step's detail on a click (#4934).
 * // A step's start gets the previous step's run; a failure stops the rest.
 * const seq = await tasks.sequence('Verify', [
 *   { kind: 'check', label: 'Check', start: () => api.check(box) },
 *   { kind: 'conf-check', label: 'Conf check', start: (prev) => api.confCheck(box, prev?.result) },
 * ], { meta: { box } })
 * const busy = computed(() => tasks.isActive(tasks.sequenceFor({ box })))
 *
 * // As a row action, with a typed confirmation
 * list.addAction('destroy', {
 *   icon: 'pi pi-trash', severity: 'danger',
 *   onClick: taskAction((box) => ({
 *     label: `Destroy ${box.name}`, kind: 'destroy-box',
 *     start: () => api.delete(`/boxes/${box.id}`).then((r) => r.data),
 *     confirm: { typed: box.name, message: 'The box and its database are deleted.' },
 *   })),
 * })
 * ```
 */

import { inject } from 'vue'
import { getTaskStore, type RunOptions, type TaskRun } from './taskStore'

export function useTaskRunner() {
  const store = getTaskStore()
  store.attach({
    orchestrator: inject('qdadmOrchestrator', null),
    signals: inject('qdadmSignals', null),
  })
  return {
    /** Start a task. Resolves once it has started (or null when declined); await `run.finished` for its end. */
    run: store.run,
    cancel: store.cancel,
    dismiss: store.dismiss,
    open: store.open,
    runs: store.state.runs,
    active: store.active,
    /** The latest run of a kind about one record (its meta, or its task id), or null (#4687). */
    runFor: store.runFor,
    /** The runs matching `{ kind, taskId, meta }`, newest first. */
    runsFor: store.runsFor,
    /** A run or a sequence still going, false for none (#4695). */
    isActive: store.isActive,
    /** Run tasks one after another, followed in one window (#4934). Resolves once under way; await `sequence.finished`. */
    sequence: store.sequence,
    cancelSequence: store.cancelSequence,
    /** The latest sequence about a record (its meta), or null. */
    sequenceFor: store.sequenceFor,
    sequencesFor: store.sequencesFor,
  }
}

/**
 * An action handler that starts a task: `onClick: taskAction((row) => ({ label, start, ... }))`.
 * Works for row actions, header actions, show-page actions and plain buttons.
 */
export function taskAction<A extends unknown[]>(build: (...args: A) => RunOptions): (...args: A) => Promise<TaskRun | null> {
  return (...args: A) => getTaskStore().run(build(...args))
}
