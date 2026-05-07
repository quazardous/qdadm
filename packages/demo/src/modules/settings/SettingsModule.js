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

import { Module, MemoryStorage } from '@quazardous/qdadm'

// ============================================================================
// STORAGE
// ============================================================================

const settingsStorage = new MemoryStorage({
  initialData: [
    { id: 'theme', key: 'theme', value: 'light', type: 'string' },
    { id: 'language', key: 'language', value: 'en', type: 'string' },
    { id: 'pageSize', key: 'pageSize', value: '20', type: 'number' },
    { id: 'rateLimits', key: 'rateLimits', value: JSON.stringify({ 'jobs:create': 60, 'jobs:read': 200, 'files:write': 20 }), type: 'json' },
    { id: 'features', key: 'features', value: JSON.stringify({ darkMode: true, notifications: false, maxRetries: 3 }), type: 'json' },
    { id: 'uiConfig', key: 'uiConfig', value: JSON.stringify({ primary: '#10b981', radius: 8, dark: false }), type: 'json-structured' }
  ]
})

// ============================================================================
// MODULE
// ============================================================================

export class SettingsModule extends Module {
  static moduleName = 'settings'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // I18N
    // ════════════════════════════════════════════════════════════════════════
    ctx.messages('en', {
      entities: {
        settings: {
          label: 'Setting',
          labelPlural: 'Settings',
          fields: {
            key: 'Key',
            value: 'Value',
            type: {
              _label: 'Type',
              options: {
                string: 'String',
                number: 'Number',
                boolean: 'Boolean',
                json: 'JSON',
                'json-structured': 'JSON (structured)',
              },
            },
          },
        },
      },
      nav: {
        sections: { 'Memory Storage': 'Memory Storage' },
        routes: { setting: 'Settings' },
      },
    })
    ctx.messages('fr', {
      entities: {
        settings: {
          label: 'Paramètre',
          labelPlural: 'Paramètres',
          fields: {
            key: 'Clé',
            value: 'Valeur',
            type: {
              _label: 'Type',
              options: {
                string: 'Chaîne',
                number: 'Nombre',
                boolean: 'Booléen',
                json: 'JSON',
                'json-structured': 'JSON (structuré)',
              },
            },
          },
        },
      },
      nav: {
        sections: { 'Memory Storage': 'Stockage en mémoire' },
        routes: { setting: 'Paramètres' },
      },
    })

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
            { label: 'Boolean', value: 'boolean' },
            { label: 'JSON', value: 'json' },
            { label: 'JSON (structured)', value: 'json-structured' }
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
      list: () => import('./pages/SettingsPage.vue'),
      form: () => import('./pages/SettingsEditPage.vue')
    }, {
      nav: { section: 'Memory Storage', icon: 'pi pi-cog' }
    })
  }
}

export default SettingsModule
