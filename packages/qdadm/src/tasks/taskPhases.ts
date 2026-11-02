/**
 * A task's phases (#4655): the steps a worker goes through (status, preview,
 * wait for the crons, deliver, back up), each with its state and timing,
 * shown as a frieze above the follow dialog's log.
 *
 * The shape is the one a worker reports, e.g. `GET /v1/tasks/{id}/phases`:
 *
 *   { state: 'running', steps: [
 *     { name: 'status', state: 'done', started: '…', ended: '…', dur: 1.2, subs: [] },
 *     { name: 'deploy', state: 'running', started: '…', ended: null, dur: null,
 *       subs: [{ name: 'deploy.wait-crons', state: 'done', started: '…', ended: '…', dur: 63 }] },
 *     { name: 'backup-after', state: 'pending', started: null, ended: null, dur: null, subs: [] },
 *   ] }
 *
 *   registerTaskKind('deliver', { task, log, phases: (id) => api.get(`/v1/tasks/${id}/phases`).then((r) => r.data) })
 */
import type { LogLine } from '../composables/useLogStream'

export type TaskPhaseState = 'pending' | 'running' | 'done' | 'failed' | 'cancelled' | 'skipped'

export interface TaskPhase {
  /** The step's name; a sub-phase's is usually prefixed by its step's (`deploy.wait-crons`). */
  name: string
  state: TaskPhaseState
  /** ISO times */
  started?: string | null
  ended?: string | null
  /** Duration in seconds, once ended */
  dur?: number | null
  subs?: TaskPhase[]
}

export interface TaskPhasesData {
  state?: string
  result?: unknown
  steps: TaskPhase[]
}

/** The phases of a kind or a run: fixed, or read from the backend while the run lasts. */
export type TaskPhasesSource =
  | TaskPhasesData
  | TaskPhase[]
  | ((taskId: string | number) => Promise<TaskPhasesData | TaskPhase[]> | TaskPhasesData | TaskPhase[])

/** The icon of each state, when the app gives none for the phase. */
export const TASK_PHASE_STATE_ICONS: Record<TaskPhaseState, string> = {
  pending: 'pi pi-circle',
  running: 'pi pi-spin pi-spinner',
  done: 'pi pi-check-circle',
  failed: 'pi pi-times-circle',
  cancelled: 'pi pi-ban',
  skipped: 'pi pi-minus-circle',
}

/** The steps, from either shape. */
export function phaseSteps(phases: TaskPhasesData | TaskPhase[] | null | undefined): TaskPhase[] {
  if (!phases) return []
  return Array.isArray(phases) ? phases : (phases.steps ?? [])
}

/**
 * A phase's label: `phase.<name>` in the app's catalogue, else the name. A
 * sub-phase also tries its last segment (`phase.wait-crons`), and falls back
 * to that segment.
 */
export function phaseLabel(tOr: (key: string, fallback: string) => string, name: string, sub = false): string {
  if (!sub) return tOr(`phase.${name}`, name)
  const last = name.slice(name.lastIndexOf('.') + 1)
  return tOr(`phase.${name}`, last === name ? name : tOr(`phase.${last}`, last))
}

/** A duration in seconds, short: "1.2 s", "12 s", "1 min 3 s", "1 h 2 min". */
export function formatPhaseDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return ''
  if (seconds < 10) return `${Math.round(seconds * 10) / 10} s`
  const s = Math.round(seconds)
  if (s < 60) return `${s} s`
  if (s < 3600) return `${Math.floor(s / 60)} min ${s % 60} s`
  return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`
}

/**
 * The log lines of a phase. A step's lines carry its name in `step`. A
 * sub-phase's lines carry their step's: they are the ones from its start
 * marker (`phase: { event: 'start', name }`) through its end marker, or up to
 * the last line while it runs.
 */
export function linesOfPhase(lines: LogLine[], name: string): LogLine[] {
  const prefix = `${name}.`
  const ofStep = lines.filter((l) => l.step === name || (l.step?.startsWith(prefix) ?? false))
  if (ofStep.length) return ofStep
  const out: LogLine[] = []
  let inside = false
  for (const line of lines) {
    if (line.phase?.name === name && line.phase.event === 'start') inside = true
    if (inside) out.push(line)
    if (line.phase?.name === name && line.phase.event === 'end') inside = false
  }
  return out
}

/** The phases a log has start markers for: the sub-phases it can be filtered on. */
export function phasesMarkedIn(lines: LogLine[]): Set<string> {
  const out = new Set<string>()
  for (const line of lines) if (line.phase?.event === 'start') out.add(line.phase.name)
  return out
}
