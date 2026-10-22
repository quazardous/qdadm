/**
 * Task store - long backend tasks, queued and followed to the end (#4114)
 *
 * An action whose handler queues a task on a worker (create a box, refresh a
 * database, run a scenario) must neither block the screen nor be
 * fire-and-forget. `run()` starts it, then follows the task record until it
 * ends: through live entities when the task entity is live, by polling
 * otherwise, both when both are there (the poll is then the slow fallback).
 *
 * One store per page load, at module level: the tray in the layout, the
 * dialog, and every action that starts a task share it, whatever component
 * they live in. Runs of a registered kind survive a reload (sessionStorage).
 */

import { reactive, computed, type ComputedRef } from 'vue'
import type { LogSource } from '../composables/useLogStream'

export type TaskStatus = 'starting' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

type Reader<T> = string | ((record: Record<string, unknown>) => T)

/** How to read the task record. */
export interface TaskFollow {
  /** The task entity: read through its manager, and followed live if it is live. */
  entity?: string
  /** Or read it yourself. */
  get?: (taskId: string | number) => Promise<unknown>
  /** Field or reader of the status. Default `status`. */
  status?: Reader<unknown>
  /** Backend values to statuses, on top of the usual names (done, error, in_progress…). */
  statusMap?: Record<string, Exclude<TaskStatus, 'starting'>>
  /** Percent, 0–100. Default field `progress`. */
  progress?: Reader<unknown>
  /** The current step, shown under the bar. Default field `step`. */
  step?: Reader<unknown>
  /** What a finished task produced. Default field `result`. */
  result?: Reader<unknown>
  /** Why it failed. Default field `error`. */
  error?: Reader<unknown>
  /** Poll interval, ms. Default 2000, or 10 000 as a fallback when the entity is live. */
  intervalMs?: number
}

/** What a kind of task shares, whatever starts it: registered once, it lets runs resume after a reload. */
export interface TaskKind {
  label?: string
  task: TaskFollow
  /** Cancel the task on the backend. Without it, no cancel button. */
  cancel?: (taskId: string | number) => Promise<unknown>
  /** The task's log, shown live in the dialog (LogStream). */
  log?: (taskId: string | number) => LogSource
  /** Where the task's own page is (a vue-router location). */
  to?: (taskId: string | number) => unknown
  /** Toast when it ends. Default true. */
  notify?: boolean
  /** Called once the run ends, whatever the outcome (read `run.status`). */
  onSettled?: (run: TaskRun) => void
}

export interface TaskConfirm {
  message?: string
  /** The user must type this (a box name, an environment) before the task starts. */
  typed?: string
  /** Label of the confirm button. */
  accept?: string
  /** Severity of the confirm button. Default `danger` when `typed` is set, `primary` otherwise. */
  severity?: 'primary' | 'secondary' | 'success' | 'info' | 'warn' | 'danger' | 'contrast'
}

export interface RunOptions extends Partial<TaskKind> {
  label: string
  /** Queue the task; returns its id, or `{ task_id | taskId | id }`. */
  start: () => Promise<unknown>
  /** A registered kind; its settings are the defaults of this run, and the run resumes after a reload. */
  kind?: string
  confirm?: TaskConfirm
  /** Open the follow dialog at once. Default true. */
  open?: boolean
}

export interface TaskRun {
  id: string
  kind: string | null
  label: string
  taskId: string | number | null
  status: TaskStatus
  progress: number | null
  step: string | null
  result: unknown
  error: string | null
  startedAt: number
  endedAt: number | null
  cancelling: boolean
  /** Settles with the run once it ends: succeeded, failed or cancelled (it never rejects). */
  finished: Promise<TaskRun>
}

interface TaskHostDeps {
  orchestrator?: {
    get: (name: string) => unknown
    toast?: Record<'success' | 'error' | 'warn' | 'info', (summary: string, detail?: string, options?: unknown) => void>
  } | null
  signals?: { on: (name: string, handler: (event: { data: unknown }) => void) => () => void } | null
}

interface PendingConfirm {
  label: string
  confirm: TaskConfirm
  resolve: (ok: boolean) => void
}

const FINAL: TaskStatus[] = ['succeeded', 'failed', 'cancelled']
const STORAGE_KEY = 'qdadm:tasks'
const KEEP_FINISHED = 20

