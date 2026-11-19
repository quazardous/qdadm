/**
 * Composable for guarding against unsaved changes when leaving a page
 *
 * Usage:
 * const { dirty, takeSnapshot, checkDirty } = useDirtyState(...)
 * useUnsavedChangesGuard(dirty, {
 *   onSave: () => handleSubmit(false),
 *   message: 'You have unsaved changes.'
 * })
 */

import { onBeforeUnmount, ref, type Ref } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, type NavigationGuardNext } from 'vue-router'

/**
 * Guard dialog state
 */
export interface GuardDialogState {
  visible: Ref<boolean>
  saving: Ref<boolean>
  message: string
  hasOnSave: boolean
  onSaveAndLeave: () => Promise<void>
  onLeave: () => void
  onStay: () => void
}

/**
 * Options for useUnsavedChangesGuard
 */
export interface UseUnsavedChangesGuardOptions {
  /** Async function to save changes */
  onSave?: (() => Promise<void>) | null
  /** Custom message */
  message?: string
  /** Show native browser dialog on tab close (default: false) */
  browserGuard?: boolean
}

/**
 * Return type for useUnsavedChangesGuard
 */
export interface UseUnsavedChangesGuardReturn {
  dirty: Ref<boolean>
  guardDialog: GuardDialogState
}

/**
 * Guard against leaving page with unsaved changes
 *
 * Shows a dialog with up to 3 options:
 * - "Save & Leave" (if onSave provided) - saves then navigates
 * - "Leave" - navigates without saving (discards changes)
 * - "Stay" - cancels navigation
 *
 * @param dirty - Reactive dirty state
 * @param options - Options
 */
export function useUnsavedChangesGuard(
  dirty: Ref<boolean>,
  options: UseUnsavedChangesGuardOptions = {}
): UseUnsavedChangesGuardReturn {
  const {
    onSave = null,
    message = 'You have unsaved changes that will be lost.',
    browserGuard = false, // Disabled by default - use soft JS modal only
  } = options

  // State for custom dialog
  const showDialog = ref(false)
  const pendingNext = ref<NavigationGuardNext | null>(null)
  const saving = ref(false)

  // Browser beforeunload event (for closing tab/window) - optional
  function handleBeforeUnload(e: BeforeUnloadEvent): string | void {
    if (dirty.value) {
      e.preventDefault()
      e.returnValue = message
      return message
    }
  }

  // Add browser event listener only if browserGuard is enabled
  if (browserGuard && typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleBeforeUnload)
  }

  // Clean up on unmount
  onBeforeUnmount(() => {
    if (browserGuard && typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  })

  // Dialog actions
  async function handleSaveAndLeave(): Promise<void> {
    if (!onSave || !pendingNext.value) return

    saving.value = true
    try {
      await onSave()
      showDialog.value = false
      pendingNext.value()
      pendingNext.value = null
    } catch (e) {
      console.error('Save failed:', e)
      // Stay on page - don't close dialog, let user retry or choose Leave
    } finally {
      saving.value = false
    }
  }

  function handleLeave(): void {
    if (!pendingNext.value) return
    showDialog.value = false
    pendingNext.value()
    pendingNext.value = null
  }

  function handleStay(): void {
    showDialog.value = false
    if (pendingNext.value) {
      pendingNext.value(false)
      pendingNext.value = null
    }
  }

  // Vue Router navigation guard
  onBeforeRouteLeave((_to, _from, next) => {
    if (!dirty.value) {
      next()
      return
    }

    // Store the next callback and show dialog
    pendingNext.value = next
    showDialog.value = true
  })

  // The same page on another record (a run's next item, #5343) leaves this one too
  // (Guarded: a test mocking vue-router may not provide it)
  try {
    onBeforeRouteUpdate((to, from, next) => {
      const sameRecord = JSON.stringify(to.params) === JSON.stringify(from.params)
      if (sameRecord || !dirty.value) {
        next()
        return
      }
      pendingNext.value = next
      showDialog.value = true
    })
  } catch {
    // no router hook to register: nothing to guard
  }

  return {
    dirty,
    // Dialog state and handlers for custom dialog component
    guardDialog: {
      visible: showDialog,
      saving,
      message,
      hasOnSave: !!onSave,
      onSaveAndLeave: handleSaveAndLeave,
      onLeave: handleLeave,
      onStay: handleStay,
    },
  }
}

export default useUnsavedChangesGuard
