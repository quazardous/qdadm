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

```ts
// That's it. Full CRUD for books.
ctx.entity('books', {
  fields: {
    title: { type: 'text', required: true },
    author: { type: 'text' }
  },
  storage: new ApiStorage({ endpoint: '/api/books' })
})

ctx.crud('books', {
  list: () => import('./BookList.vue'),
  form: () => import('./BookForm.vue')
})
```

---

## Quick Start

```bash
# Clone and run
git clone https://github.com/quazardous/qdadm.git
cd qdadm && npm install && npm run dev
```

Or start fresh:

```bash
npm create vite@latest my-admin -- --template vue-ts
cd my-admin
npm install qdadm primevue @primeuix/themes
```

```ts
// main.ts
import { Kernel, MockApiStorage } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'

const kernel = new Kernel({
  root: App,
  primevue: { plugin: PrimeVue, theme: Aura },
  app: { name: 'My Admin' }
})

kernel.createApp().mount('#app')
```

---

## Core Concepts

### Modules own everything

```ts
export class BooksModule extends Module {
  static name = 'books'

  async connect(ctx) {
    // Entity + storage
    ctx.entity('books', { ... })

    // Routes + navigation
    ctx.crud('books', { list, form }, { nav: { section: 'Library' } })

    // Custom routes
    ctx.routes('books', [{ path: 'stats', component: BookStats }])
  }
}
```

### Storage adapters

```ts
// Mock (localStorage, dev/demo)
new MockApiStorage({ key: 'books', initialData: [...] })

// REST API
new ApiStorage({ endpoint: '/api/books' })

// Generated SDK (OpenAPI)
new SdkStorage({ sdk: myGeneratedSdk, methods: { list: 'getBooks', ... } })
```

### Security built-in

```ts
const kernel = new Kernel({
  security: {
    rolesProvider: createLocalStorageRolesProvider({
      defaults: {
        role_hierarchy: { ROLE_ADMIN: ['ROLE_USER'] },
        role_permissions: {
          ROLE_USER: ['entity:*:read'],
          ROLE_ADMIN: ['entity:**', 'admin:**']
        }
      }
    })
  }
})

// Check anywhere
ctx.security.isGranted('entity:books:delete')
```

### Extend everything

```ts
// Hooks - alter behavior
ctx.hooks.register('entity:books:before-save', (data) => {
  data.updatedAt = new Date()
  return data
})

// Signals - react to events
ctx.signals.on('auth:login', ({ user }) => {
  analytics.identify(user.id)
})

// Zones - inject UI
ctx.block('books-list-header', { component: ExportButton })
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
- [CRUD Pages](docs/crud.md) - List, form, show, children
- [Architecture](docs/architecture.md) - PAC pattern
- [Extension](docs/extension.md) - Hooks, signals, zones
- [Security](docs/security.md) - Permissions & roles

---

## License

MIT
