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

### 2. List page (minimal)

```vue
<script setup>
import { ref, onMounted } from 'vue'
import { useOrchestrator } from 'qdadm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'

const { getManager } = useOrchestrator()
const tasks = ref([])

onMounted(async () => {
  const result = await getManager('tasks').list()
  tasks.value = result.items
})
</script>

<template>
  <DataTable :value="tasks" stripedRows>
    <Column field="title" header="Title" />
    <Column field="done" header="Done" />
  </DataTable>
</template>
```

This shows the core pattern:
- `useOrchestrator()` to get the manager
- `manager.list()` to fetch data
- PrimeVue DataTable for display

## Next steps

See `packages/demo` for a complete example with:
- Multiple entities
- Forms & validation
- Custom actions
- Authentication
- Module system
