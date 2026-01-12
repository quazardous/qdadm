# qdadm Philosophy

## Core Principle: Declaration Over Implementation

qdadm is an **ultra-DRY** admin framework. 80% of admin pages are built by declaring WHAT you want, not HOW to get it.

## The Ideal Page

```vue
<script setup>
import { ListPage } from 'qdadm/components'
import { useListPageBuilder } from 'qdadm/composables'

const list = useListPageBuilder('books')
list.addColumn('title', 'Title')
list.addColumn('author', 'Author')
list.setSearch({ placeholder: 'Search...' })
list.addFilter('genre', { optionsEntity: 'genres' })
list.addEditAction()
list.addDeleteAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events" />
</template>
```

**~20 lines** for full CRUD with search, pagination, sorting, permissions.

## The Three Layers

```
Page (declaration)
    ↓ uses
EntityManager (business logic, permissions, caching)
    ↓ uses
Storage (data backend - invisible to pages)
```

**Pages interact ONLY with EntityManager via builders.** Storage is configured once and never touched again.

## Storage is Invisible

Pages never import or reference storage directly:

```javascript
// WRONG - pages don't know about storage
import { MockApiStorage } from 'qdadm'
const storage = new MockApiStorage({...})
await storage.list()

// RIGHT - pages only know entity names
const list = useListPageBuilder({ entity: 'books' })
```

The value: switching from `MockApiStorage` to `SdkStorage` requires **zero changes to any page**.

## Filters are Declarative

Filter options come from the data, not hardcoded arrays:

```javascript
// WRONG - manual option maintenance
list.addFilter('genre', {
  options: [
    { label: 'Fiction', value: 1 },
    { label: 'Non-Fiction', value: 2 },
    // ... update every time genres change
  ]
})

// RIGHT - declare the source
list.addFilter('genre', {
  placeholder: 'All Genres',
  optionsEntity: 'genres'  // Options auto-loaded from EntityManager
})
```

**Three smart filter modes:**
- `optionsEntity` → fetch from related EntityManager
- `optionsEndpoint` → fetch from API distinct values
- `optionsFromCache` → extract unique values from loaded items

Pages declare WHERE options come from. The framework handles loading, caching, and "All X" labels.

## The Demo App

The demo is a **representative mini-application**, not a collection of technical demos.

```
📚 Books    → CRUD with relations
👤 Users    → Permissions example
📋 Loans    → Related entities (books ↔ users)
🏷️ Genres  → Simple reference data
```

This shows real patterns developers will use. No abstract "StorageDemo" or "FilterDemo" pages.

## Anti-Patterns

### 1. Technical Demo Pages

```
❌ StorageDemo.vue     → "look, storage works!"
❌ FilterDemo.vue      → "look, filters work!"
❌ PaginationDemo.vue  → "look, pagination works!"
```

Instead: these features are demonstrated **in context** via the real Books/Users/Loans app.

### 2. Direct SDK/API Calls in Pages

```javascript
// WRONG
import { getSdk } from './api'
const response = await getSdk().getBooks()
```

Use EntityManager. If a pattern doesn't fit EntityManager, extend the framework.

### 3. Manual DataTable with Pagination

```javascript
// WRONG - 100+ lines of boilerplate
<DataTable :value="items" @page="onPageChange" @sort="onSort">
```

Use `ListPage` component. It handles everything.

## Deferred & Warmup

Loose async coupling for service initialization:

```javascript
// At boot (automatic, controlled by Kernel.warmup option)
// EntityManagers with warmup: true register their cache loading

// In component - await cache ready before rendering
const deferred = useDeferred()
await deferred.await('entity:books:cache')
const { items } = await booksManager.list()  // Uses preloaded cache
```

**DeferredRegistry**: Named promise registry. `await()` can be called BEFORE `queue()` - the promise is created on first access. Pages await what they need, services register when ready.

**Warmup**: At boot, Kernel triggers `orchestrator.fireWarmups()` (fire-and-forget). Each EntityManager with `warmup: true` (default) registers its cache loading. Other services can hook into this pattern.

## Module System v2

Organize features as class-based modules with lifecycle hooks:

```javascript
import { Module, EntityManager, MockApiStorage } from 'qdadm'

export class BooksModule extends Module {
  static name = 'books'
  static requires = []        // Dependencies
  static priority = 50        // Load order (lower = earlier)

  async connect(ctx) {
    // Register entity
    ctx.entity('books', new EntityManager({
      name: 'books',
      labelField: 'title',
      storage: new MockApiStorage({ entityName: 'books' })
    }))

    // CRUD routes + nav (single form pattern)
    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      form: () => import('./pages/BookForm.vue')
    }, {
      nav: { section: 'Library', icon: 'pi pi-book' }
    })

    // Zones for extensibility
    ctx.zone('books-header')
    ctx.block('books-header', { id: 'stats', component: BookStats })
  }
}

// In main.js - auto-discovery via glob
const kernel = new Kernel({
  modules: import.meta.glob('./modules/*/index.js', { eager: true }),
  // ...
})
kernel.createApp().mount('#app')
```

