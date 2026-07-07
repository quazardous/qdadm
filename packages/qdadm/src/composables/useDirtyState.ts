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
    return dirtyFields.value.includes(fieldName)
  }

  function reset(): void {
    dirty.value = false
    dirtyFields.value = []
    initialSnapshot.value = null
    initialFieldSnapshots = null
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
