/**
 * Countries Module - REST Countries API Integration
 *
 * Read-only country listing from REST Countries API.
 * Features:
 * - Client-side pagination (API returns full dataset)
 * - Search by name, code, region, capital
 * - Country detail view with full information
 * - Flag emoji display
 */

export function init({ registry }) {

  // ============ ROUTES ============
  registry.addRoutes('countries', [
    {
      path: '',
      name: 'country',
      component: () => import('./pages/CountriesPage.vue'),
      meta: { layout: 'list' }
    },
    {
      path: ':id',
      name: 'country-show',
      component: () => import('./pages/CountryDetailPage.vue'),
      meta: { layout: 'form' }
    }
  ], { entity: 'countries' })

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'REST Countries',
    route: 'country',
    icon: 'pi pi-globe',
    label: 'Countries'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('country', ['country-'])
}
