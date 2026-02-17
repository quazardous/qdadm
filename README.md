# qdadm

**The Vue 3 admin framework that gets out of your way.**

TypeScript-first. Module-driven. Zero boilerplate.

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://quazardous.github.io/qdadm/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org/)
[![Vue 3](https://img.shields.io/badge/Vue-3.4+-42b883)](https://vuejs.org/)

---

## Why qdadm?

**Stop writing CRUD boilerplate.** qdadm gives you:

- **Entity-driven architecture** - Define once, get list/form/routes/permissions
- **Smart defaults** - Works instantly, customize when needed
- **TypeScript everywhere** - Full type safety, autocomplete, refactoring
- **Extensible by design** - Hooks, signals, zones for any customization
- **PrimeVue powered** - Beautiful UI out of the box

```js
// That's it. Full CRUD for books.
ctx.entity('books', new EntityManager({
  name: 'books',
  labelField: 'title',
  fields: {
    title: { type: 'text', label: 'Title', required: true, default: '' },
    author: { type: 'text', label: 'Author', default: '' }
  },
  storage: new MockApiStorage({ entityName: 'books', initialData: [] })
}))

ctx.crud('books', {
  list: () => import('./pages/BookList.vue'),
  form: () => import('./pages/BookForm.vue')
}, { nav: { section: 'Library', icon: 'pi pi-book' } })
```

---

## Quick Start

```bash
# Clone and run the demo
git clone https://github.com/quazardous/qdadm.git
cd qdadm && npm install && npm run dev
```

Or start fresh:

```bash
npm create vite@latest my-admin -- --template vue-ts
cd my-admin
npm install qdadm primevue @primeuix/themes
```

```js
// main.js
import { Kernel } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import { moduleDefs } from './config/modules'

const kernel = new Kernel({
  root: App,
  moduleDefs,
  primevue: { plugin: PrimeVue, theme: Aura },
  app: { name: 'My Admin' }
})

kernel.createApp().mount('#app')
```

---

## Core Concepts

### Modules own everything

Each module is self-contained: entity, storage, routes, navigation, zones.

```js
import { Module, EntityManager, MockApiStorage } from 'qdadm'

export class BooksModule extends Module {
  static name = 'books'

  async connect(ctx) {
    // Entity + storage
    ctx.entity('books', new EntityManager({
      name: 'books',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        author: { type: 'text', label: 'Author', default: '' }
      },
      storage: new MockApiStorage({ entityName: 'books', initialData: [] })
    }))

    // CRUD routes + navigation (generates list, create, edit routes)
    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      form: () => import('./pages/BookForm.vue')
    }, { nav: { section: 'Library', icon: 'pi pi-book' } })
  }
}
```

### Storage adapters

```js
// Mock (localStorage persistence, dev/demo)
new MockApiStorage({ entityName: 'books', initialData: [...] })

// REST API (axios-based)
new ApiStorage({ endpoint: '/api/books', client: axiosInstance })

// Generated SDK (OpenAPI)
new SdkStorage({ sdk: myGeneratedSdk, methods: { list: 'getBooks', get: 'getBook' } })
```

### Parent-child entities

```js
// In BooksModule: declare children
ctx.entity('books', new EntityManager({
  name: 'books',
  children: { loans: { entity: 'loans', foreignKey: 'book_id', label: 'Loans' } },
  // ...
}))

// Child CRUD mounted under parent route
ctx.crud('loans', {
  list: () => import('./pages/BookLoans.vue'),
  form: () => import('./pages/BookLoanForm.vue')
}, { parentRoute: 'book', foreignKey: 'book_id', label: 'Loans' })
```

### Security built-in

```js
import { createLocalStorageRolesProvider } from 'qdadm/security'

const kernel = new Kernel({
  // ...
  security: {
    rolesProvider: createLocalStorageRolesProvider({
      defaults: {
        role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
        role_permissions: {
          ROLE_USER: ['entity:*:read', 'entity:*:list'],
          ROLE_ADMIN: ['entity:*:create', 'entity:*:update', 'entity:*:delete', 'admin:**']
        }
      }
    })
  }
})

// Check anywhere via ctx.security
ctx.security.isGranted('entity:books:delete')
```

### Extend everything

```js
// Hooks - alter behavior (registered on kernel after createApp())
kernel.hooks.register('entity:presave', (context) => {
  if (context.entity !== 'books') return
  context.record.updated_at = new Date().toISOString()
}, { priority: 50 })

// Signals - react to events (in module connect())
ctx.on('auth:login', (event) => {
  console.log('User logged in:', event.data)
})

// Zones - inject UI
ctx.zone('books-list-header')
ctx.block('books-list-header', { id: 'export-btn', component: ExportButton, weight: 10 })
```

---

## What's Inside

| Feature | What it does |
|---------|--------------|
| `Kernel` | Bootstrap, routing, DI container |
| `EntityManager` | CRUD, cache, permissions, relations |
| `Storage` | Mock, API, SDK adapters |
| `ListPage` | Table, filters, pagination, actions |
| `FormPage` | Auto-fields, validation, dirty tracking |
| `SecurityChecker` | Roles, hierarchy, wildcard permissions |

---

## Packages

| Package | Description |
|---------|-------------|
| [qdadm](packages/qdadm) | Core library (TypeScript) |
| [demo](packages/demo) | Full-featured demo |

---

## Docs

- [QDADM_CREDO](packages/qdadm/QDADM_CREDO.md) - Philosophy & patterns
- [Tutorial: Mini Admin](docs/tutorial-mini-admin.md) - Build a parent-child admin from scratch

---

## License

MIT
