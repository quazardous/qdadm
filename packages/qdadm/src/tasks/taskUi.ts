/**
 * How the TaskRunner looks (#4334): the follow dialog's window options, slot
 * components, a replacement dialog, the tray's row, and what its log flags as
 * an error or a timestamp (#4386). Layered: qdadm's
 * defaults, then the app's (configureTasks), then the task kind's
 * (registerTaskKind / run options), then a page's own TaskDialog props.
 *
 *   configureTasks({ dialog: { width: '56rem', modal: false }, slots: { 'after-log': DeliverySummary } })
 *   registerTaskKind('deploy', { task, log, dialog: { maximizable: false }, component: DeployDialog })
 *   registerTaskKind('deliver', { task, log, logPatterns: { errorPattern: /\[error\]|^→ failed/ } })
 */
import { shallowReactive, type Component } from 'vue'

export interface TaskDialogOptions {
  width?: string
  modal?: boolean
  /** Move by the title bar */
  draggable?: boolean
  /** Resize by the corner */
  resizable?: boolean
  /** A full-screen button; Escape leaves full screen first */
  maximizable?: boolean
  /** Where it opens (PrimeVue Dialog position) */
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right' | 'topleft' | 'topright' | 'bottomleft' | 'bottomright'
  /** Extra class on the dialog */
  class?: string
  /** Keep size, position and full screen in localStorage, per app */
  rememberLayout?: boolean
}

/** The TaskDialog slots an app fills with components; each gets `{ run, kind, final }`. */
export type TaskDialogSlotName = 'header' | 'before-log' | 'after-log' | 'actions' | 'result'

/** The follow dialog's log (LogStream): a string is a case-insensitive pattern; null turns it off. */
export interface TaskLogPatterns {
  /** The lines flagged as errors, and counted by the "N errors" button */
  errorPattern?: RegExp | string | null
  /** The timestamp at the start of a line, shown dimmed */
  timestampPattern?: RegExp | string | null
}

export interface TaskUiOptions {
  dialog?: TaskDialogOptions
  logPatterns?: TaskLogPatterns
  slots?: Partial<Record<TaskDialogSlotName, Component>>
  /**
   * Renders instead of TaskDialog, with props `{ runId, options }` and a
   * `close` event; it reads the run through getTaskStore().
   */
  component?: Component
  tray?: {
    /** Replaces a tray row's content; gets `{ run }` */
    item?: Component
  }
}

export const TASK_DIALOG_DEFAULTS: Required<Omit<TaskDialogOptions, 'position' | 'class'>> & Pick<TaskDialogOptions, 'position' | 'class'> = {
  width: '46rem',
  modal: true,
  draggable: true,
  resizable: true,
  maximizable: true,
  rememberLayout: true,
  position: undefined,
  class: undefined,
}

// Whole words only, so a file name such as shipping_error.php is not an error
export const TASK_LOG_DEFAULTS: Required<TaskLogPatterns> = {
  errorPattern: /\b(error|fatal|failed)\b/i,
  timestampPattern: null,
}

const app = shallowReactive<TaskUiOptions>({})

/** The app's TaskRunner look, once at boot. Later calls merge over earlier ones. */
export function configureTasks(options: TaskUiOptions): void {
  if (options.dialog) app.dialog = { ...app.dialog, ...options.dialog }
  if (options.slots) app.slots = { ...app.slots, ...options.slots }
  if (options.logPatterns) app.logPatterns = { ...app.logPatterns, ...options.logPatterns }
  if (options.component !== undefined) app.component = options.component
  if (options.tray) app.tray = { ...app.tray, ...options.tray }
}

/** For tests: back to qdadm's defaults. */
export function resetTaskUi(): void {
  delete app.dialog
  delete app.slots
  delete app.logPatterns
  delete app.component
  delete app.tray
}

/** The app's options (reactive). */
export function getTaskUi(): Readonly<TaskUiOptions> {
  return app
}

/** One run's look: defaults, then the app's, then the kind's, then a page's props. */
export function resolveTaskUi(kind?: TaskUiOptions | null, page?: TaskDialogOptions | null) {
  const strip = <T extends object>(o?: T | null) => Object.fromEntries(Object.entries(o ?? {}).filter(([, v]) => v !== undefined)) as T
  return {
    dialog: { ...TASK_DIALOG_DEFAULTS, ...strip(app.dialog), ...strip(kind?.dialog), ...strip(page) },
    // null is kept: it turns a pattern off
    logPatterns: { ...TASK_LOG_DEFAULTS, ...strip(app.logPatterns), ...strip(kind?.logPatterns) } as Required<TaskLogPatterns>,
    slots: { ...app.slots, ...kind?.slots } as Partial<Record<TaskDialogSlotName, Component>>,
    component: kind?.component ?? app.component ?? null,
  }
}
