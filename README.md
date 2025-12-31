# qdadm

**Vue 3 admin framework. PrimeVue. Zero boilerplate.**

[![Live Demo](https://img.shields.io/badge/demo-live-brightgreen)](https://quazardous.github.io/qdadm/)

```bash
npm install qdadm
```

## 30-Second Setup

```js
import { Kernel, EntityManager, LocalStorage } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'

const kernel = new Kernel({
  root: App,
  modules: import.meta.glob('./modules/*/init.js', { eager: true }),
  managers: {
    books: new EntityManager({
      name: 'books',
      storage: new LocalStorage({ key: 'books' }),
      labelField: 'title'
    })
  },
  authAdapter,
  pages: { login: LoginPage, layout: MainLayout },
  homeRoute: 'book',
  app: { name: 'My App' },
  primevue: { plugin: PrimeVue, theme: Aura }
})

kernel.createApp().mount('#app')
```

## Module in 20 Lines

```
modules/books/
├── init.js
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

  registry.addNavItem({ section: 'Library', route: 'book', label: 'Books', entity: 'books' })
}
```

## List Page in 15 Lines

```vue
<script setup>
import { useListPageBuilder } from 'qdadm/composables'
import { ListPage } from 'qdadm/components'

const list = useListPageBuilder('books')
list.addColumn('title', 'Title')
list.addColumn('author', 'Author')
list.setSearch({ placeholder: 'Search...' })
list.addEditAction()
list.addDeleteAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events" />
</template>
```

## Form in 20 Lines

```vue
<script setup>
import { useForm } from 'qdadm/composables'
import { PageLayout, FormField, FormActions } from 'qdadm/components'

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

## Permissions Built-In

```js
class BooksManager extends EntityManager {
  canRead() { return true }
  canCreate() { return auth.user?.role === 'admin' }
  canUpdate(book) { return book.author_id === auth.user?.id }
  canDelete(book) { return auth.user?.role === 'admin' }
}
```

- Nav items auto-hide when `canRead()` = false
- Routes auto-redirect when `canRead()` = false
- Create/Edit/Delete buttons auto-hide per entity

## Smart Caching

```js
// Automatic: cache fills on first list(), local filtering when < threshold
const manager = new EntityManager({
  name: 'books',
  storage: new ApiStorage({ endpoint: '/api/books' }),
  localFilterThreshold: 100  // Switch to local mode below 100 items
})

// Ownership filters: cacheSafe = true for session-bound filters
async list(params) {
  params.user_id = auth.user.id
  params.cacheSafe = true  // Safe to cache despite filter
  return super.list(params)
}
```

## What's Included

| Category | What You Get |
|----------|--------------|
| **Bootstrap** | Kernel, createQdadm, module registry |
| **Data** | EntityManager, ApiStorage, LocalStorage |
| **Forms** | useForm, useBareForm, FormField, FormActions |
| **Lists** | useListPageBuilder, ListPage, FilterBar |
| **Layout** | AppLayout, PageLayout, Breadcrumb |
| **Dialogs** | SimpleDialog, UnsavedChangesDialog |
| **Editors** | JsonViewer, KeyValueEditor |

## Packages

| Package | Description |
|---------|-------------|
| [qdadm](packages/qdadm) | Core library |
| [demo](packages/demo) | Working demo app |

## Run Demo

```bash
npm install
npm run dev
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [QDADM_CREDO](packages/qdadm/QDADM_CREDO.md) | Philosophy, patterns, anti-patterns |
| [AGENT_GUIDE](docs/AGENT_GUIDE.md) | Quick index for AI agents |
| [Architecture](packages/qdadm/docs/architecture.md) | PAC pattern, layer separation |
| [Extension](packages/qdadm/docs/extension.md) | Hooks, signals, zones overview |
| [Examples](EXAMPLES.md) | Live examples index |

## License

MIT
