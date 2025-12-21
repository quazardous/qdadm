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

import { ref, nextTick } from 'vue'

export function useDirtyState(getState) {
  const dirty = ref(false)
  const dirtyFields = ref([])
  const initialSnapshot = ref(null)
  const initialState = ref(null)
  const ready = ref(false)

  function getFormSnapshot() {
    return JSON.stringify(getState())
  }

  function takeSnapshot() {
    // Disable dirty checking temporarily to prevent watchers from re-setting dirty
    ready.value = false
    dirty.value = false
    dirtyFields.value = []

    // Use nextTick to ensure all reactive updates have settled for snapshot
    nextTick(() => {
      const state = getState()
      initialSnapshot.value = JSON.stringify(state)
      // Store raw state for field-level comparison
      initialState.value = JSON.parse(JSON.stringify(state))
      ready.value = true
    })
  }

  function checkDirty() {
    // Don't check until snapshot is taken and ready
    if (!ready.value || !initialSnapshot.value) return

    const currentSnapshot = getFormSnapshot()
    dirty.value = currentSnapshot !== initialSnapshot.value

    // Calculate dirty fields
    if (dirty.value && initialState.value) {
      const current = getState()
      const changed = []

      // Compare form fields if state has a 'form' or 'formData' key (common patterns)
      const initial = initialState.value.form || initialState.value.formData || initialState.value
      const currentForm = current.form || current.formData || current

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

  function isFieldDirty(fieldName) {
    return dirtyFields.value.includes(fieldName)
  }

  function reset() {
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
    reset
  }
}

export default useDirtyState
