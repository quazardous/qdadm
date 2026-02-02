/**
 * Products Module - Module-Centric Pattern
 *
 * Self-contained module that owns:
 * - Entity definition (fields, custom storage)
 * - Routes (list + detail)
 * - Navigation
 *
 * Demonstrates external API integration (DummyJSON API).
 * Custom storage handles limit/skip pagination.
 */

import { Module, ApiStorage } from 'qdadm'
import axios from 'axios'

// ============================================================================
// STORAGE
// ============================================================================

const dummyJsonClient = axios.create({
  baseURL: 'https://dummyjson.com'
})

/**
 * DummyJSON storage
 *
 * Uses limit/skip pagination instead of page/page_size.
 */
class DummyJsonStorage extends ApiStorage {
  async list(params = {}) {
    const { page = 1, page_size = 20, filters = {} } = params
    const limit = page_size
    const skip = (page - 1) * page_size

    const response = await this.client.get(this.endpoint, {
      params: { limit, skip, ...filters }
    })

    const data = response.data
    return {
      items: data[this.responseItemsKey] || data.items || data,
      total: data[this.responseTotalKey] || data.total || (Array.isArray(data) ? data.length : 0)
    }
  }
}

const productsStorage = new DummyJsonStorage({
  endpoint: '/products',
  client: dummyJsonClient,
  responseItemsKey: 'products'
})

// ============================================================================
// MODULE
// ============================================================================

export class ProductsModule extends Module {
  static name = 'products'
  static requires = []
  static priority = 0

  async connect(ctx) {
    // ════════════════════════════════════════════════════════════════════════
    // ENTITY
    // ════════════════════════════════════════════════════════════════════════
    ctx.entity('products', {
      name: 'products',
      labelField: 'title',
      readOnly: true,
      localFilterThreshold: 200,
      fields: {
        id: { type: 'number', label: 'ID', readOnly: true },
        title: { type: 'text', label: 'Title', required: true },
        description: { type: 'textarea', label: 'Description' },
        price: { type: 'number', label: 'Price' },
        discountPercentage: { type: 'number', label: 'Discount %' },
        rating: { type: 'number', label: 'Rating' },
        stock: { type: 'number', label: 'Stock' },
        brand: { type: 'text', label: 'Brand' },
        category: { type: 'text', label: 'Category' },
        thumbnail: { type: 'url', label: 'Thumbnail' }
      },
      storage: productsStorage
    })

    // ════════════════════════════════════════════════════════════════════════
    // ROUTES (list + detail - read-only)
    // ════════════════════════════════════════════════════════════════════════
    ctx.routes('products', [
      {
        path: '',
        name: 'product',
        component: () => import('./pages/ProductsPage.vue'),
        meta: { layout: 'list' }
      },
      {
        path: ':id',
        name: 'product-show',
        component: () => import('./pages/ProductShowPage.vue'),
        meta: { layout: 'form' }
      }
    ], { entity: 'products' })

    // Navigation
    ctx.navItem({
      section: 'DummyJSON',
      route: 'product',
      icon: 'pi pi-box',
      label: 'Products',
      entity: 'products'
    })

    // Route family
    ctx.routeFamily('product', ['product-'])
  }
}

export default ProductsModule
