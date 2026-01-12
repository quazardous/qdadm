/**
 * Shared reactive store for the unsaved changes guard dialog
 *
 * This store allows child components (forms) to register their guard dialog,
 * and parent components (AppLayout) to render it.
 */

import { shallowRef, type ShallowRef, type Ref } from 'vue'

/**
 * Guard dialog interface
 * Compatible with GuardDialogState from useUnsavedChangesGuard
 */
export interface GuardDialog {
  visible: Ref<boolean>
  saving?: Ref<boolean>
  message?: string
  hasOnSave?: boolean
  onSaveAndLeave?: () => Promise<void>
  onLeave?: () => void
  onStay?: () => void
  onConfirm?: () => void
  onCancel?: () => void
}

// Shared reactive state
const currentGuardDialog: ShallowRef<GuardDialog | null> = shallowRef(null)

/**
 * Register a guard dialog (called by useBareForm)
 * @param guardDialog - The guardDialog object from useUnsavedChangesGuard
 */
export function registerGuardDialog(guardDialog: GuardDialog): void {
  currentGuardDialog.value = guardDialog
}

/**
 * Unregister the current guard dialog (called on form unmount)
 * @param guardDialog - The guardDialog to unregister (only unregisters if it matches)
 */
export function unregisterGuardDialog(guardDialog: GuardDialog): void {
  if (currentGuardDialog.value === guardDialog) {
    currentGuardDialog.value = null
  }
}

/**
 * Get the current guard dialog ref (used by AppLayout)
 * @returns The reactive guard dialog reference
 */
export function useGuardDialog(): ShallowRef<GuardDialog | null> {
  return currentGuardDialog
}
