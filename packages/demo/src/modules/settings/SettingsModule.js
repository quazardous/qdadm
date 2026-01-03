/**
 * Settings Module (v2) - MemoryStorage Demo
 *
 * Demonstrates volatile storage with MemoryStorage.
 * Data is lost on page refresh - stored only in memory.
 * Entity (settings) is defined in main.js with EntityManager.
 */

import { Module } from 'qdadm'

export class SettingsModule extends Module {
  static name = 'settings'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ============ ROUTES ============
    ctx.routes('settings', [
      {
        path: '',
        name: 'setting',
        component: () => import('./pages/SettingsPage.vue'),
        meta: { layout: 'list' }
      }
    ], { entity: 'settings' })

    // ============ NAVIGATION ============
    ctx.navItem({
      section: 'Memory Storage',
      route: 'setting',
      icon: 'pi pi-cog',
      label: 'Settings'
    })

    // ============ ROUTE FAMILY ============
    ctx.routeFamily('setting', ['setting-'])
  }
}

export default SettingsModule
