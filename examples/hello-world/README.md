# qdadm Hello World

Minimal example showing a qdadm list page in ~50 lines of code.

## What's included

- `main.js` - Kernel bootstrap with one module (tasks)
- `App.vue` - RouterView root (the Kernel mounts AppLayout as the layout route)
- `TaskList.vue` - List page (5 lines!)

## Run it

```bash
cd examples/hello-world
npm install
npm run dev
```

## Key concepts

### 1. Module + Kernel setup (canonical)

```javascript
import { Kernel, Module, EntityManager, MockApiStorage } from '@quazardous/qdadm'
import { AppLayout } from '@quazardous/qdadm/components'

class TasksModule extends Module {
  static name = 'tasks'

  async connect(ctx) {
    ctx.entity('tasks', new EntityManager({
      name: 'tasks',
      labelField: 'title',
      fields: {
        title: { type: 'text', label: 'Title' },
        done: { type: 'boolean', label: 'Done' }
      },
      storage: new MockApiStorage({ entityName: 'tasks', initialData: [...] })
    }))

    ctx.crud('tasks', {
      list: () => import('./TaskList.vue')
    }, { nav: { section: 'Main', icon: 'pi pi-check-square' } })
  }
}

const kernel = new Kernel({
  root: App,
  moduleDefs: [TasksModule],
  pages: { layout: AppLayout },   // the admin shell (sidebar, breadcrumb…)
  homeRoute: 'tasks',
  primevue: { plugin: PrimeVue, theme: Aura },
  app: { name: 'Hello qdadm' }
})

kernel.createApp().mount('#app')
```

No hand-rolled router, no toast stub: the Kernel builds routes from the
module and installs the PrimeVue services itself. The `qdadmVitePlugin()`
in `vite.config.js` supplies the dedupe/optimizeDeps config qdadm needs.

### 2. List page (canonical)

```vue
<script setup>
import { useListPage, ListPage } from '@quazardous/qdadm'
import Column from 'primevue/column'

const list = useListPage({ entity: 'tasks' })
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
- `useListPage({ entity })` handles all data fetching
- `ListPage` provides table, pagination, loading states
- Just define your columns in the `#columns` slot

## Next steps

See `packages/demo` for a complete example with:
- Multiple entities
- Forms & validation
- Custom actions
- Authentication
- Module system
