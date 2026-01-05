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
    // ROUTES (list only - no crud helper for read-only entities)
    // ════════════════════════════════════════════════════════════════════════
    ctx.routes('settings', [
      {
        path: '',
        name: 'setting',
        component: () => import('./pages/SettingsPage.vue'),
        meta: { layout: 'list' }
      }
    ], { entity: 'settings' })

    // Navigation
    ctx.navItem({
      section: 'Memory Storage',
      route: 'setting',
      icon: 'pi pi-cog',
      label: 'Settings'
    })

    // Route family
    ctx.routeFamily('setting', ['setting-'])
  }
}

export default SettingsModule
