# Module Template

Copy this directory to create a new qdadm module.

## Quick Start

```bash
# 1. Copy template
cp -r src/modules/_template src/modules/products

# 2. Rename files
cd src/modules/products
mv TemplateModule.js ProductsModule.js
mv pages/TemplateList.vue pages/ProductList.vue
mv pages/TemplateForm.vue pages/ProductForm.vue

# 3. Search & replace placeholders
# In all files, replace:
#   {{EntityName}}  → Products   (PascalCase)
#   {{entityName}}  → products   (camelCase)
#   {{entity_name}} → products   (snake_case)
#   {{Section}}     → Inventory  (nav section)

# 4. Create fixture file
echo '[]' > src/fixtures/products.json

# 5. Register module in config/modules.js
import { ProductsModule } from '../modules/products/ProductsModule'
export const moduleDefs = [..., ProductsModule]
```

## Files

| File | Purpose |
|------|---------|
| `TemplateModule.js` | Module class - entity, routes, nav |
| `pages/TemplateList.vue` | List page with DataTable |
| `pages/TemplateForm.vue` | Create/Edit form (single component) |
| `index.js` | Barrel export |

## Module Class Structure

```javascript
export class {{EntityName}}Module extends Module {
  static name = '{{entity_name}}'    // Module identifier
  static requires = []               // Dependencies (other module names)
  static priority = 10               // Load order (lower = first)

  async connect(ctx) {
    ctx.entity(...)    // Register entity + manager
    ctx.crud(...)      // CRUD routes + nav
    ctx.routes(...)    // Custom pages
    ctx.navItem(...)   // Additional nav items
  }
}
```

## Entity Definition

```javascript
ctx.entity('products', {
  name: 'products',
  labelField: 'name',           // Display field
  fields: {
    name: { type: 'text', label: 'Name', required: true },
    price: { type: 'number', label: 'Price' },
    category: { type: 'select', label: 'Category', options: [...] }
  },
  children: {                    // Related entities
    variants: { entity: 'variants', foreignKey: 'product_id' }
  },
  storage: productsStorage
})
```

## CRUD Routes

```javascript
// Single form pattern (recommended)
ctx.crud('products', {
  list: () => import('./pages/ProductList.vue'),
  form: () => import('./pages/ProductForm.vue')
}, {
  nav: { section: 'Inventory', icon: 'pi pi-box', label: 'Products' }
})
```

Generated routes:
- `/products` → list (name: `product`)
- `/products/create` → form in create mode (name: `product-create`)
- `/products/:id/edit` → form in edit mode (name: `product-edit`)

## Custom Pages

```javascript
ctx.routes('products/stats', [
  { path: '', name: 'product-stats', component: () => import('./pages/ProductStats.vue') }
])
ctx.navItem({ section: 'Inventory', route: 'product-stats', icon: 'pi pi-chart-bar', label: 'Stats' })
```

## Storage Options

```javascript
// MockApiStorage (development)
const storage = new MockApiStorage({
  entityName: 'products',
  initialData: fixtureData,
  authCheck: () => !!authAdapter.getUser()  // Protect API
})

// ApiStorage (production)
const storage = new ApiStorage({
  endpoint: '/products',
  client: axiosInstance
})

// LocalStorage (persistent local)
const storage = new LocalStorage({ key: 'my-products' })
```

## Custom Permissions

```javascript
class ProductsManager extends EntityManager {
  canDelete(item) {
    const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
    return user?.role === 'ROLE_ADMIN'
  }

  canUpdate(item) {
    return item.status !== 'archived'
  }
}
```
