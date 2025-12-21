# qdadm

Vue 3 framework for building admin dashboards with PrimeVue.

## Features

- **Kernel**: All-in-one bootstrap (Vue app, router, Pinia, PrimeVue, auth guard)
- **EntityManager**: CRUD operations with permission control (`canRead`/`canWrite`)
- **Module System**: Auto-discovery of modules with routes and navigation
- **Components**: Forms, lists, dialogs, editors ready to use
- **Composables**: `useForm`, `useListPageBuilder`, `useBareForm`, etc.

## Installation

```bash
npm install qdadm
```

## Quick Start with Kernel

```js
import { Kernel, EntityManager, LocalStorage } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'

import App from './App.vue'
import { authAdapter } from './adapters/authAdapter'

const managers = {
  books: new EntityManager({
    name: 'books',
    storage: new LocalStorage({ key: 'my_books' }),
    fields: {
      title: { type: 'text', label: 'Title', required: true },
      author: { type: 'text', label: 'Author' }
    }
  })
}

const kernel = new Kernel({
  root: App,
  modules: import.meta.glob('./modules/*/init.js', { eager: true }),
  sectionOrder: ['Library'],
  managers,
  authAdapter,
  pages: {
    login: () => import('./pages/LoginPage.vue'),
    layout: () => import('./pages/MainLayout.vue')
  },
  homeRoute: 'book',
  app: { name: 'My App', version: '1.0.0' },
  primevue: { plugin: PrimeVue, theme: Aura }
})

kernel.createApp().mount('#app')
```

## Manual Bootstrap (without Kernel)

```js
import { createQdadm, initModules, getRoutes } from 'qdadm'

// Init modules
initModules(import.meta.glob('./modules/*/init.js', { eager: true }))

// Create router with getRoutes()
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginPage },
    { path: '/', component: Layout, children: getRoutes() }
  ]
})

// Install plugin
app.use(createQdadm({ managers, authAdapter, router, toast }))
```

## Module Structure

```
modules/
└── books/
    ├── init.js          # Route & nav registration
    └── pages/
        ├── BookList.vue
        └── BookForm.vue
```

**init.js:**
```js
export function init(registry) {
  registry.addRoutes('books', [
    { path: '', name: 'book', component: () => import('./pages/BookList.vue') },
    { path: 'create', name: 'book-create', component: () => import('./pages/BookForm.vue') },
    { path: ':id/edit', name: 'book-edit', component: () => import('./pages/BookForm.vue') }
  ], { entity: 'books' })

  registry.addNavItem({
    section: 'Library',
    route: 'book',
    icon: 'pi pi-book',
    label: 'Books',
    entity: 'books'
  })

  registry.addRouteFamily('book', ['book-'])
}
```

## EntityManager Permissions

```js
class UsersManager extends EntityManager {
  canRead() {
    return authAdapter.getUser()?.role === 'admin'
  }
  canWrite() {
    return authAdapter.getUser()?.role === 'admin'
  }
}
```

When `canRead()` returns false:
- Navigation items are hidden
- Routes redirect to `/`

## Components

| Category | Components |
|----------|------------|
| Layout | `AppLayout`, `PageLayout`, `PageHeader`, `Breadcrumb` |
| Forms | `FormField`, `FormActions`, `FormTabs`, `FormTab` |
| Lists | `ListPage`, `ActionButtons`, `FilterBar` |
| Editors | `JsonViewer`, `KeyValueEditor`, `VanillaJsonEditor` |
| Dialogs | `SimpleDialog`, `MultiStepDialog`, `UnsavedChangesDialog` |
| Display | `CardsGrid`, `CopyableId`, `EmptyState` |

## Composables

| Composable | Description |
|------------|-------------|
| `useForm` | Form with validation, dirty state, navigation guard |
| `useBareForm` | Lightweight form without routing |
| `useListPageBuilder` | Paginated list with filters and actions |
| `useTabSync` | Sync tabs with URL query params |
| `useBreadcrumb` | Dynamic breadcrumb from route |

## Peer Dependencies

- vue ^3.3.0
- vue-router ^4.0.0
- primevue ^4.0.0
- pinia ^2.0.0
- vanilla-jsoneditor ^0.23.0

## License

MIT
