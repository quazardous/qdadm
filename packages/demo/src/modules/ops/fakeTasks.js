/**
 * A fake task backend for the TaskRunner demo (#4114).
 *
 * A task's state is computed from the time since it started, and tasks are
 * kept in sessionStorage: reload the page while one runs and the runner
 * picks it up where it is, as it would against a real worker.
 */
const KEY = 'qdadm-demo:tasks'
const DURATION = { create: 20_000, destroy: 6_000, reset: 5_000, check: 6_000, 'conf-check': 7_000 }
const STEPS = {
  create: ['Allocating the box', 'Cloning the ref', 'Installing dependencies', 'Restoring the database', 'Starting services'],
  destroy: ['Stopping services', 'Dropping the database', 'Releasing the box'],
  reset: ['Dropping the database', 'Restoring the dump', 'Running migrations'],
  // The two checks of the "Verify" sequence (#4934)
  check: ['Reaching the box', 'Reading the services', 'Checking the disk'],
  'conf-check': ['Reading the configuration', 'Comparing with the reference', 'Checking the secrets'],
}
// The same steps as phases (#4655): one name each, and the restore's two sub-phases
const PHASES = {
  create: ['allocate', 'clone', 'install', 'restore', 'start'],
  destroy: ['stop', 'drop-db', 'release'],
  reset: ['drop-db', 'restore', 'migrate'],
  check: ['reach', 'services', 'disk'],
  'conf-check': ['read-conf', 'compare', 'secrets'],
}
const SUBS = { restore: ['restore.download', 'restore.import'] }
const FAIL_AT = 62

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
  if (task.fail && progress > 62) {
    const error = task.type === 'conf-check' ? 'app.yml differs from the reference: mailer.dsn' : 'pg_restore: error: could not execute query: relation "orders_sku_idx" already exists'
    return { status: 'failed', progress, step, elapsed, error }
  }
  if (task.cancelledAt) return { status: 'cancelled', progress, step, elapsed }
  if (progress >= 100) {
    const results = {
      create: { box: task.box, url: `https://${task.box}.stagebox.test`, db: 'refreshed 2026-10-19 06:00' },
      reset: { box: task.box, dump: '2026-10-21 06:00' },
      destroy: { box: task.box, freed: '38 GB' },
      check: { box: task.box, services: 4, disk: '61 %' },
      'conf-check': { box: task.box, files: 12 },
    }
    const done = { check: '4 services up, disk at 61 %', 'conf-check': '12 files match the reference' }
    return { status: 'done', progress: 100, step: done[task.type] ?? 'Done', elapsed, result: results[task.type] }
  }
  return { status: 'in_progress', progress, step, elapsed }
}

export function getTask(id) {
  const task = load()[id]
  if (!task) return Promise.reject(new Error(`task ${id} not found`))
  return later({ id: task.id, box: task.box, ...stateAt(task, Date.now()) })
}

const progressAt = (task, at) => Math.min(100, Math.max(0, ((at - task.startedAt - 1500) / DURATION[task.type]) * 100))

/** The step and sub-phase running at a time, or null while queued */
function phaseAt(task, at) {
  if (at - task.startedAt < 1500) return null
  const names = PHASES[task.type]
  const exact = (progressAt(task, at) / 100) * names.length
  const index = Math.min(names.length - 1, Math.floor(exact))
  const step = names[index]
  const subs = SUBS[step]
  return { step, label: STEPS[task.type][index], sub: subs ? subs[exact - index < 0.5 ? 0 : 1] : null }
}