**Why modules?**
- Clear boundaries between features
- Dependency resolution at boot
- Automatic cleanup on disconnect
- Testable in isolation

## Toast via Signals

Toasts use the signal bus, not direct PrimeVue calls:

```javascript
// WRONG - tight coupling to PrimeVue
import { useToast } from 'primevue/usetoast'
const toast = useToast()
toast.add({ severity: 'success', summary: 'Saved!' })

// RIGHT - signal-based (decoupled)
import { useSignalToast } from 'qdadm'
const toast = useSignalToast()
toast.success('Saved!')  // Emits toast:success signal
```

**Benefits:**
- ToastCollector captures all toasts for debugging
- Easy to mock in tests
- Could switch toast library without changing app code

## EventRouter

High-level signal routing for cross-cutting concerns. Transforms event A into events B, C.

```javascript
new Kernel({
  eventRouter: {
    // String = forward payload as-is
    'auth:impersonate': [
      'cache:entity:invalidate:loans',
      'cache:entity:invalidate:tasks'
    ],
    // Object = transform payload if needed
    'payment:completed': [
      { signal: 'notify:admin', transform: (ctx) => ({ amount: ctx.total }) },
      'audit:log'  // forward as-is
    ]
  }
})
```

**Principle**: Components stay simple. They don't listen to global events like `auth:impersonate` and know what to invalidate. Instead:
1. High-level EventRouter transforms `auth:impersonate` → `cache:entity:invalidate:loans`
2. EntityManager listens only to its own signal `cache:entity:invalidate:{name}`

**Topo check at boot**: Detects cycles (`A→B, B→A`) to prevent infinite loops.

## When Custom Code is OK

1. **Dashboards** - Stats/metrics displays (consider a stats builder)
2. **Wizards** - Multi-step flows
3. **Reports** - Complex visualizations

Even these should use EntityManager for data access.

## Security by Default

### Unified Permission System

```js
new Kernel({
  authAdapter,
  security: {
    roleHierarchy: {
      ROLE_ADMIN: ['ROLE_EDITOR'],
      ROLE_EDITOR: ['ROLE_USER']
    },
    rolePermissions: {
      ROLE_ADMIN: ['*'],
      ROLE_EDITOR: ['entity:books:*'],
      ROLE_USER: ['entity:books:read']
    }
  }
})

// Check permission anywhere
ctx.security.isGranted('entity:books:delete')
ctx.security.isGranted('entity:*:read')  // wildcard
```

**Permission flow:**
```
User roles → RolesManager (expand) → RolesProvider (get perms) → PermissionMatcher (check)
```

### Token Expiration

qdadm handles auth errors automatically:

```js
// Wire your API client to emit auth:expired on 401/403
kernel.setupApiClient(axios.create({ baseURL: '/api' }))
```

**What happens on 401/403:**
1. `auth:expired` signal emitted
2. `authAdapter.logout()` called
3. User redirected to `/login?expired=1`

### Impersonation

Signal-driven impersonation for testing permissions:

```js
// Start impersonation
await signals.emit('auth:impersonate', { target: user, original: admin })

// End impersonation
await signals.emit('auth:impersonate:stop', { original: admin })
```

See [Security docs](./docs/security.md) for full auth flow.

## Summary

| Principle | Description |
|-----------|-------------|
| DRY | Declare once, use everywhere |
| Invisible storage | Pages don't know storage exists |
| Smart filters | Declare source, not values |
| Representative demo | Real app, not technical showcases |
| EntityManager first | All data through managers |
| ListPage default | Custom DataTable only when justified |
| Security by default | Auto-logout on token expiration |
| Module boundaries | Features as isolated, testable modules |
| Signals over imports | Decouple via event bus, not direct calls |

## Deep Dives

| Doc | Topic |
|-----|-------|
| [Architecture](./docs/architecture.md) | PAC pattern, layer separation, no-template-ish |
| [Extension](./docs/extension.md) | Overview of all extension mechanisms |
| [Modules](./docs/modules.md) | Class-based modules with lifecycle hooks |
| [Zones](./docs/zones.md) | UI composition via named slots |
| [Signals](./docs/signals.md) | Event-driven cross-module communication, EventRouter |
| [Hooks](./docs/hooks.md) | Drupal-inspired lifecycle hooks |
| [Deferred](./docs/deferred.md) | Async coordination, warmup |
| [Security](./docs/security.md) | Scope vs silo, AuthAdapter |

## References

- [PAC Architecture](https://en.wikipedia.org/wiki/Presentation–abstraction–control)
- [Drupal Hooks](https://www.drupal.org/docs/develop/creating-modules/understanding-hooks)
- [Twig Inheritance](https://symfony.com/doc/current/templates.html)
- [Renderless Components](https://www.patterns.dev/vue/renderless-components)
