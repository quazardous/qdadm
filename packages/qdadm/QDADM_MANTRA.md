# qdadm Philosophy

## Core Principle: Declaration Over Implementation

qdadm is an **ultra-DRY** admin framework. 80% of admin pages are built by declaring WHAT you want, not HOW to get it.

## The Ideal Page

```vue
<script setup>
import { useListPageBuilder, ListPage, Column } from 'qdadm'

const list = useListPageBuilder({ entity: 'books' })
list.setSearch({ fields: ['title', 'author'] })
list.addCreateAction()
list.addEditAction()
list.addDeleteAction()
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="author" header="Author" sortable />
    </template>
  </ListPage>
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

## When Custom Code is OK

1. **Dashboards** - Stats/metrics displays (consider a stats builder)
2. **Wizards** - Multi-step flows
3. **Reports** - Complex visualizations

Even these should use EntityManager for data access.

## Summary

| Principle | Description |
|-----------|-------------|
| DRY | Declare once, use everywhere |
| Invisible storage | Pages don't know storage exists |
| Representative demo | Real app, not technical showcases |
| EntityManager first | All data through managers |
| ListPage default | Custom DataTable only when justified |

## Deep Dives

| Doc | Topic |
|-----|-------|
| [Architecture](./docs/architecture.md) | PAC pattern, layer separation, no-template-ish |
| [Extension](./docs/extension.md) | Hooks, zones/blocks, signal bus |
| [Security](./docs/security.md) | Scope vs silo, AuthAdapter |

## References

- [PAC Architecture](https://en.wikipedia.org/wiki/Presentation–abstraction–control)
- [Drupal Hooks](https://www.drupal.org/docs/develop/creating-modules/understanding-hooks)
- [Twig Inheritance](https://symfony.com/doc/current/templates.html)
- [Renderless Components](https://www.patterns.dev/vue/renderless-components)
