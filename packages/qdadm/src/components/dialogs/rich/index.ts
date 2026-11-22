/** The rich dialog (#5445) */
export { default as QdRichDialog } from './QdRichDialog.vue'
export { default as QdRichDialogHost } from './QdRichDialogHost.vue'
export { useRichDialog, openRichDialog } from './useRichDialog'
export { registerDialogContent, registerDialogControl, getDialogContent, getDialogControl } from './registry'
export { sanitizeHtml, renderMarkdown } from './render'
export type * from './types'
