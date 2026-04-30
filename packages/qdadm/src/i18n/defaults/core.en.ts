/**
 * Default English bundle for `core.*` keys shipped by qdadm.
 *
 * Projects can override these by declaring `ctx.messages('en', { core: {...} })`
 * (last-merge-wins) or by passing `i18n.disableDefaultCoreBundle: true` to
 * the kernel and supplying their own.
 */

import type { MessagesBundle } from '../types'

export const coreEn: MessagesBundle = {
  core: {
    actions: {
      save: 'Save',
      cancel: 'Cancel',
      delete: 'Delete',
      edit: 'Edit',
      create: 'Create',
      add: 'Add',
      remove: 'Remove',
      submit: 'Submit',
      reset: 'Reset',
      back: 'Back',
      next: 'Next',
      previous: 'Previous',
      close: 'Close',
      confirm: 'Confirm',
      search: 'Search',
      filter: 'Filter',
      clear: 'Clear',
      refresh: 'Refresh',
      export: 'Export',
      import: 'Import',
    },
    fields: {
      id: 'ID',
      created_at: 'Created at',
      updated_at: 'Updated at',
      created_by: 'Created by',
      updated_by: 'Updated by',
    },
    messages: {
      empty: 'No items',
      loading: 'Loading…',
      noResults: 'No results',
      saved: 'Saved',
      deleted: 'Deleted',
      created: 'Created',
      updated: 'Updated',
      confirmDelete: 'Are you sure you want to delete this item?',
    },
    errors: {
      required: 'Required',
      tooShort: 'Too short (min {min})',
      tooLong: 'Too long (max {max})',
      invalid: 'Invalid value',
      notFound: 'Not found',
      unknown: 'An unknown error occurred',
    },
  },
}