const USUAL: Record<string, Exclude<TaskStatus, 'starting'>> = {
  queued: 'queued', pending: 'queued', waiting: 'queued', scheduled: 'queued', new: 'queued',
  running: 'running', started: 'running', in_progress: 'running', processing: 'running', active: 'running',
  succeeded: 'succeeded', success: 'succeeded', done: 'succeeded', completed: 'succeeded', finished: 'succeeded', ok: 'succeeded',
  failed: 'failed', failure: 'failed', error: 'failed', errored: 'failed',
  cancelled: 'cancelled', canceled: 'cancelled', aborted: 'cancelled', killed: 'cancelled',
}

let seq = 0

function read<T>(record: Record<string, unknown>, reader: Reader<T> | undefined, fallback: string): unknown {
  if (typeof reader === 'function') return reader(record)
  return record[reader ?? fallback]
}

function taskIdOf(started: unknown): string | number | null {
  if (typeof started === 'string' || typeof started === 'number') return started
  if (started && typeof started === 'object') {
    const o = started as Record<string, unknown>
    const id = o.task_id ?? o.taskId ?? o.id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return null
}

function errorText(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message)
  return err === null || err === undefined ? '' : JSON.stringify(err)
}

function createTaskStore() {
  const state = reactive({
    runs: [] as TaskRun[],
    openId: null as string | null,
    pendingConfirm: null as PendingConfirm | null,
    hosts: 0,
  })
  const kinds = new Map<string, TaskKind>()
  const defs = new Map<string, TaskKind>()
  const stops = new Map<string, () => void>()
  const pokes = new Map<string, () => void>()
  const settles = new Map<string, (run: TaskRun) => void>()
  let deps: TaskHostDeps = {}
  let restored = false

  // --- Persistence: runs of a registered kind come back after a reload ---

  function persist(): void {
    try {
      const saved = state.runs
        .filter((r) => r.kind && kinds.has(r.kind) && r.taskId !== null && !FINAL.includes(r.status))
        .map((r) => ({ id: r.id, kind: r.kind, label: r.label, taskId: r.taskId, startedAt: r.startedAt }))
      if (saved.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // no storage (private mode, tests): runs just do not survive a reload
    }
  }

  function restore(): void {
    if (restored) return
    restored = true
    let saved: Array<Pick<TaskRun, 'id' | 'kind' | 'label' | 'taskId' | 'startedAt'>> = []
    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    } catch {
      return
    }
    for (const s of saved) {
      const kind = s.kind ? kinds.get(s.kind) : undefined
      if (!kind || s.taskId === null || state.runs.some((r) => r.id === s.id)) continue
      const run = addRun({ id: s.id, kind: s.kind, label: s.label, taskId: s.taskId, status: 'running', startedAt: s.startedAt })
      defs.set(run.id, kind)
      follow(run.id)
    }
  }

  // --- Runs ---

  function addRun(partial: Partial<TaskRun> & Pick<TaskRun, 'label'>): TaskRun {
    const id = partial.id ?? `task-${Date.now().toString(36)}-${++seq}`
    const run: TaskRun = {
      id,
      kind: partial.kind ?? null,
      label: partial.label,
      taskId: partial.taskId ?? null,
      status: partial.status ?? 'starting',
      progress: null,
      step: null,
      result: null,
      error: null,
      startedAt: partial.startedAt ?? Date.now(),
      endedAt: null,
      cancelling: false,
      // A promise is not made reactive: run.finished stays the raw promise.
      finished: new Promise<TaskRun>((resolve) => settles.set(id, resolve)),
    }
    state.runs.unshift(run)
    // Keep every active run, and the most recent finished ones.
    const finished = state.runs.filter((r) => FINAL.includes(r.status))
    for (const old of finished.slice(KEEP_FINISHED)) dismiss(old.id)
    return state.runs.find((r) => r.id === run.id)!
  }

  const find = (id: string) => state.runs.find((r) => r.id === id)

  function finish(id: string, status: TaskStatus, error: string | null = null): void {
    const run = find(id)
    if (!run || FINAL.includes(run.status)) return
    run.status = status
    run.endedAt = Date.now()
    run.cancelling = false
    if (error) run.error = error
    stops.get(id)?.()
    stops.delete(id)
    pokes.delete(id)
    persist()
    notifyEnd(run)
    settles.get(id)?.(run)
    settles.delete(id)
    try {
      defs.get(id)?.onSettled?.(run)
    } catch (err) {
      console.error(`[qdadm] Task "${run.label}": onSettled threw`, err)
    }
  }

  function notifyEnd(run: TaskRun): void {
    const def = defs.get(run.id)
    if (def?.notify === false) return
    const toast = deps.orchestrator?.toast
    if (!toast) return
    const to = def?.to && run.taskId !== null ? def.to(run.taskId) : undefined
    const opts = { emitter: 'TaskRunner', ...(to ? { to } : {}) }
    if (run.status === 'succeeded') toast.success(run.label, run.step ?? undefined, opts)
    else if (run.status === 'failed') toast.error(run.label, run.error ?? undefined, { ...opts, keep: 'long' })
    else if (run.status === 'cancelled') toast.warn(run.label, undefined, opts)
  }

  /** Read the task record once and apply it to the run. */
  async function refresh(id: string): Promise<void> {
    const run = find(id)
    const def = defs.get(id)
    if (!run || !def || run.taskId === null) return
    const f = def.task
    let record: unknown
    if (f.get) record = await f.get(run.taskId)
    else if (f.entity && deps.orchestrator) {
      const manager = deps.orchestrator.get(f.entity) as { get: (id: unknown, ctx?: unknown, o?: unknown) => Promise<unknown> }
      record = await manager.get(run.taskId, undefined, { listCache: false })
    } else throw new Error(`TaskRunner: "${run.label}" has neither task.get nor a task.entity with an orchestrator`)
    const r = (record ?? {}) as Record<string, unknown>
    const current = find(id)
    if (!current || FINAL.includes(current.status)) return

    const raw = read(r, f.status, 'status')
    const key = String(raw ?? '').toLowerCase()
    const status = f.statusMap?.[String(raw)] ?? f.statusMap?.[key] ?? USUAL[key] ?? 'running'
    const progress = Number(read(r, f.progress, 'progress'))
    current.progress = Number.isFinite(progress) && read(r, f.progress, 'progress') !== null ? Math.max(0, Math.min(100, progress)) : null
    const step = read(r, f.step, 'step')
    current.step = step === null || step === undefined || step === '' ? null : String(step)
    current.result = read(r, f.result, 'result') ?? null
    const err = read(r, f.error, 'error')
    if (err) current.error = errorText(err)
    if (FINAL.includes(status)) finish(id, status)
    else current.status = status
  }

  /** Poll until the run ends; a live event on its record reads it at once. */
  function follow(id: string): void {
    const run = find(id)
    const def = defs.get(id)
    if (!run || !def) return
    const live = !!(def.task.entity && deps.signals)
    const base = def.task.intervalMs ?? (live ? 10_000 : 2000)
    let delay = base
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false
    let busy = false
    let again = false

    const tick = async () => {
      if (stopped) return
      if (busy) {
        again = true
        return
      }
      busy = true
      if (timer) clearTimeout(timer)
      try {
        await refresh(id)
        delay = base
      } catch (err) {
        const r = find(id)
        if (r) r.error = errorText(err)
        delay = Math.min(delay * 2, 30_000)
      } finally {
        busy = false
      }
      if (stopped || FINAL.includes(find(id)?.status ?? 'failed')) return
      if (again) {
        again = false
        void tick()
        return
      }
      timer = setTimeout(tick, delay)
    }

    let off: (() => void) | null = null
    if (live) {
      off = deps.signals!.on('entity:data-invalidate', (event) => {
        const p = (event.data ?? {}) as { entity?: string; id?: unknown }
        if (p.entity !== def.task.entity) return
        if (p.id !== undefined && String(p.id) !== String(find(id)?.taskId)) return
        void tick()
      })
    }
    stops.set(id, () => {
      stopped = true
      if (timer) clearTimeout(timer)
      off?.()
    })
    pokes.set(id, () => void tick())
    void tick()
  }

  // --- Public ---

  function registerTaskKind(name: string, kind: TaskKind): void {
    kinds.set(name, kind)
  }

  function requestConfirm(label: string, confirm: TaskConfirm): Promise<boolean> {
    if (state.hosts === 0) {
      console.warn(`[qdadm] Task "${label}" asks for a confirmation, but no TaskHost is mounted (AppLayout mounts one). Not started.`)
      return Promise.resolve(false)
    }
    state.pendingConfirm?.resolve(false)
    return new Promise((resolve) => {
      state.pendingConfirm = { label, confirm, resolve }
    })
  }

  function answerConfirm(ok: boolean): void {
    const pending = state.pendingConfirm
    state.pendingConfirm = null
    pending?.resolve(ok)
  }

  /**
   * Start a task and follow it. Resolves with the run once the task has
   * started (queued), NOT when it ends, or with null when the confirmation
   * was declined. The run moves on in the store: await `run.finished` (or
   * pass `onSettled`) for its outcome.
   */
  async function run(options: RunOptions): Promise<TaskRun | null> {
    const base = options.kind ? kinds.get(options.kind) : undefined
    if (options.kind && !base && !options.task) {
      throw new Error(`TaskRunner: unknown task kind "${options.kind}"`)
    }
    const def: TaskKind = { ...base, ...options, task: { ...base?.task, ...options.task } } as TaskKind
    if (options.confirm && !(await requestConfirm(options.label, options.confirm))) return null

    const r = addRun({ label: options.label, kind: options.kind ?? null })
    defs.set(r.id, def)
    if (options.open !== false) state.openId = r.id
    try {
      const taskId = taskIdOf(await options.start())
      if (taskId === null) throw new Error('the start handler returned no task id')
      const current = find(r.id)!
      current.taskId = taskId
      current.status = 'queued'
      persist()
      follow(r.id)
    } catch (err) {
      finish(r.id, 'failed', errorText(err))
    }
    return find(r.id) ?? null
  }

  async function cancel(id: string): Promise<void> {
    const r = find(id)
    const def = defs.get(id)
    if (!r || !def?.cancel || r.taskId === null || FINAL.includes(r.status)) return
    r.cancelling = true
    try {
      await def.cancel(r.taskId)
      pokes.get(id)?.()
    } catch (err) {
      r.cancelling = false
      r.error = errorText(err)
    }
  }

  function dismiss(id: string): void {
    stops.get(id)?.()
    stops.delete(id)
    pokes.delete(id)
    defs.delete(id)
    settles.delete(id)
    const i = state.runs.findIndex((r) => r.id === id)
    if (i !== -1) state.runs.splice(i, 1)
    if (state.openId === id) state.openId = null
    persist()
  }

  function clearFinished(): void {
    for (const r of state.runs.filter((x) => FINAL.includes(x.status))) dismiss(r.id)
  }

  /** Wire the orchestrator (manager reads, toasts) and the signal bus (live). Called by useTaskRunner. */
  function attach(next: TaskHostDeps): void {
    if (next.orchestrator) deps.orchestrator = next.orchestrator
    if (next.signals) deps.signals = next.signals
    restore()
  }

  const active: ComputedRef<TaskRun[]> = computed(() => state.runs.filter((r) => !FINAL.includes(r.status)))

  return {
    state,
    active,
    run,
    cancel,
    dismiss,
    clearFinished,
    open: (id: string | null) => (state.openId = id),
    /** Read the run's task record now, instead of at the next poll (a log that just ended, a page that knows better). */
    poke: (id: string) => pokes.get(id)?.(),
    registerTaskKind,
    answerConfirm,
    attach,
    definition: (id: string) => defs.get(id),
    isFinal: (status: TaskStatus) => FINAL.includes(status),
    /** For tests: stop everything and forget every run. */
    reset(): void {
      for (const stop of stops.values()) stop()
      stops.clear()
      pokes.clear()
      settles.clear()
      defs.clear()
      kinds.clear()
      state.runs.splice(0)
      state.openId = null
      state.pendingConfirm = null
      state.hosts = 0
      deps = {}
      restored = false
    },
  }
}

export type TaskStore = ReturnType<typeof createTaskStore>

let store: TaskStore | null = null

export function getTaskStore(): TaskStore {
  return (store ??= createTaskStore())
}

/** Register a kind of task, typically in a module's connect(): its runs then resume after a reload. */
export function registerTaskKind(name: string, kind: TaskKind): void {
  getTaskStore().registerTaskKind(name, kind)
}
