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

import type { TaskDialogOptions, TaskLogPatterns, TaskUiOptions } from './taskUi'
import { reactive, computed, type ComputedRef } from 'vue'
import type { LogSource } from '../composables/useLogStream'
import type { TaskPhasesSource } from './taskPhases'

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
  /** The follow dialog's window options for this kind, over the app's (#4334). */
  dialog?: TaskDialogOptions
  /** What the log flags as an error or a timestamp for this kind, over the app's (#4386). */
  logPatterns?: TaskLogPatterns
  /**
   * The task's phases, shown as a frieze above the log (#4655): fixed, or read
   * from the backend at the log's pace while the run lasts, then once at its end.
   */
  phases?: TaskPhasesSource
  /** An icon class per phase name, over the app's. */
  phaseIcons?: Record<string, string>
  /** Slot components for this kind's dialog, over the app's. */
  slots?: TaskUiOptions['slots']
  /** A dialog of its own for this kind, instead of TaskDialog. */
  component?: TaskUiOptions['component']
  /**
   * Start a task of this kind from its meta alone. With it, `run({ kind, meta })`
   * needs no `start`, and a sequence of such kinds goes on after a reload (#4934).
   */
  start?: (meta: Record<string, unknown> | null) => Promise<unknown>
  /** A run's line in a sequence's list (#4934). Default: the error, else the step. */
  summary?: (run: TaskRun) => string | null | undefined
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

export interface RunOptions extends Omit<Partial<TaskKind>, 'label' | 'start'> {
  /** A string, or a function read each time it shows (tray, dialog, toast), so it follows the locale (#4692) */
  label: string | (() => string)
  /**
   * Queue the task; returns its id, or `{ task_id | taskId | id }`. In a
   * sequence it gets the previous step's run (#4934). Optional when the kind
   * has a `start`.
   */
  start?: (previous: TaskRun | null) => Promise<unknown>
  /** A registered kind; its settings are the defaults of this run, and the run resumes after a reload. */
  kind?: string
  confirm?: TaskConfirm
  /** Open the follow dialog at once. Default true. */
  open?: boolean
  /**
   * What the run is about, for a page to find it again: `{ supplierId: 7 }`.
   * Kept with the run, across a reload too (#4687). Plain values only.
   */
  meta?: Record<string, unknown>
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
  /** What the run is about, as given to run() (#4687) */
  meta: Record<string, unknown> | null
  /** The sequence this run is a step of, or null (#4934) */
  sequenceId: string | null
  /** Settles with the run once it ends: succeeded, failed or cancelled (it never rejects). */
  finished: Promise<TaskRun>
}

/** A step of a sequence: run options, or a function of the previous step's run that returns them (#4934). */
export type SequenceStep = RunOptions | ((previous: TaskRun | null) => RunOptions)

export interface SequenceOptions {
  /** A failure stops the steps that follow (they show "not run"). Default true. */
  stopOnError?: boolean
  /** Open the sequence's window at once. Default true. */
  open?: boolean
  /** Asked once, before the first step. */
  confirm?: TaskConfirm
  /** What the sequence is about, for a page to find it again (sequenceFor). Plain values only. */
  meta?: Record<string, unknown>
  /** One toast when it ends. Default true. */
  notify?: boolean
  /** Called once the sequence ends. */
  onSettled?: (sequence: TaskSequence) => void
}

/** A step that has no run: waiting its turn, or never run (and why). */
export type SequenceStepStatus = TaskStatus | 'pending' | 'skipped'

export interface TaskSequenceStep {
  /** The run's label once started, else the declared one ("Step 2" for a step given as a function) */
  label: string
  runId: string | null
  /** The state recorded: pending, skipped, or the run's once it ended. Live: `store.stepStatus(step)` */
  status: SequenceStepStatus
  /** Why a step was not run: an earlier step failed, the sequence was cancelled, the page was reloaded */
  skipped: 'error' | 'cancelled' | 'reload' | null
}

