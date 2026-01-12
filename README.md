# qdadm

**Build your Vue 3 admin in 5 minutes.**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://quazardous.github.io/qdadm/)

---

## Quick Start (5 minutes)

### 1. Create Vue project (1 min)

```bash
npm create vite@latest my-admin -- --template vue
cd my-admin
npm install
```

### 2. Install qdadm + PrimeVue (30 sec)

```bash
npm install qdadm primevue @primeuix/themes
```

### 3. Setup main.js (1 min)

Replace `src/main.js`:

```js
import { Kernel, EntityManager, MockApiStorage } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'

import App from './App.vue'
import MainLayout from './MainLayout.vue'

const kernel = new Kernel({
  root: App,
  modules: import.meta.glob('./modules/*/index.js', { eager: true }),
  managers: {
    books: new EntityManager({
      name: 'books',
      storage: new MockApiStorage({
        key: 'books',
        initialData: [
          { id: '1', title: '1984', author: 'Orwell' },
          { id: '2', title: 'Dune', author: 'Herbert' }
        ]
      }),
      labelField: 'title'
    })
  },
  pages: { layout: MainLayout },
  homeRoute: 'books',
  app: { name: 'My Admin' },
  primevue: { plugin: PrimeVue, theme: Aura }
})

kernel.createApp().mount('#app')
```

### 4. Create layout (30 sec)

Create `src/MainLayout.vue`:

```vue
<script setup>
import { AppLayout } from 'qdadm/components'
</script>

<template>
  <AppLayout />
</template>
```

### 5. Create your first module (2 min)

Create `src/modules/books/BooksModule.js`:

```js
import { Module } from 'qdadm'

export class BooksModule extends Module {
  static name = 'books'

  async connect(ctx) {
    ctx.entity('books', { ... })  // or reference manager from kernel

    ctx.crud('books', {
      list: () => import('./BookList.vue'),
      form: () => import('./BookForm.vue')
    }, {
      nav: { section: 'Library', icon: 'pi pi-book' }
    })
  }
}
```

Create `src/modules/books/BookList.vue`:

```vue
<script setup>
import { ListPage } from 'qdadm/components'
import { useListPageBuilder } from 'qdadm/composables'

const list = useListPageBuilder('books')
list.addColumn('title', 'Title')
list.addColumn('author', 'Author')
list.addEditAction()
list.addDeleteAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events" />
</template>
```

Create `src/modules/books/BookForm.vue`:

```vue
<script setup>
import { PageLayout, FormField, FormActions } from 'qdadm/components'
import { useForm } from 'qdadm/composables'

const { form, loading, saving, save, saveAndClose, cancel } = useForm('books')
</script>

<template>
  <PageLayout :loading="loading">
    <FormField label="Title" v-model="form.title" required />
    <FormField label="Author" v-model="form.author" />
    <FormActions :saving="saving" @save="save" @save-close="saveAndClose" @cancel="cancel" />
  </PageLayout>
</template>
```

### 6. Run it

```bash
npm run dev
```

Open http://localhost:5173 - You have a working admin with CRUD operations.

---

## Next Steps

### Add more entities

```js
// main.js - add a 'users' manager
managers: {
  books: new EntityManager({ ... }),
  users: new EntityManager({
    name: 'users',
    storage: new MockApiStorage({ key: 'users' }),
    labelField: 'name'
  })
}
```

### Connect to real API

```js
import { ApiStorage } from 'qdadm'

new EntityManager({
  name: 'books',
  storage: new ApiStorage({
    baseUrl: '/api/books',
    // Automatic: GET /, GET /:id, POST /, PATCH /:id, DELETE /:id
  })
})
```

### Add authentication

```js
import { SessionAuthAdapter } from 'qdadm'
import LoginPage from './LoginPage.vue'

const authAdapter = new SessionAuthAdapter({
  loginFn: async (credentials) => {
    const res = await fetch('/api/login', { method: 'POST', body: JSON.stringify(credentials) })
    return res.json() // { user, token }
  }
})

const kernel = new Kernel({
  authAdapter,
  pages: { login: LoginPage, layout: MainLayout },
  // ...
})
```

### Add permissions

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
          ROLE_ADMIN: ['entity:**', 'admin:**']  // ** = all
        }
      }
    })
  }
})

// Permissions auto-checked via SecurityChecker.isGranted()
// entity:books:read, entity:books:create, entity:books:update, entity:books:delete
```

---

## What's Included

| Feature | Description |
|---------|-------------|
| **Kernel** | Bootstrap, routing, module loading |
| **EntityManager** | CRUD, caching, permissions |
| **Storage** | MockApiStorage, ApiStorage, SdkStorage |
| **ListPage** | Sortable table, filters, pagination |
| **FormField** | Auto-detect input type, validation |
| **AppLayout** | Sidebar nav, breadcrumbs, theme |

## Packages

| Package | Description |
|---------|-------------|
| [qdadm](packages/qdadm) | Core library |
| [demo](packages/demo) | Full demo app |

## Run Demo Locally

```bash
git clone https://github.com/quazardous/qdadm.git
cd qdadm
npm install
npm run dev
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [QDADM_CREDO](packages/qdadm/QDADM_CREDO.md) | Philosophy, patterns, concepts |
| [Architecture](packages/qdadm/docs/architecture.md) | PAC pattern, layers |
| [Extension](packages/qdadm/docs/extension.md) | Hooks, signals, zones |
| [SdkStorage](packages/qdadm/README.md#sdkstorage) | Generated SDK integration |
| [CHANGELOG](CHANGELOG.md) | Version history |

## License

MIT
