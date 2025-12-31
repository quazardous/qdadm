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

### 1. EntityManager setup

```javascript
import { createQdadm, MockApiStorage, EntityManager } from 'qdadm'

// Create EntityManager instance
const tasksManager = new EntityManager({
  name: 'tasks',
  label: 'Task',
  labelField: 'title',
  storage: new MockApiStorage({
    entityName: 'tasks',
    initialData: [...]
  }),
  fields: {
    title: { type: 'text', label: 'Title' },
    done: { type: 'boolean', label: 'Done' }
  }
})

// Pass to createQdadm
const qdadm = createQdadm({
  router,
  toast: { add: () => {}, remove: () => {} },
  features: { auth: false },
  managers: { tasks: tasksManager }
})
```

### 2. List page (canonical)

```vue
<script setup>
import { useListPageBuilder, ListPage } from 'qdadm'
import Column from 'primevue/column'

const list = useListPageBuilder({ entity: 'tasks' })
</script>

<template>
  <ListPage v-bind="list.props.value" v-on="list.events">
    <template #columns>
      <Column field="title" header="Title" sortable />
      <Column field="done" header="Done" />
    </template>
  </ListPage>
</template>
```

This shows the canonical pattern:
- `useListPageBuilder({ entity })` handles all data fetching
- `ListPage` provides table, pagination, loading states
- Just define your columns in the `#columns` slot

## Next steps

See `packages/demo` for a complete example with:
- Multiple entities
- Forms & validation
- Custom actions
- Authentication
- Module system
