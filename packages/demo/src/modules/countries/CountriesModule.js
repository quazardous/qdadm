/**
 * Countries Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, custom storage)
 * - Routes (list + detail)
 * - Navigation
 *
 * Data is a vendored ISO-country dataset (250 entries, mledoze/countries) —
 * the free REST Countries v3.1 API was shut down (legacy deprecation, the
 * v5 API requires a paid bearer token), so the demo ships its own fixture.
 * Custom storage handles pagination and search.
 */

import { Module, MemoryStorage, EntityManager, sortItems, paginate } from '@quazardous/qdadm'
import countriesFixture from '../../fixtures/countries.json'

// ============================================================================
// STORAGE
// ============================================================================

/**
 * Countries storage over the vendored fixture (250 countries).
 * Same list/search contract as the old REST Countries storage.
 */
class CountriesStorage extends MemoryStorage {
  async list(params = {}) {
    const { page = 1, page_size = 20, search, sort_by, sort_order = 'asc' } = params
    let items = countriesFixture

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
    // Server-side sort (#1222 — was silently ignored, like the dead REST
    // Countries storage it replaced); nulls last via the shared comparator.
    items = sortItems([...items], sort_by, sort_order)
    return { items: paginate(items, page, page_size), total }
  }

  async get(id) {
    return countriesFixture.find(c => c.cca3 === id) || null
  }
}

const countriesStorage = new CountriesStorage()

// ============================================================================
// MODULE
// ============================================================================

export class CountriesModule extends Module {
  static moduleName = 'countries'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // I18N
    // ════════════════════════════════════════════════════════════════════════
    ctx.messages('en', {
      entities: {
        countries: {
          label: 'Country',
          labelPlural: 'Countries',
          fields: {
            cca3: 'Code',
            name: 'Name',
            capital: 'Capital',
            region: 'Region',
            subregion: 'Subregion',
            area: 'Area (km²)',
            flag: 'Flag',
          },
        },
      },
      nav: {
        sections: { 'REST Countries': 'REST Countries' },
        routes: { country: 'Countries' },
      },
    })
    ctx.messages('fr', {
      entities: {
        countries: {
          label: 'Pays',
          labelPlural: 'Pays',
          fields: {
            cca3: 'Code',
            name: 'Nom',
            capital: 'Capitale',
            region: 'Région',
            subregion: 'Sous-région',
            area: 'Superficie (km²)',
            flag: 'Drapeau',
          },
        },
      },
      nav: {
        sections: { 'REST Countries': 'Pays (REST)' },
        routes: { country: 'Pays' },
      },
    })

    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('countries', new EntityManager({
      name: 'countries',
      labelField: (country) => country.name?.common || country.cca3,
      badges: (country) => {
        if (!country.region) return []
        const severity = {
          Africa: 'warn',
          Americas: 'info',
          Asia: 'danger',
          Europe: 'success',
          Oceania: 'contrast',
          Antarctic: 'secondary',
        }
        return [{ label: country.region, severity: severity[country.region] || 'secondary' }]
      },
      idField: 'cca3',
      readOnly: true,
      asymmetric: true, // list and get return different fields
      localFilterThreshold: 300,
      detailCacheTtlMs: 300000,
      fields: {
        cca3: { type: 'text', label: 'Code', readOnly: true },
        name: { type: 'object', label: 'Name', readOnly: true },
        capital: { type: 'array', label: 'Capital', readOnly: true },
        region: { type: 'text', label: 'Region', readOnly: true },
        subregion: { type: 'text', label: 'Subregion', readOnly: true },
        area: { type: 'number', label: 'Area (km²)', readOnly: true },
        flag: { type: 'text', label: 'Flag', readOnly: true }
      },
      storage: countriesStorage
    }).setSeverityMap('region', {
      'Africa': 'warn',
      'Americas': 'success',
      'Asia': 'danger',
      'Europe': 'info',
      'Oceania': 'secondary',
      'Antarctic': 'contrast'
    }))

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (list + detail - read-only)
    // ════════════════════════════════════════════════════════════════════════
    ctx.crud('countries', {
      list: () => import('./pages/CountriesPage.vue')
    }, {
      nav: { section: 'REST Countries', icon: 'pi pi-globe' }
    })

    // Detail page (read-only, not part of CRUD pattern)
    // Route param must match entity idField (cca3)
    ctx.routes('countries/:cca3', [
      {
        path: '',
        name: 'country-show',
        component: () => import('./pages/CountryShowPage.vue'),
        meta: { layout: 'form' }
      }
    ], { entity: 'countries' })
  }
}

export default CountriesModule
