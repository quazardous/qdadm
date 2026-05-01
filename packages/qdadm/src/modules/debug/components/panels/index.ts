/**
 * Debug Panel Components — qdadm.
 *
 * Admin-specific panels live here; generic panels (Entries, Signals, Toasts)
 * are re-exported from `@quazardous/qddebug` to preserve qdadm's public API.
 */

// Admin-specific panels
export { default as ZonesPanel } from './ZonesPanel.vue'
export { default as AuthPanel } from './AuthPanel.vue'
export { default as EntitiesPanel } from './EntitiesPanel.vue'
export { default as RouterPanel } from './RouterPanel.vue'
export { default as I18nPanel } from './I18nPanel.vue'

// Generic panels — re-exported from qddebug (single source of truth)
export { EntriesPanel, SignalsPanel, ToastsPanel } from '@quazardous/qddebug'
