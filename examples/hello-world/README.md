# qdadm Hello World

Minimal example showing a qdadm list page in ~50 lines of code.

## What's included

- `main.js` - App setup with one EntityManager (tasks)
- `App.vue` - AppLayout wrapper
- `TaskList.vue` - List page (5 lines!)

## Run it

```bash
cd examples/hello-world
npm install
npm run dev
```

## Key concepts

### 1. EntityManager config

```javascript
managers: {
  tasks: {
    storage: new MockApiStorage({ initialData: [...] }),
    fields: {
      title: { type: 'text', label: 'Title' },
      done: { type: 'boolean', label: 'Done' }
    }
  }
}
```

### 2. List page (minimal)

```vue
<script setup>
import { useListPageBuilder, ListPage } from 'qdadm'

const list = useListPageBuilder({ entity: 'tasks' })
list.addColumn('title')
list.addColumn('done')
</script>

<template>
  <ListPage v-bind="list.props" />
</template>
```

That's it. qdadm handles:
- Data fetching & pagination
- Column rendering
- Search & filters (add with `list.setSearch()`, `list.addFilter()`)
- CRUD actions (add with `list.addAction()`)

## Next steps

See `packages/demo` for a complete example with:
- Multiple entities
- Forms & validation
- Custom actions
- Authentication
- Module system
