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
mv pages/TemplateShow.vue pages/ProductShow.vue
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
| `TemplateModule.js` | Module class - strings, entity, pages, nav |
| `pages/TemplateList.vue` | List page: declared columns, search, filter |
| `pages/TemplateShow.vue` | Detail page |
| `pages/TemplateForm.vue` | Create/Edit form (single component) |
| `index.js` | Barrel export |

## Module Class Structure

```javascript
export class {{EntityName}}Module extends Module {
  static moduleName = '{{entity_name}}'    // Module identifier
  static requires = []               // Dependencies (other module names)
  static priority = 10               // Load order (lower = first)

  async connect(ctx) {
    ctx.messages(...)  // Every string on screen, per language
    ctx.entity(...)    // An EntityManager with its storage
    ctx.crud(...)      // List, show and form pages + nav
    ctx.routes(...)    // Pages that are not an entity's
    ctx.navItem(...)   // Additional nav items
  }
}
```

## Entity Definition

```javascript
ctx.entity('products', new EntityManager({
  name: 'products',
  labelField: 'name',           // Display field
  fields: {                     // No labels here: entities.products.fields.* in ctx.messages
    name: { type: 'text', required: true },
    price: { type: 'number' },
    category: { type: 'select', options: [...] }   // labels: entities.products.fields.category.options.*
  },
  children: {                    // Related entities
    variants: { entity: 'variants', foreignKey: 'product_id' }
  },
  storage: productsStorage
}))
```

## CRUD Routes

```javascript
// Single form pattern (recommended)
ctx.crud('products', {
  list: () => import('./pages/ProductList.vue'),
  show: () => import('./pages/ProductShow.vue'),
  form: () => import('./pages/ProductForm.vue')
}, {
  nav: { section: 'Inventory', icon: 'pi pi-box' }   // its label: nav.routes.product in the catalogue
})
```

Generated routes:
- `/products` → list (name: `product`)
- `/products/:id` → show (name: `product-show`)
- `/products/create` → form in create mode (name: `product-create`)
- `/products/:id/edit` → form in edit mode (name: `product-edit`)

## Custom Pages

```javascript
ctx.routes('products/stats', [
  { path: '', name: 'product-stats', component: () => import('./pages/ProductStats.vue') }
])
ctx.navItem({ section: 'Inventory', route: 'product-stats', icon: 'pi pi-chart-bar' })   // label: nav.routes.product-stats
```

## Storage Options

```javascript
// MockApiStorage (development): latency and failRate make it behave like a server
const storage = new MockApiStorage({
  entityName: 'products',
  initialData: fixtureData,
  authCheck,                    // the shared check, src/config/storages.js
  latency: [150, 500],
  failRate: 0.02,
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

Who may do what is a grant in the roles provider (`src/main.js`), not code:
`entity:products:delete` granted to `ROLE_ADMIN` only means only admins delete.
See [docs/security.md](../../../../../docs/security.md#entitymanager-permissions).

A manager subclass is for a business rule about the record, keeping the grant:

```javascript
class ProductsManager extends EntityManager {
  canUpdate(item) {
    return item?.status !== 'archived' && super.canUpdate(item)
  }
}
```
