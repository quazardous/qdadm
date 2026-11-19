/**
 * The delete confirmations close on Escape without accepting (#2269).
 *
 * Run: npm test
 */
import { describe, it, expect, vi } from 'vitest'
import { requireDeleteConfirmation } from '../../src/composables/confirmDelete'

describe('requireDeleteConfirmation (#2269)', () => {
  it('asks a danger confirmation that Escape closes, and accepts nothing by itself', () => {
    const confirm = { require: vi.fn() }
    const accept = vi.fn()

    requireDeleteConfirmation(confirm, (_key, fallback) => fallback, { message: 'Delete book "Dune"?', header: 'Confirm Delete', accept })

    expect(confirm.require).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Delete book "Dune"?',
      header: 'Confirm Delete',
      icon: 'pi pi-exclamation-triangle',
      acceptClass: 'p-button-danger',
      closeOnEscape: true,
      accept,
    }))
    expect(accept).not.toHaveBeenCalled()
  })

  it("names its buttons by what they do, in the app's language (#5323)", () => {
    const confirm = { require: vi.fn() }
    const fr = { 'core.actions.delete': 'Supprimer', 'core.actions.cancel': 'Annuler' }
    requireDeleteConfirmation(confirm, (key, fallback) => fr[key] ?? fallback, { message: 'm', header: 'h', accept: vi.fn() })
    expect(confirm.require).toHaveBeenCalledWith(expect.objectContaining({ acceptLabel: 'Supprimer', rejectLabel: 'Annuler' }))
  })
})
