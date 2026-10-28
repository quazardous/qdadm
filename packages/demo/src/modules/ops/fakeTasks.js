/**
 * A fake task backend for the TaskRunner demo (#4114).
 *
 * A task's state is computed from the time since it started, and tasks are
 * kept in sessionStorage: reload the page while one runs and the runner
 * picks it up where it is, as it would against a real worker.
 */
const KEY = 'qdadm-demo:tasks'
const DURATION = { create: 20_000, destroy: 6_000, reset: 5_000 }
const STEPS = {
  create: ['Allocating the box', 'Cloning the ref', 'Installing dependencies', 'Restoring the database', 'Starting services'],
  destroy: ['Stopping services', 'Dropping the database', 'Releasing the box'],
  reset: ['Dropping the database', 'Restoring the dump', 'Running migrations'],
}

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
  } catch {
    return {}
  }
}
function save(tasks) {
  sessionStorage.setItem(KEY, JSON.stringify(tasks))
}
const later = (value, ms = 120) => new Promise((resolve) => setTimeout(() => resolve(value), ms))

export function createTask(type, { box, fail = false } = {}) {
  const tasks = load()
  const id = Math.max(100, ...Object.keys(tasks).map(Number)) + 1
  tasks[id] = { id, type, box, fail, startedAt: Date.now(), cancelledAt: null }
  save(tasks)
  return later({ task_id: id }, 300)
}

export function cancelTask(id) {
  const tasks = load()
  if (tasks[id]) tasks[id].cancelledAt = Date.now()
  save(tasks)
  return later(true)
}

function stateAt(task, now) {
  const duration = DURATION[task.type]
  const elapsed = (task.cancelledAt ?? now) - task.startedAt
  const steps = STEPS[task.type]
  if (elapsed < 1500) return { status: 'queued', progress: null, step: 'Waiting for a worker', elapsed }
  const progress = Math.min(100, ((elapsed - 1500) / duration) * 100)
  const step = steps[Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length))]
  if (task.fail && progress > 62) return { status: 'failed', progress, step, elapsed, error: 'pg_restore: error: could not execute query: relation "orders_sku_idx" already exists' }
  if (task.cancelledAt) return { status: 'cancelled', progress, step, elapsed }
  if (progress >= 100) {
    return { status: 'done', progress: 100, step: 'Done', elapsed, result: task.type === 'create' ? { box: task.box, url: `https://${task.box}.stagebox.test`, db: 'refreshed 2026-10-19 06:00' } : task.type === 'reset' ? { box: task.box, dump: '2026-10-21 06:00' } : { box: task.box, freed: '38 GB' } }
  }
  return { status: 'in_progress', progress, step, elapsed }
}

export function getTask(id) {
  const task = load()[id]
  if (!task) return Promise.reject(new Error(`task ${id} not found`))
  return later({ id: task.id, box: task.box, ...stateAt(task, Date.now()) })
}

/** GET /tasks/<id>/log?from=<n> → { lines, next, done } */
export function readLog(id, from) {
  const task = load()[id]
  if (!task) return Promise.reject(new Error(`task ${id} not found`))
  const state = stateAt(task, Date.now())
  const count = Math.floor(state.elapsed / 300)
  const lines = []
  for (let i = from; i < count; i++) {
    const t = new Date(task.startedAt + i * 300).toISOString().replace(/\.\d+Z$/, 'Z')
    const s = stateAt(task, task.startedAt + i * 300)
    // A file name with "error" in it is not an error: the dialog flags whole words only (#4386)
    if (s.step === 'Cloning the ref' && i % 9 === 4) lines.push(`${t}   checkout  M  src/handlers/shipping_error.php`)
    else lines.push(i % 9 === 0 ? `${t} \x1b[1;34m==> ${s.step}\x1b[0m` : `${t} \x1b[2m  ${s.step.toLowerCase()} ${i}\x1b[0m`)
  }
  const done = ['failed', 'cancelled', 'done'].includes(state.status)
  if (done && from <= count) {
    if (state.status === 'failed') lines.push(`\x1b[31mERROR\x1b[0m ${state.error}`)
    if (state.status === 'cancelled') lines.push('\x1b[33mcancelled by the user\x1b[0m')
    if (state.status === 'done') lines.push('\x1b[32m✔ finished\x1b[0m')
  }
  return later({ lines, next: done ? count + 1 : count, done }, 60)
}
