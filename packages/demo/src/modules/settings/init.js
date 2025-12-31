/**
 * Settings Module - MemoryStorage Demo
 *
 * Demonstrates volatile storage with MemoryStorage.
 * Data is lost on page refresh - stored only in memory.
 * Entity (settings) is defined in main.js with EntityManager.
 */

export function init({ registry }) {

  // ============ ROUTES ============
  registry.addRoutes('settings', [
    {
      path: '',
      name: 'setting',
      component: () => import('./pages/SettingsPage.vue'),
      meta: { layout: 'list' }
    }
  ], { entity: 'settings' })

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'Memory Storage',
    route: 'setting',
    icon: 'pi pi-cog',
    label: 'Settings'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('setting', ['setting-'])
}
