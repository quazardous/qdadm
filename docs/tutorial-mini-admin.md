# Tutorial: Build a Mini Admin with Parent-Child Entities

Build a simple **Library** admin with **Books** (parent) and **Chapters** (child) using qdadm.

---

## 1. Project Setup

```bash
npm create vite@latest my-library -- --template vue
cd my-library
npm install qdadm primevue @primeuix/themes primeicons
```

## 2. Bootstrap the Kernel

```js
// src/main.js
import { Kernel } from 'qdadm'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import 'qdadm/styles'
import 'primeicons/primeicons.css'

import App from './App.vue'
import { LibraryModule } from './modules/library/LibraryModule'

const kernel = new Kernel({
  root: App,
  moduleDefs: [LibraryModule],
  primevue: { plugin: PrimeVue, theme: Aura },
  app: { name: 'My Library' },
  homeRoute: {
    name: 'home',
    component: () => import('./pages/HomePage.vue')
  }
})

kernel.createApp().mount('#app')
```

## 3. Create the Module

A module owns its entities, storage, routes, and navigation.

```js
// src/modules/library/LibraryModule.js
import { Module, EntityManager, MockApiStorage } from 'qdadm'

// ── Storage ──────────────────────────────────────────────────────────

const booksStorage = new MockApiStorage({
  entityName: 'books',
  initialData: [
    { id: '1', title: 'The Hobbit', author: 'J.R.R. Tolkien', year: 1937 },
    { id: '2', title: 'Dune', author: 'Frank Herbert', year: 1965 }
  ]
})

const chaptersStorage = new MockApiStorage({
  entityName: 'chapters',
  initialData: [
    { id: '1', book_id: '1', title: 'An Unexpected Party', number: 1 },
    { id: '2', book_id: '1', title: 'Roast Mutton', number: 2 },
    { id: '3', book_id: '2', title: 'Dune', number: 1 },
    { id: '4', book_id: '2', title: 'Muad\'Dib', number: 2 }
  ]
})

// ── Module ───────────────────────────────────────────────────────────

export class LibraryModule extends Module {
  static name = 'library'

  async connect(ctx) {
    // ── Books entity ──
    ctx.entity('books', new EntityManager({
      name: 'books',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        author: { type: 'text', label: 'Author', required: true, default: '' },
        year: { type: 'number', label: 'Year', default: () => new Date().getFullYear() }
      },
      children: {
        chapters: { entity: 'chapters', foreignKey: 'book_id', label: 'Chapters' }
      },
      storage: booksStorage
    }))

    // ── Chapters entity ──
    ctx.entity('chapters', new EntityManager({
      name: 'chapters',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title', required: true, default: '' },
        number: { type: 'number', label: 'Chapter #', required: true, default: 1 },
        book_id: { type: 'text', label: 'Book', readOnly: true }
      },
      parent: { entity: 'books', foreignKey: 'book_id' },
      storage: chaptersStorage
    }))

    // ── Books CRUD routes ──
    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      form: () => import('./pages/BookForm.vue')
    }, {
      nav: { section: 'Library', icon: 'pi pi-book' }
    })

    // ── Chapters CRUD (child of books) ──
    ctx.crud('chapters', {
      list: () => import('./pages/BookChapters.vue'),
      form: () => import('./pages/BookChapterForm.vue')
    }, {
      parentRoute: 'book',
      foreignKey: 'book_id',
      label: 'Chapters'
    })
  }
}
```

**What `ctx.crud()` generates:**

| Route name | Path | Page |
|------------|------|------|
| `book` | `/books` | BookList |
| `book-create` | `/books/create` | BookForm |
| `book-edit` | `/books/:id/edit` | BookForm |
| `book-chapter` | `/books/:id/chapters` | BookChapters |
| `book-chapter-create` | `/books/:id/chapters/create` | BookChapterForm |
| `book-chapter-edit` | `/books/:id/chapters/:id/edit` | BookChapterForm |

