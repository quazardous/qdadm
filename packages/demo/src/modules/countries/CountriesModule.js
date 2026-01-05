/**
 * Countries Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, custom storage)
 * - Routes (list + detail)
 * - Navigation
 *
 * Demonstrates external API integration (REST Countries API).
 * Custom storage handles pagination and search.
 */

import { Module, ApiStorage } from 'qdadm'
import axios from 'axios'

// ============================================================================
// STORAGE
// ============================================================================

const restCountriesClient = axios.create({
  baseURL: 'https://restcountries.com'
})

/**
 * REST Countries API storage
 *
 * Returns all 250 countries, client-side pagination.
 */
class RestCountriesStorage extends ApiStorage {
  constructor(options = {}) {
    super({ ...options, idField: 'cca3' })
  }

  async list(params = {}) {
    const { page = 1, page_size = 20, search } = params
    const fields = 'name,cca3,capital,region,population,flag,flags'

    const response = await this.client.get(this.endpoint, { params: { fields } })
    let items = response.data

    if (search) {
      const term = search.toLowerCase()
      items = items.filter(c =>
        c.name?.common?.toLowerCase().includes(term) ||
        c.cca3?.toLowerCase().includes(term) ||
        c.region?.toLowerCase().includes(term) ||
        c.capital?.some(cap => cap.toLowerCase().includes(term))
      )
    }

    const total = items.length
    const start = (page - 1) * page_size
    return { items: items.slice(start, start + page_size), total }
  }

  async get(id) {
    const fields = 'name,cca3,capital,region,population,flag,flags'
    const response = await this.client.get(`/v3.1/alpha/${id}`, { params: { fields } })
    return Array.isArray(response.data) ? response.data[0] : response.data
  }
}

const countriesStorage = new RestCountriesStorage({
  endpoint: '/v3.1/all',
  client: restCountriesClient
})

// ============================================================================
// MODULE
// ============================================================================

export class CountriesModule extends Module {
  static name = 'countries'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('countries', {
      name: 'countries',
      labelField: (country) => country.name?.common || country.cca3,
      idField: 'cca3',
      readOnly: true,
      localFilterThreshold: 0,
      fields: {
        cca3: { type: 'text', label: 'Code', readOnly: true },
        name: { type: 'object', label: 'Name', readOnly: true },
        capital: { type: 'array', label: 'Capital', readOnly: true },
        region: { type: 'text', label: 'Region', readOnly: true },
        population: { type: 'number', label: 'Population', readOnly: true },
        flag: { type: 'text', label: 'Flag', readOnly: true }
      },
      storage: countriesStorage
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (list + detail - read-only)
    // ════════════════════════════════════════════════════════════════════════
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

    // Navigation
    ctx.navItem({
      section: 'REST Countries',
      route: 'country',
      icon: 'pi pi-globe',
      label: 'Countries'
    })

    // Route family
    ctx.routeFamily('country', ['country-'])
  }
}

export default CountriesModule
