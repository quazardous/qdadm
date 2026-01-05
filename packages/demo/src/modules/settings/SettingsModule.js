/**
 * Settings Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, storage)
 * - Routes (read-only list)
 * - Navigation
 *
 * Demonstrates MemoryStorage (volatile - data lost on page refresh).
 */

import { Module, MemoryStorage } from 'qdadm'

// ============================================================================
// STORAGE
// ============================================================================

const settingsStorage = new MemoryStorage({
  initialData: [
    { id: 'theme', key: 'theme', value: 'light', type: 'string' },
    { id: 'language', key: 'language', value: 'en', type: 'string' },
    { id: 'pageSize', key: 'pageSize', value: '20', type: 'number' }
  ]
})

// ============================================================================
// MODULE
// ============================================================================

export class SettingsModule extends Module {
  static name = 'settings'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('settings', {
      name: 'settings',
      labelField: 'key',
      fields: {
        id: { type: 'text', label: 'ID', readOnly: true },
        key: { type: 'text', label: 'Key', required: true },
        value: { type: 'text', label: 'Value', required: true },
        type: {
          type: 'select',
          label: 'Type',
          options: [
            { label: 'String', value: 'string' },
            { label: 'Number', value: 'number' },
            { label: 'Boolean', value: 'boolean' }
          ],
          default: 'string'
        }
      },
      storage: settingsStorage
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (list only - read-only entity)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('settings', {
      list: () => import('./pages/SettingsPage.vue')
    }, {
      nav: { section: 'Memory Storage', icon: 'pi pi-cog' }
    })
  }
}

export default SettingsModule
