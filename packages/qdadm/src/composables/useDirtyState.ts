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
  const initialState = ref<T | null>(null)
  const ready = ref(false)

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
      // Store raw state for field-level comparison
      initialState.value = JSON.parse(JSON.stringify(state)) as T
      ready.value = true
    })
  }

  function checkDirty(): void {
    // Don't check until snapshot is taken and ready
    if (!ready.value || !initialSnapshot.value) return

    const currentSnapshot = getFormSnapshot()
    dirty.value = currentSnapshot !== initialSnapshot.value

    // Calculate dirty fields
    if (dirty.value && initialState.value) {
      const current = getState()
      const changed: string[] = []

      // Compare form fields if state has a 'form' or 'formData' key (common patterns)
      const initial =
        (initialState.value.form as Record<string, unknown>) ||
        (initialState.value.formData as Record<string, unknown>) ||
        (initialState.value as Record<string, unknown>)
      const currentForm =
        (current.form as Record<string, unknown>) ||
        (current.formData as Record<string, unknown>) ||
        (current as Record<string, unknown>)

      for (const key in currentForm) {
        const initialVal = JSON.stringify(initial[key])
        const currentVal = JSON.stringify(currentForm[key])
        if (initialVal !== currentVal) {
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
    initialState.value = null
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
