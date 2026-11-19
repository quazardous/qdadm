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
    acceptLabel?: string
    rejectLabel?: string
    acceptIcon?: string
    rejectIcon?: string
    rejectClass?: string
    closeOnEscape?: boolean
    accept: () => void
  }) => void
}

/** The catalogue lookup of useI18n: a key, its English fallback */
export type TranslateOr = (key: string, fallback: string) => string

/**
 * The buttons say what they do, in the app's language (#5323): Delete / Cancel
 * from the catalogue, not PrimeVue's own Yes / No.
 */
export function requireDeleteConfirmation(confirm: ConfirmRequire, tOr: TranslateOr, { message, header, accept }: DeleteConfirmation): void {
  confirm.require({
    message,
    header,
    icon: 'pi pi-exclamation-triangle',
    acceptClass: 'p-button-danger',
    acceptLabel: tOr('core.actions.delete', 'Delete'),
    acceptIcon: 'pi pi-trash',
    rejectLabel: tOr('core.actions.cancel', 'Cancel'),
    rejectClass: 'p-button-secondary p-button-text',
    closeOnEscape: true,
    accept,
  })
}