/** GET /tasks/<id>/log?from=<n> → { lines, next, done }; each line says its step (#4655) */
export function readLog(id, from) {
  const task = load()[id]
  if (!task) return Promise.reject(new Error(`task ${id} not found`))
  const state = stateAt(task, Date.now())
  const count = Math.floor(state.elapsed / 300)
  const lines = []
  for (let i = from; i < count; i++) {
    const at = task.startedAt + i * 300
    const t = new Date(at).toISOString().replace(/\.\d+Z$/, 'Z')
    const ph = phaseAt(task, at)
    if (!ph) {
      lines.push(`${t} \x1b[2m  waiting for a worker\x1b[0m`)
      continue
    }
    const prev = i > 0 ? phaseAt(task, at - 300) : null
    const { step } = ph
    // A phase's first and last lines carry its marker
    if (prev?.sub && prev.sub !== ph.sub) lines.push({ text: `${t} \x1b[2m  <-- ${prev.sub}\x1b[0m`, step: prev.step, phase: { event: 'end', name: prev.sub } })
    if (prev && prev.step !== step) lines.push({ text: `${t} \x1b[2m<== ${prev.step}\x1b[0m`, step: prev.step, phase: { event: 'end', name: prev.step } })
    if (prev?.step !== step) lines.push({ text: `${t} \x1b[1;34m==> ${ph.label}\x1b[0m`, step, phase: { event: 'start', name: step } })
    if (ph.sub && prev?.sub !== ph.sub) lines.push({ text: `${t} \x1b[36m  --> ${ph.sub}\x1b[0m`, step, phase: { event: 'start', name: ph.sub } })
    // A file name with "error" in it is not an error: the dialog flags whole words only (#4386)
    if (step === 'clone' && i % 9 === 4) lines.push({ text: `${t}   checkout  M  src/handlers/shipping_error.php`, step })
    else lines.push({ text: `${t} \x1b[2m  ${ph.label.toLowerCase()} ${i}\x1b[0m`, step })
  }
  const done = ['failed', 'cancelled', 'done'].includes(state.status)
  if (done && from <= count) {
    const step = phaseAt(task, task.startedAt + count * 300)?.step
    if (state.status === 'failed') lines.push({ text: `\x1b[31mERROR\x1b[0m ${state.error}`, step })
    if (state.status === 'cancelled') lines.push({ text: '\x1b[33mcancelled by the user\x1b[0m', step })
    if (state.status === 'done') lines.push('\x1b[32m✔ finished\x1b[0m')
  }
  return later({ lines, next: done ? count + 1 : count, done }, 60)
}

/** GET /tasks/<id>/phases → { state, steps: [{ name, state, started, ended, dur, subs }] } (#4655) */
export function readPhases(id) {
  const task = load()[id]
  if (!task) return Promise.reject(new Error(`task ${id} not found`))
  const now = Date.now()
  const state = stateAt(task, now)
  const stopped = state.status === 'failed' || state.status === 'cancelled'
  // How far it went, in percent: a failure stops at the restore, a cancel where it was
  const reached = state.status === 'queued' ? -1 : state.status === 'failed' ? FAIL_AT : progressAt(task, task.cancelledAt ?? now)
  const duration = DURATION[task.type]
  const iso = (p) => new Date(task.startedAt + 1500 + (p / 100) * duration).toISOString()

  const phase = (name, from, to, subs = []) => {
    let s
    if (reached < from || reached < 0) s = stopped ? 'skipped' : 'pending'
    else if (reached >= to && !(stopped && reached === to && to < 100)) s = 'done'
    else s = state.status === 'failed' ? 'failed' : state.status === 'cancelled' ? 'cancelled' : 'running'
    const until = s === 'done' ? to : s === 'failed' || s === 'cancelled' ? reached : null
    return {
      name,
      state: s,
      started: reached >= from ? iso(from) : null,
      ended: until === null ? null : iso(until),
      dur: until === null ? null : Math.round(((until - from) / 100) * duration) / 1000,
      subs,
    }
  }
  const names = PHASES[task.type]
  const width = 100 / names.length
  const steps = names.map((name, i) => {
    const from = i * width
    const subs = (SUBS[name] ?? []).map((sub, j, all) => phase(sub, from + (j * width) / all.length, from + ((j + 1) * width) / all.length))
    return phase(name, from, from + width, subs)
  })
  return later({ task: task.id, state: state.status, steps }, 80)
}