export interface TaskSequence {
  id: string
  label: string
  status: 'running' | 'succeeded' | 'failed' | 'cancelled'
  steps: TaskSequenceStep[]
  /** The index of the step running, or of the last one run */
  current: number
  stopOnError: boolean
  cancelling: boolean
  startedAt: number
  endedAt: number | null
  meta: Record<string, unknown> | null
  /** Settles with the sequence once it ends (it never rejects). */
  finished: Promise<TaskSequence>
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
const SEQUENCES_KEY = 'qdadm:task-sequences'
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
    /** Runs chained in one window (#4934) */
    sequences: [] as TaskSequence[],
    /** The run or the sequence whose window is open */
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
        .map((r) => ({ id: r.id, kind: r.kind, label: r.label, taskId: r.taskId, startedAt: r.startedAt, meta: r.meta, sequenceId: r.sequenceId }))
      if (saved.length) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
      else sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // no storage (private mode, tests): runs just do not survive a reload
    }
  }

  function restore(): void {
    if (restored) return
    restored = true
    let saved: Array<Pick<TaskRun, 'id' | 'kind' | 'label' | 'taskId' | 'startedAt'> & { meta?: TaskRun['meta']; sequenceId?: string | null }> = []
    try {
      saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    } catch {
      return
    }
    for (const s of saved) {
      const kind = s.kind ? kinds.get(s.kind) : undefined
      if (!kind || s.taskId === null || state.runs.some((r) => r.id === s.id)) continue
      const run = addRun({ id: s.id, kind: s.kind, label: s.label, taskId: s.taskId, status: 'running', startedAt: s.startedAt, meta: s.meta ?? null, sequenceId: s.sequenceId ?? null })
      // A step of a sequence: the sequence gives the one toast
      defs.set(run.id, s.sequenceId ? { ...kind, notify: false } : kind)
      follow(run.id)
    }
    restoreSequences()
  }

  // --- Runs ---

  function addRun(partial: Partial<TaskRun> & Pick<TaskRun, 'label'>, labelOf?: () => string): TaskRun {
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
      meta: partial.meta ?? null,
      sequenceId: partial.sequenceId ?? null,
      // A promise is not made reactive: run.finished stays the raw promise.
      finished: new Promise<TaskRun>((resolve) => settles.set(id, resolve)),
    }
    // A label given as a function is read each time it shows (#4692)
    if (labelOf) Object.defineProperty(run, 'label', { get: labelOf, enumerable: true, configurable: true })
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
    return startRun(options, {})
  }

  async function startRun(options: RunOptions, ctx: { previous?: TaskRun | null; sequenceId?: string }): Promise<TaskRun | null> {
    const base = options.kind ? kinds.get(options.kind) : undefined
    if (options.kind && !base && !options.task) {
      throw new Error(`TaskRunner: unknown task kind "${options.kind}"`)
    }
    const def: TaskKind = { ...base, ...options, task: { ...base?.task, ...options.task } } as TaskKind
    const labelOf = typeof options.label === 'function' ? options.label : undefined
    const label = labelOf ? labelOf() : (options.label as string)
    const meta = options.meta ? { ...options.meta } : null
    const start = options.start
      ? () => options.start!(ctx.previous ?? null)
      : base?.start
        ? () => base.start!(meta)
        : null
    if (!start) throw new Error(`TaskRunner: "${label}" has no start, and its kind none either`)
    if (options.confirm && !(await requestConfirm(label, options.confirm))) return null

    const r = addRun({ label, kind: options.kind ?? null, meta, sequenceId: ctx.sequenceId ?? null }, labelOf)
    defs.set(r.id, def)
    if (options.open !== false) state.openId = r.id
    try {
      const taskId = taskIdOf(await start())
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
    for (const x of state.sequences.filter((x) => x.status !== 'running')) dismissSequence(x.id)
  }

  /** Wire the orchestrator (manager reads, toasts) and the signal bus (live). Called by useTaskRunner. */
  function attach(next: TaskHostDeps): void {
    if (next.orchestrator) deps.orchestrator = next.orchestrator
    if (next.signals) deps.signals = next.signals
    restore()
  }

  const active: ComputedRef<TaskRun[]> = computed(() => state.runs.filter((r) => !FINAL.includes(r.status)))

  // --- Sequences: runs chained in one window (#4934) ---

  interface SequenceInternals {
    /** Each step's options; null for a step that cannot start again after a reload */
    specs: Array<SequenceStep | null>
    options: SequenceOptions
    /** One step only: it is a plain run, with its own window and toast */
    single: boolean
    settle: (sequence: TaskSequence) => void
  }
  const sequenceInternals = new Map<string, SequenceInternals>()
  let sequenceSeq = 0

  const findSequence = (id: string) => state.sequences.find((s) => s.id === id)

  /** A step's state: its run's while the run is in the store, else what was recorded */
  function stepStatus(step: TaskSequenceStep): SequenceStepStatus {
    const run = step.runId ? find(step.runId) : undefined
    return run?.status ?? step.status ?? 'pending'
  }

  /** What the list shows on a step's line: the kind's summary, else the error, else the step reached */
  function stepSummary(step: TaskSequenceStep): string | null {
    const run = step.runId ? find(step.runId) : undefined
    if (!run) return null
    const custom = defs.get(run.id)?.summary
    if (custom) {
      try {
        const text = custom(run)
        if (text !== undefined) return text
      } catch (err) {
        console.error(`[qdadm] Task "${run.label}": summary threw`, err)
      }
    }
    if (run.status === 'failed') return run.error
    if (run.status === 'succeeded' && run.result !== null && typeof run.result !== 'object') return String(run.result)
    return run.step
  }

  const declaredLabel = (spec: SequenceStep | null | undefined): string | (() => string) =>
    !spec || typeof spec === 'function' ? '' : spec.label

  function addSequence(
    partial: Pick<TaskSequence, 'label' | 'stopOnError' | 'meta'> & Partial<Pick<TaskSequence, 'id' | 'startedAt' | 'current' | 'cancelling'>>,
    steps: Array<{ label: string | (() => string); runId?: string | null; status?: SequenceStepStatus; skipped?: TaskSequenceStep['skipped'] }>,
    internals: Omit<SequenceInternals, 'settle'>,
    labelOf?: () => string
  ): TaskSequence {
    const id = partial.id ?? `seq-${Date.now().toString(36)}-${++sequenceSeq}`
    let settle!: (sequence: TaskSequence) => void
    const sequence: TaskSequence = {
      id,
      label: partial.label,
      status: 'running',
      steps: steps.map((st) => {
        const declared = st.label
        return {
          runId: st.runId ?? null,
          status: st.status ?? 'pending',
          skipped: st.skipped ?? null,
          // The run's label once started (it follows the locale), else the declared one
          get label(): string {
            const run = this.runId ? find(this.runId) : undefined
            if (run) return run.label
            return typeof declared === 'function' ? declared() : declared
          },
        } as TaskSequenceStep
      }),
      current: partial.current ?? 0,
      stopOnError: partial.stopOnError,
      cancelling: partial.cancelling ?? false,
      startedAt: partial.startedAt ?? Date.now(),
      endedAt: null,
      meta: partial.meta,
      finished: new Promise<TaskSequence>((resolve) => (settle = resolve)),
    }
    if (labelOf) Object.defineProperty(sequence, 'label', { get: labelOf, enumerable: true, configurable: true })
    sequenceInternals.set(id, { ...internals, settle })
    state.sequences.unshift(sequence)
    const finished = state.sequences.filter((x) => FINAL.includes(x.status as TaskStatus))
    for (const old of finished.slice(KEEP_FINISHED)) dismissSequence(old.id)
    return findSequence(id)!
  }

  function persistSequences(): void {
    try {
      const saved = state.sequences
        .filter((x) => x.status === 'running' && !sequenceInternals.get(x.id)?.single)
        .map((x) => {
          const specs = sequenceInternals.get(x.id)?.specs ?? []
          return {
            id: x.id,
            label: x.label,
            meta: x.meta,
            stopOnError: x.stopOnError,
            startedAt: x.startedAt,
            current: x.current,
            cancelling: x.cancelling,
            steps: x.steps.map((st, i) => {
              const spec = specs[i]
              const plain = spec && typeof spec !== 'function' ? spec : null
              return { label: st.label, runId: st.runId, status: stepStatus(st), skipped: st.skipped, kind: plain?.kind ?? null, meta: plain?.meta ?? null }
            }),
          }
        })
      if (saved.length) sessionStorage.setItem(SEQUENCES_KEY, JSON.stringify(saved))
      else sessionStorage.removeItem(SEQUENCES_KEY)
    } catch {
      // no storage: a sequence does not survive a reload
    }
  }

  /** A sequence that was running before a reload: its running step was restored with the runs; the steps after it start again when their kind can */
  function restoreSequences(): void {
    type Saved = Pick<TaskSequence, 'id' | 'label' | 'meta' | 'stopOnError' | 'startedAt' | 'current' | 'cancelling'> & {
      steps: Array<{ label: string; runId: string | null; status: SequenceStepStatus; skipped: TaskSequenceStep['skipped']; kind: string | null; meta: Record<string, unknown> | null }>
    }
    let saved: Saved[] = []
    try {
      saved = JSON.parse(sessionStorage.getItem(SEQUENCES_KEY) ?? '[]')
    } catch {
      return
    }
    for (const x of saved) {
      if (findSequence(x.id)) continue
      const specs = x.steps.map((st) => {
        const kind = st.kind ? kinds.get(st.kind) : undefined
        return kind?.start ? ({ kind: st.kind!, label: st.label, meta: st.meta ?? undefined } as RunOptions) : null
      })
      const steps = x.steps.map((st) => ({
        label: st.label,
        // A run that is not back (its kind is not registered) cannot be followed
        runId: st.runId && find(st.runId) ? st.runId : null,
        status: st.runId && !find(st.runId) && !FINAL.includes(st.status as TaskStatus) ? ('skipped' as const) : st.status,
        skipped: st.runId && !find(st.runId) && !FINAL.includes(st.status as TaskStatus) ? ('reload' as const) : st.skipped,
      }))
      const sequence = addSequence(x, steps, { specs, options: {}, single: false })
      const current = sequence.steps[sequence.current]
      const previous = current?.runId ? find(current.runId) ?? null : null
      void drive(sequence.id, previous)
    }
  }

  function skipFrom(sequence: TaskSequence, index: number, why: NonNullable<TaskSequenceStep['skipped']>): void {
    for (const step of sequence.steps.slice(index)) {
      if (step.runId) continue
      step.status = 'skipped'
      step.skipped = why
    }
  }

  /** Run the steps one after another, from the sequence's current one */
  async function drive(id: string, previous: TaskRun | null): Promise<void> {
    const internals = sequenceInternals.get(id)
    if (!internals) return
    let failed = false
    for (let i = findSequence(id)?.current ?? 0; i < (findSequence(id)?.steps.length ?? 0); i++) {
      const sequence = findSequence(id)
      if (!sequence) return
      const step = sequence.steps[i]!
      if (step.status === 'skipped') continue
      if (step.runId && FINAL.includes(stepStatus(step) as TaskStatus)) {
        // Already over before a reload
        failed ||= stepStatus(step) === 'failed'
        continue
      }
      if (sequence.cancelling) {
        skipFrom(sequence, i, 'cancelled')
        break
      }
      if (failed && sequence.stopOnError) {
        skipFrom(sequence, i, 'error')
        break
      }
      sequence.current = i
      let run: TaskRun | null = step.runId ? find(step.runId) ?? null : null
      if (!run) {
        const spec = internals.specs[i]
        if (!spec) {
          skipFrom(sequence, i, 'reload')
          break
        }
        let options: RunOptions
        try {
          options = typeof spec === 'function' ? spec(previous) : spec
        } catch (err) {
          options = { label: step.label || `#${i + 1}`, start: () => Promise.reject(err), task: {} }
        }
        const stepOptions: RunOptions = {
          ...options,
          confirm: undefined,
          open: internals.single ? internals.options.open !== false : false,
          ...(internals.single ? {} : { notify: false }),
        }
        try {
          run = await startRun(stepOptions, { previous, sequenceId: id })
        } catch (err) {
          run = await startRun({ label: options.label, start: () => Promise.reject(err), task: {}, open: false, notify: internals.single ? undefined : false }, { sequenceId: id })
        }
        if (!run) break
        step.runId = run.id
        persistSequences()
      }
      const end = await run.finished
      step.status = end.status
      if (end.status === 'failed') failed = true
      if (end.status === 'cancelled') findSequence(id)!.cancelling = true
      previous = end
      persistSequences()
    }
    finishSequence(id)
  }

  function finishSequence(id: string): void {
    const sequence = findSequence(id)
    const internals = sequenceInternals.get(id)
    if (!sequence || !internals || sequence.status !== 'running') return
    const statuses = sequence.steps.map((st) => stepStatus(st))
    sequence.status = statuses.includes('failed')
      ? 'failed'
      : statuses.some((st) => st === 'cancelled' || st === 'skipped')
        ? 'cancelled'
        : 'succeeded'
    sequence.endedAt = Date.now()
    sequence.cancelling = false
    persistSequences()
    if (!internals.single && internals.options.notify !== false) notifySequenceEnd(sequence)
    internals.settle(sequence)
    try {
      internals.options.onSettled?.(sequence)
    } catch (err) {
      console.error(`[qdadm] Task sequence "${sequence.label}": onSettled threw`, err)
    }
  }

  const MARKS: Partial<Record<SequenceStepStatus, string>> = { succeeded: '✓', failed: '✗', cancelled: '⊘', skipped: '–' }

  /** One toast for the whole sequence: each step marked, the failure's error after it */
  function notifySequenceEnd(sequence: TaskSequence): void {
    const toast = deps.orchestrator?.toast
    if (!toast) return
    const detail = sequence.steps
      .map((st, i) => {
        const status = stepStatus(st)
        const label = st.label || `#${i + 1}`
        const error = status === 'failed' && st.runId ? find(st.runId)?.error : null
        return `${MARKS[status] ?? '…'} ${label}${error ? `: ${error}` : ''}`
      })
      .join(' · ')
    const opts = { emitter: 'TaskRunner' }
    if (sequence.status === 'succeeded') toast.success(sequence.label, detail, opts)
    else if (sequence.status === 'failed') toast.error(sequence.label, detail, { ...opts, keep: 'long' })
    else toast.warn(sequence.label, detail, opts)
  }

  /**
   * Run tasks one after another, followed in one window: the list of steps,
   * each step's detail on a click (#4934). Resolves once the sequence is
   * under way (null when its confirmation is declined); await
   * `sequence.finished` for its end. One step only is a plain run.
   */
  async function sequence(
    label: string | (() => string),
    steps: SequenceStep[],
    options: SequenceOptions = {}
  ): Promise<TaskSequence | null> {
    if (!steps.length) throw new Error('TaskRunner: a sequence needs at least one step')
    const labelOf = typeof label === 'function' ? label : undefined
    const text = labelOf ? labelOf() : (label as string)
    if (options.confirm && !(await requestConfirm(text, options.confirm))) return null
    const single = steps.length === 1
    const created = addSequence(
      { label: text, stopOnError: options.stopOnError !== false, meta: options.meta ? { ...options.meta } : null },
      steps.map((spec) => ({ label: declaredLabel(spec) })),
      { specs: steps.slice(), options, single },
      labelOf
    )
    if (!single && options.open !== false) state.openId = created.id
    void drive(created.id, null)
    return created
  }

  /** Stop a sequence: its running step is cancelled when its kind can, and the steps after it are not run. */
  async function cancelSequence(id: string): Promise<void> {
    const sequence = findSequence(id)
    if (!sequence || sequence.status !== 'running') return
    sequence.cancelling = true
    persistSequences()
    const runId = sequence.steps[sequence.current]?.runId
    if (runId) await cancel(runId)
  }

  function dismissSequence(id: string): void {
    const i = state.sequences.findIndex((x) => x.id === id)
    if (i !== -1) state.sequences.splice(i, 1)
    sequenceInternals.delete(id)
    if (state.openId === id) state.openId = null
    persistSequences()
  }

  /** The sequences matching a meta (each given key equal), newest first. */
  function sequencesFor(meta: Record<string, unknown> = {}): TaskSequence[] {
    return state.sequences
      .filter((x) => Object.entries(meta).every(([k, v]) => x.meta?.[k] === v))
      .sort((a, b) => b.startedAt - a.startedAt)
  }

  // --- Finding a run again (#4687) ---

  /** The runs matching a kind and/or a meta (each given key equal), newest first. */
  function runsFor(filter: { kind?: string; taskId?: string | number; meta?: Record<string, unknown> } = {}): TaskRun[] {
    return state.runs
      .filter((r) =>
        (filter.kind === undefined || r.kind === filter.kind) &&
        (filter.taskId === undefined || String(r.taskId) === String(filter.taskId)) &&
        Object.entries(filter.meta ?? {}).every(([k, v]) => r.meta?.[k] === v)
      )
      .sort((a, b) => b.startedAt - a.startedAt)
  }

  /** The latest run of a kind about one record: `runFor('stock-check', { supplierId: 7 })`, or by task id. */
  function runFor(kind: string, about: Record<string, unknown> | string | number): TaskRun | null {
    const filter = typeof about === 'object' ? { kind, meta: about } : { kind, taskId: about }
    return runsFor(filter)[0] ?? null
  }

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
    runFor,
    runsFor,
    isFinal: (status: TaskStatus | SequenceStepStatus | TaskSequence['status']) => FINAL.includes(status as TaskStatus),
    /** A run or a sequence still going (#4695, #4934) */
    isActive: (run: TaskRun | TaskSequence | null | undefined) => !!run && !FINAL.includes(run.status as TaskStatus),
    sequence,
    cancelSequence,
    dismissSequence,
    /** The sequence a run is a step of, or a sequence by its id */
    sequenceOf: (id: string | null | undefined): TaskSequence | null =>
      !id ? null : (findSequence(id) ?? (find(id)?.sequenceId ? findSequence(find(id)!.sequenceId!) ?? null : null)),
    sequencesFor,
    /** The latest sequence about a record: `sequenceFor({ box: 'b1' })` */
    sequenceFor: (meta: Record<string, unknown>) => sequencesFor(meta)[0] ?? null,
    stepStatus,
    stepSummary,
    /** For tests: stop everything and forget every run. */
    reset(): void {
      for (const stop of stops.values()) stop()
      stops.clear()
      pokes.clear()
      settles.clear()
      defs.clear()
      kinds.clear()
      state.runs.splice(0)
      state.sequences.splice(0)
      sequenceInternals.clear()
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