## 4. List Page

```vue
<!-- src/modules/library/pages/BookList.vue -->
<script setup>
import { useEntityListPage } from 'qdadm'

const { items, total, loading, columns, pagination, onPage, onDelete } =
  useEntityListPage('books')
</script>

<template>
  <EntityListPage
    entity="books"
    :items="items"
    :total="total"
    :loading="loading"
    :columns="columns"
    :pagination="pagination"
    @page="onPage"
    @delete="onDelete"
  />
</template>
```

`useEntityListPage` handles fetching, pagination, filtering, and delete confirmation. `EntityListPage` renders the DataTable with action buttons.

## 5. Form Page

```vue
<!-- src/modules/library/pages/BookForm.vue -->
<script setup>
import { useEntityFormPage } from 'qdadm'

const { record, fields, loading, saving, isNew, onSave, onCancel } =
  useEntityFormPage('books')
</script>

<template>
  <EntityFormPage
    entity="books"
    :record="record"
    :fields="fields"
    :loading="loading"
    :saving="saving"
    :is-new="isNew"
    @save="onSave"
    @cancel="onCancel"
  />
</template>
```

The form handles both **create** (`/books/create`) and **edit** (`/books/:id/edit`). `useEntityFormPage` detects the mode from the route.

## 6. Child List Page

```vue
<!-- src/modules/library/pages/BookChapters.vue -->
<script setup>
import { useEntityListPage } from 'qdadm'

const { items, total, loading, columns, pagination, onPage, onDelete } =
  useEntityListPage('chapters')
</script>

<template>
  <EntityListPage
    entity="chapters"
    :items="items"
    :total="total"
    :loading="loading"
    :columns="columns"
    :pagination="pagination"
    @page="onPage"
    @delete="onDelete"
  />
</template>
```

The child list page automatically filters by the parent's foreign key (`book_id`) based on the route param.

## 7. Child Form Page

```vue
<!-- src/modules/library/pages/BookChapterForm.vue -->
<script setup>
import { useEntityFormPage } from 'qdadm'

const { record, fields, loading, saving, isNew, onSave, onCancel } =
  useEntityFormPage('chapters')
</script>

<template>
  <EntityFormPage
    entity="chapters"
    :record="record"
    :fields="fields"
    :loading="loading"
    :saving="saving"
    :is-new="isNew"
    @save="onSave"
    @cancel="onCancel"
  />
</template>
```

The `book_id` field is auto-injected from the route param when creating a new chapter.

## 8. App Shell

```vue
<!-- src/App.vue -->
<template>
  <QdadmApp />
</template>

<script setup>
import { QdadmApp } from 'qdadm'
</script>
```

---

## Key Patterns Summary

| Pattern | How |
|---------|-----|
| Register entity | `ctx.entity('name', new EntityManager({...}))` |
| Register CRUD routes | `ctx.crud('name', { list, form }, { nav })` |
| Child entity | `children: { chapters: { entity, foreignKey, label } }` on parent |
| Child routes | `ctx.crud('chapters', {...}, { parentRoute: 'book', foreignKey })` |
| Storage (mock) | `new MockApiStorage({ entityName, initialData })` |
| Storage (REST) | `new ApiStorage({ endpoint: '/api/books', client: axios })` |
| Hooks | `kernel.hooks.register('entity:presave', handler, { priority })` |
| Signals | `ctx.on('entity:data-invalidate', handler)` |
| Zones | `ctx.zone('name')` + `ctx.block('name', { component, weight })` |

---

## Next Steps

- Add **security**: see the [Security docs](security.md)
- Add **hooks** for audit timestamps: see the [Hooks docs](hooks.md)
- Add **zones** for custom UI panels: see the [Zones docs](zones.md)
- Use a **real API**: swap `MockApiStorage` for `ApiStorage`
- Check the [demo app](../packages/demo) for a full-featured example
