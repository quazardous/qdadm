/**
 * Products Module - DummyJSON Integration
 *
 * Products listing with limit/skip pagination.
 * Demonstrates different API pagination style than JSONPlaceholder.
 * Features:
 * - Server-side pagination (limit/skip)
 * - Product thumbnails
 * - Price and category display
 * - Full product detail page
 */

export function init({ registry }) {

  // ============ ROUTES ============
  registry.addRoutes('products', [
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

  // ============ NAVIGATION ============
  registry.addNavItem({
    section: 'DummyJSON',
    route: 'product',
    icon: 'pi pi-box',
    label: 'Products'
  })

  // ============ ROUTE FAMILY ============
  registry.addRouteFamily('product', ['product-'])
}
