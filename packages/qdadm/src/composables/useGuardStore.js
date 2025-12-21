/**
 * Shared reactive store for the unsaved changes guard dialog
 *
 * This store allows child components (forms) to register their guard dialog,
 * and parent components (AppLayout) to render it.
 */

import { ref, shallowRef } from 'vue'

// Shared reactive state
const currentGuardDialog = shallowRef(null)

/**
 * Register a guard dialog (called by useBareForm)
 * @param {Object} guardDialog - The guardDialog object from useUnsavedChangesGuard
 */
export function registerGuardDialog(guardDialog) {
  currentGuardDialog.value = guardDialog
}

/**
 * Unregister the current guard dialog (called on form unmount)
 * @param {Object} guardDialog - The guardDialog to unregister (only unregisters if it matches)
 */
export function unregisterGuardDialog(guardDialog) {
  if (currentGuardDialog.value === guardDialog) {
    currentGuardDialog.value = null
  }
}

/**
 * Get the current guard dialog ref (used by AppLayout)
 * @returns {ShallowRef} The reactive guard dialog reference
 */
export function useGuardDialog() {
  return currentGuardDialog
}
