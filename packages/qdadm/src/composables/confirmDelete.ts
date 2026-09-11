/**
 * The delete confirmations of the list, form and show pages (#2269).
 *
 * PrimeVue's ConfirmDialog closes on Escape only when the confirmation itself says so. Escape hides the
 * dialog: `accept` never runs, so nothing is deleted.
 */

export interface DeleteConfirmation {
  message: string
  header: string
  accept: () => void
}

/** The part of PrimeVue's confirm service a delete confirmation uses. */
export interface ConfirmRequire {
  require: (options: {
    message: string
    header: string
    icon: string
    acceptClass?: string
    closeOnEscape?: boolean
    accept: () => void
  }) => void
}

export function requireDeleteConfirmation(confirm: ConfirmRequire, { message, header, accept }: DeleteConfirmation): void {
  confirm.require({
    message,
    header,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    closeOnEscape: true,
    accept,
  })
}
