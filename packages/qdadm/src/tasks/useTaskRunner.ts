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
  }
}

/**
 * An action handler that starts a task: `onClick: taskAction((row) => ({ label, start, ... }))`.
 * Works for row actions, header actions, show-page actions and plain buttons.
 */
export function taskAction<A extends unknown[]>(build: (...args: A) => RunOptions): (...args: A) => Promise<TaskRun | null> {
  return (...args: A) => getTaskStore().run(build(...args))
}
