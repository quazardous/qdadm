/**
 * Countries Module - Module System v2 Implementation
 *
 * Class-based module for REST Countries API integration.
 */

import { Module } from 'qdadm'

export class CountriesModule extends Module {
  static name = 'countries'
  static requires = []
  static priority = 0

  async connect(ctx) {
    ctx.routes('countries', [
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

    ctx.navItem({
      section: 'REST Countries',
      route: 'country',
      icon: 'pi pi-globe',
      label: 'Countries'
    })

    ctx.routeFamily('country', ['country-'])
  }
}

export default CountriesModule
