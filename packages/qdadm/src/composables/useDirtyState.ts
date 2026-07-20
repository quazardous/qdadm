/**
 * Composable for tracking form dirty state
 *
 * Usage:
 * const { dirty, dirtyFields, isFieldDirty, takeSnapshot, checkDirty } = useDirtyState(() => ({
 *   form: formData.value
 * }))
 *
 * // Take snapshot after loading data
 * takeSnapshot()
 *
 * // Watch for changes
 * watch(formData, checkDirty, { deep: true })
 *
 * // Check if specific field is dirty
 * isFieldDirty('username')  // true/false
 *
 * // Get all dirty field names
 * dirtyFields.value  // ['username', 'email']
 */

import { ref, nextTick, type Ref } from 'vue'

/**
 * State getter function type
 */
export type StateGetter<T = Record<string, unknown>> = () => T

/**
 * Form state type with optional form/formData keys
 */
export interface FormState {
  form?: Record<string, unknown>
  formData?: Record<string, unknown>
  [key: string]: unknown
}

/**
 * Return type for useDirtyState
 */
export interface UseDirtyStateReturn {
  dirty: Ref<boolean>
  dirtyFields: Ref<string[]>
  ready: Ref<boolean>
  takeSnapshot: () => void
  checkDirty: () => void
  isFieldDirty: (fieldName: string) => boolean
  reset: () => void
}

export function useDirtyState<T extends FormState = FormState>(
  getState: StateGetter<T>
): UseDirtyStateReturn {
  const dirty = ref(false)
  const dirtyFields = ref<string[]>([])
  const initialSnapshot = ref<string | null>(null)
  // Per-key snapshot strings, precomputed once at takeSnapshot() (#1194):
  // checkDirty runs on every keystroke (deep watch) — re-stringifying the
  // initial side each time doubled the per-key work, and the old
  // JSON.parse(JSON.stringify(state)) deep clone tripled the snapshot cost.
  let initialFieldSnapshots: Map<string, string> | null = null
  // Parsed deep copy of the initial form, kept for path-aware isFieldDirty
  // (#1396). Built once per snapshot; the per-keystroke checkDirty path
  // (#1194) never touches it.
  let initialForm: Record<string, unknown> | null = null
  const ready = ref(false)

  /** Resolve the form object inside the state (common 'form'/'formData' patterns). */
  function resolveForm(state: T): Record<string, unknown> {
    return (
      (state.form as Record<string, unknown>) ||
      (state.formData as Record<string, unknown>) ||
      (state as Record<string, unknown>)
    )
  }

  /** Stable stringify — JSON.stringify(undefined) is undefined, normalize it. */
  function stringifyField(value: unknown): string {
    const s = JSON.stringify(value)
    return s === undefined ? 'undefined' : s
  }

  /** Resolve a dot path ('config.login') in an object, undefined-safe. */
  function getByPath(obj: unknown, path: string): unknown {
    let cur: unknown = obj
    for (const seg of path.split('.')) {
      if (cur === null || cur === undefined || typeof cur !== 'object') return undefined
      cur = (cur as Record<string, unknown>)[seg]
    }
    return cur
  }

  function getFormSnapshot(): string {
    return JSON.stringify(getState())
  }

  function takeSnapshot(): void {
    // Disable dirty checking temporarily to prevent watchers from re-setting dirty
    ready.value = false
    dirty.value = false
    dirtyFields.value = []

    // Use nextTick to ensure all reactive updates have settled for snapshot
    nextTick(() => {
      const state = getState()
      initialSnapshot.value = JSON.stringify(state)
      const form = resolveForm(state)
      const fieldSnapshots = new Map<string, string>()
      for (const key in form) {
        fieldSnapshots.set(key, stringifyField(form[key]))
      }
      initialFieldSnapshots = fieldSnapshots
      initialForm = JSON.parse(JSON.stringify(form)) as Record<string, unknown>
      ready.value = true
    })
  }

  function checkDirty(): void {
    // Don't check until snapshot is taken and ready
    if (!ready.value || !initialSnapshot.value) return

    const currentSnapshot = getFormSnapshot()
    dirty.value = currentSnapshot !== initialSnapshot.value

    // Calculate dirty fields — current side only is stringified; the
    // initial side comes from the cached per-key snapshots (#1194).
    if (dirty.value && initialFieldSnapshots) {
      const currentForm = resolveForm(getState())
      const changed: string[] = []

      for (const key in currentForm) {
        const currentVal = stringifyField(currentForm[key])
        if (initialFieldSnapshots.get(key) !== currentVal) {
          changed.push(key)
        }
      }
      dirtyFields.value = changed
    } else {
      dirtyFields.value = []
    }
  }

  function isFieldDirty(fieldName: string): boolean {
    // Dot-free names: exact historical behavior.
    if (!fieldName.includes('.')) {
      return dirtyFields.value.includes(fieldName)
    }
    // Path-aware (#1396): a sub-field can only be dirty if its ROOT key is —
    // the pre-filter reuses the per-key work checkDirty already did, and
    // reading dirtyFields keeps the same reactive trigger as flat names.
    const root = fieldName.slice(0, fieldName.indexOf('.'))
    if (!dirtyFields.value.includes(root)) return false
    if (!initialForm) return false
    const currentForm = resolveForm(getState())
    return (
      stringifyField(getByPath(currentForm, fieldName)) !==
      stringifyField(getByPath(initialForm, fieldName))
    )
  }

  function reset(): void {
    dirty.value = false
    dirtyFields.value = []
    initialSnapshot.value = null
    initialFieldSnapshots = null
    initialForm = null
    ready.value = false
  }

  return {
    dirty,
    dirtyFields,
    ready,
    takeSnapshot,
    checkDirty,
    isFieldDirty,
    reset,
  }
}

export default useDirtyState
