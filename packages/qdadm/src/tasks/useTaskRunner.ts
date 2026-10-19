/**
 * useTaskRunner - start a long backend task and follow it (#4114)
 *
 * ```ts
 * const tasks = useTaskRunner()
 * tasks.run({
 *   label: `Create box ${name}`,
 *   start: () => api.post('/boxes', { name }).then((r) => r.data),   // → { task_id }
 *   task: { entity: 'tasks' },                                     // follow the task record
 *   log: (id) => ({ poll: (from) => api.get(`/tasks/${id}/log`, { params: { from } }).then((r) => r.data) }),
 *   cancel: (id) => api.post(`/tasks/${id}/cancel`),
 *   to: (id) => ({ name: 'task-show', params: { id } }),
 * })
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
