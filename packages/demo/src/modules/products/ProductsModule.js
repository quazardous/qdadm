/**
 * Products Module - Module System v2 Implementation
 *
 * Class-based module for DummyJSON API integration.
 */

import { Module } from 'qdadm'

export class ProductsModule extends Module {
  static name = 'products'
  static requires = []
  static priority = 0

  async connect(ctx) {
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
        component: () => import('./pages/ProductDetailPage.vue'),
        meta: { layout: 'form' }
      }
    ], { entity: 'products' })

    ctx.navItem({
      section: 'DummyJSON',
      route: 'product',
      icon: 'pi pi-box',
      label: 'Products'
    })

    ctx.routeFamily('product', ['product-'])
  }
}

export default ProductsModule
