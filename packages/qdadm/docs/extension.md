# Extension Patterns

How to extend qdadm without modifying core code.

## Overview

qdadm provides seven extension mechanisms:

| Mechanism | Purpose | Coupling | Scope |
|-----------|---------|----------|-------|
| [Zones](./zones.md) | UI composition | None | Layout slots |
| [Signals](./signals.md) | Event communication | None | Cross-module |
| [EventRouter](./signals.md#eventrouter) | Signal transformation | None | Global routing |
| [Hooks](./hooks.md) | Intercept & modify | Low | Global behavior |
| [Deferred](./deferred.md) | Async coordination | None | Service loading |
| [Decorators](#decorators) | Wrap operations | Medium | Per-manager |
| [Multi-Storage](#multi-storage--multi-endpoint) | Context-aware routing | Low | Per-manager |

## Quick Comparison

### When to use what?

| Need | Use |
|------|-----|
| Add UI to another module's page | Zones |
| React to events without coupling | Signals |
| Route one event to multiple targets | EventRouter |
| Validate/transform all entities | Hooks |
| Await service/cache readiness | Deferred |
| Add behavior to one manager | Decorators |
| Entity via multiple API endpoints | Multi-Storage |

### Example: Adding audit logging

```js
// With Signals (fire-and-forget, no modification)
signals.on('entity:*', ({ entity, data }) => {
  auditLog.write(entity, data)
})

// With Hooks (can prevent/modify)
hooks.register('entity:postsave', ({ entity, data }) => {
  auditLog.write(entity, data)
})

// With Decorators (wraps specific manager)
const auditedBooks = createDecoratedManager(booksManager, [
  withAuditLog(auditLog.write)
])
```

## Detailed Documentation

- **[Zones & Blocks](./zones.md)** - UI extensibility via named slots
- **[Signals](./signals.md)** - Event-driven communication (SignalBus)
- **[Hooks](./hooks.md)** - Drupal-inspired hook system
- **[Deferred](./deferred.md)** - Async service coordination & warmup

---

## Decorators

Wrap EntityManager instances to add cross-cutting concerns.

### When to Use Decorators vs Hooks

| Approach | Use Case | Scope |
|----------|----------|-------|
| **Hooks** | React to events, alter config | Global (all entities) |
| **Decorators** | Wrap CRUD operations | Per-manager instance |

Use **hooks** when you need to respond to events across all entities.

Use **decorators** when you need behavior specific to one manager.

### createDecoratedManager

Apply a chain of decorators:

```js
import { createDecoratedManager, withAuditLog, withTimestamps } from 'qdadm'

const enhancedBooks = createDecoratedManager(booksManager, [
  withTimestamps(),
  withAuditLog(console.log)
])
```

Decorators apply in order: first wraps the base, last is outermost.

### Built-in Decorators

#### withAuditLog

```js
withAuditLog(logger, { includeData: false })
// Logger receives: (action, { entity, id, timestamp, data? })
```

#### withSoftDelete

```js
withSoftDelete({ field: 'deleted_at', timestamp: () => new Date().toISOString() })
// delete(1) becomes patch(1, { deleted_at: '...' })
```

#### withTimestamps

```js
withTimestamps({
  createdAtField: 'created_at',
  updatedAtField: 'updated_at',
  timestamp: () => new Date().toISOString()
})
```

#### withValidation

```js
withValidation((data, context) => {
  const errors = {}
  if (!data.title) errors.title = 'Required'
  return Object.keys(errors).length ? errors : null
}, { onUpdate: true, onPatch: true })
```

### Custom Decorators

```js
function withMyBehavior(options = {}) {
  return (manager) => ({
    ...manager,
    get name() { return manager.name },

    async create(data) {
      // Pre-processing
      const result = await manager.create(data)
      // Post-processing
      return result
    }
  })
}
```

---

## Hook Bundles

Bundles package multiple hooks into reusable features.

### Built-in Bundles

```js
import { applyBundle, withTimestamps, withSoftDelete, withVersioning } from 'qdadm'

applyBundle(kernel.hooks, withTimestamps())
applyBundle(kernel.hooks, withSoftDelete())
applyBundle(kernel.hooks, withVersioning())
```

### Multiple Bundles

```js
import { applyBundles } from 'qdadm'

const cleanup = applyBundles(kernel.hooks, [
  withTimestamps(),
  withVersioning(),
  withAuditLog({ logger: auditService.log })
])

// Later: cleanup()  // Removes all bundle hooks
```

### Custom Bundles

```js
import { createHookBundle, HOOK_PRIORITY } from 'qdadm'

const withSlugGeneration = createHookBundle('slugGeneration', (register, context) => {
  const { sourceField = 'title', slugField = 'slug' } = context.options

  register('entity:presave', (event) => {
    const { entity, isNew } = event.data
    if (isNew && !entity[slugField] && entity[sourceField]) {
      entity[slugField] = slugify(entity[sourceField])
    }
  }, { priority: HOOK_PRIORITY.NORMAL })
})
```

---

## Multi-Storage / Multi-Endpoint

Route CRUD operations to different API endpoints based on context.

### Use Case

A single entity accessed via multiple endpoints:

```
GET /api/tasks              → All tasks (admin view)
GET /api/projects/42/tasks  → Tasks scoped to project 42
GET /api/users/7/tasks      → Tasks assigned to user 7
```

### Implementation

Override `resolveStorage()` to route based on `parentChain`:

```js
class TasksManager extends EntityManager {
  constructor() {
    // Default storage (global endpoint)
    super({
      name: 'tasks',
      storage: new ApiStorage({ endpoint: '/api/tasks' })
    })
    // Additional storage for project-scoped access
    this.projectStorage = new ApiStorage({ endpoint: '/api/projects' })
  }

  resolveStorage(method, context) {
    const parent = context?.parentChain?.at(-1)

    if (parent?.entity === 'projects') {
      return {
        storage: this.projectStorage,
        path: `/${parent.id}/tasks`
      }
    }

    return { storage: this.storage }
  }
}
```

### Parent Chain Structure

The `parentChain` is an array from root ancestor to direct parent:

```js
// Route: /organizations/1/projects/42/tasks
context = {
  parentChain: [
    { entity: 'organizations', id: '1' },   // root
    { entity: 'projects', id: '42' }        // direct parent
  ]
}

// Access helpers
const parent = context?.parentChain?.at(-1)      // { entity: 'projects', id: '42' }
const root = context?.parentChain?.at(0)         // { entity: 'organizations', id: '1' }
const depth = context?.parentChain?.length || 0  // 2
```

### Nested Parents Example

```js
class TasksManager extends EntityManager {
  resolveStorage(method, context) {
    const chain = context?.parentChain || []

    // /organizations/:orgId/projects/:projId/tasks
    if (chain.length === 2
        && chain[0].entity === 'organizations'
        && chain[1].entity === 'projects') {
      return {
        storage: this.orgProjectStorage,
        path: `/${chain[0].id}/projects/${chain[1].id}/tasks`
      }
    }

    // /projects/:projId/tasks
    const parent = chain.at(-1)
    if (parent?.entity === 'projects') {
      return {
        storage: this.projectStorage,
        path: `/${parent.id}/tasks`
      }
    }

    // /tasks (global)
    return { storage: this.storage }
  }
}
```

### Different Param Mappings

Each storage can use different API conventions:

```js
resolveStorage(method, context) {
  const parent = context?.parentChain?.at(-1)

  if (parent?.entity === 'projects') {
    return {
      storage: this.projectStorage,
      path: `/${parent.id}/tasks`,
      mappingKey: 'project'  // Use project-specific param mapping
    }
  }

  return {
    storage: this.storage,
    mappingKey: 'global'
  }
}
```

### Data Normalization

When endpoints return different field names, use storage-level normalization:

```js
// Project-scoped API uses different field names
this.projectStorage = new ApiStorage({
  endpoint: '/api/projects',
  // API → internal format
  normalize: (apiData) => ({
    id: apiData.task_id,
    title: apiData.name,
    status: apiData.state,
    projectId: apiData.project_id
  }),
  // Internal → API format
  denormalize: (data) => ({
    task_id: data.id,
    name: data.title,
    state: data.status
  })
})
```

### Normalization Layers

Two levels of data transformation:

| Layer | Responsibility | Example |
|-------|----------------|---------|
| **Storage** | Technical format (API ↔ internal) | `task_id` → `id`, `name` → `title` |
| **EntityManager** | Business logic | Computed fields, validation, defaults |

Storage normalization is transparent - EntityManager always sees consistent field names.

### Backward Compatibility

Single-storage managers require **no changes**. The default `resolveStorage()` returns the configured storage:

```js
// No override needed for single-endpoint entities
const booksManager = new EntityManager({
  name: 'books',
  storage: new ApiStorage({ endpoint: '/api/books' })
})
```

---

## See Also

- [Drupal Hooks](https://www.drupal.org/docs/develop/creating-modules/understanding-hooks)
- [Twig Template Inheritance](https://twig.symfony.com/doc/3.x/tags/extends.html)
- [QuarKernel](../../quarkernel/) (signal bus library)
