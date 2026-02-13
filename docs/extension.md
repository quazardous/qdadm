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
  }

  resolveStorage(method, context) {
    const parent = context?.parentChain?.at(-1)

    if (parent?.entity === 'projects') {
      // Return full endpoint - uses primary storage
      return `/api/projects/${parent.id}/tasks`
    }

    // undefined = use default storage.endpoint
  }
}
```

### Return Value Options

`resolveStorage()` can return:

| Return Value | Behavior |
|--------------|----------|
| `undefined` / `null` | Use default `storage.endpoint` |
| `string` | Full endpoint URL, use primary storage |
| `function` | Dynamic endpoint builder `(context) => string` |
| `{ endpoint: string }` | Full endpoint URL, use primary storage |
| `{ endpoint: function }` | Dynamic endpoint builder |
| `{ endpoint, params }` | Endpoint with default query params |
| `{ storage, endpoint }` | Custom storage with endpoint |

### Default Query Params

Return `params` to add default query parameters that get merged with request params:

```js
resolveStorage(method, context) {
  const parent = context?.parentChain?.at(-1)

  if (parent?.entity === 'projects') {
    return {
      endpoint: `/api/projects/${parent.id}/tasks`,
      // These params are merged with request params (request params override)
      params: { include: 'project', status: 'active' }
    }
  }
}
```

Request params override resolved params, so `list({ status: 'completed' })` would use `status: 'completed'` instead of `status: 'active'`.

### Field Defaults with Context

Field defaults can be functions that receive the routing context:

```js
class TasksManager extends EntityManager {
  constructor() {
    super({
      name: 'tasks',
      storage: new ApiStorage({ endpoint: '/api/tasks' }),
      fields: {
        title: { type: 'text', required: true },
        // Static default
        status: { type: 'text', default: 'pending' },
        // Dynamic default from parent context
        projectId: {
          type: 'text',
          default: (context) => context?.parentChain?.at(-1)?.id
        }
      }
    })
  }
}
```

- `getInitialData(context)` - returns all field defaults for new entity forms
- `applyDefaults(data, context)` - merges defaults into provided data (used by `create()`)
- Defaults are applied before `presave` hooks in `create()`

### Dynamic Endpoint Builders

Return a function when the endpoint depends on context. This marks the endpoint as "dynamic" for tools like debug panels that need to know the endpoint can't be used without context:

```js
resolveStorage(method, context) {
  const parent = context?.parentChain?.at(-1)

  if (parent?.entity === 'projects') {
    // Return a builder function - marks endpoint as context-dependent
    return (ctx) => `/api/projects/${ctx.parentChain.at(-1).id}/tasks`
  }
}
```

The `isDynamic` flag in the resolved result indicates the endpoint was built from a function.

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

    // /api/organizations/:orgId/projects/:projId/tasks
    if (chain.length === 2
        && chain[0].entity === 'organizations'
        && chain[1].entity === 'projects') {
      return `/api/organizations/${chain[0].id}/projects/${chain[1].id}/tasks`
    }

    // /api/projects/:projId/tasks
    const parent = chain.at(-1)
    if (parent?.entity === 'projects') {
      return `/api/projects/${parent.id}/tasks`
    }

    // /api/tasks (global) - use default storage.endpoint
  }
}
```

### Using Different Storages

When you need different API conventions (param mapping, normalization), use separate storages:

```js
class TasksManager extends EntityManager {
  constructor() {
    // Global tasks endpoint
    super({
      name: 'tasks',
      storage: new ApiStorage({ endpoint: '/api/tasks' })
    })

    // Legacy API with different field names
    this.legacyStorage = new ApiStorage({
      endpoint: '/api/v1/legacy',
      normalize: (apiData) => ({
        id: apiData.task_id,
        title: apiData.name,
        status: apiData.state
      }),
      denormalize: (data) => ({
        task_id: data.id,
        name: data.title,
        state: data.status
      })
    })
  }

  resolveStorage(method, context) {
    if (context?.useLegacy) {
      return { storage: this.legacyStorage, endpoint: '/api/v1/legacy/tasks' }
    }
    // Default: use primary storage
  }
}
```

### Data Normalization

When endpoints return different field names, use storage-level normalization:

```js
const storage = new ApiStorage({
  endpoint: '/api/tasks',
  // API → internal format
  normalize: (apiData, context) => ({
    id: apiData.task_id,
    title: apiData.name,
    status: apiData.state,
    // Use context to inject parent ID if missing from API response
    projectId: apiData.project_id ?? context?.parentChain?.at(-1)?.id
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

### Important: Consistent Internal Schema

**The internal schema must be consistent** across all endpoints, including parent reference fields.

This can be achieved by:
1. **API-level**: All endpoints return the same fields
2. **Storage-level**: Use `normalize()` to add missing fields
3. **EntityManager-level**: Transform in `onQueryResult` or custom methods

```
API returns different schemas:
  GET /api/tasks            → { id, title, project_id }
  GET /api/projects/42/tasks → { id, title }  ← Missing project_id

Option A: API-level - ensure all endpoints return same fields (recommended)

Option B: Storage-level - normalize with context:
  this.projectStorage = new ApiStorage({
    endpoint: '/api/projects',
    normalize: (item, context) => ({
      id: item.id,
      title: item.title,
      projectId: item.project_id ?? context?.parentChain?.at(-1)?.id
    })
  })

Option C: EntityManager-level - normalize after fetch:
  async list(params, context) {
    const result = await super.list(params, context)
    const parentId = context?.parentChain?.at(-1)?.id
    if (parentId) {
      result.items = result.items.map(item => ({
        ...item,
        projectId: item.projectId ?? parentId
      }))
    }
    return result
  }

Result: EntityManager always sees { id, title, projectId }
```

### Normalize Context

The `context` object passed to `normalize(item, context)` contains:

| Property | Type | Description |
|----------|------|-------------|
| `parentChain` | `Array<{entity, id}>` | Parent hierarchy from root to direct parent |

```js
// Example context for /organizations/1/projects/42/tasks
context = {
  parentChain: [
    { entity: 'organizations', id: '1' },
    { entity: 'projects', id: '42' }
  ]
}

// Access helpers in normalize()
normalize: (item, ctx) => ({
  ...item,
  projectId: item.projectId ?? ctx?.parentChain?.at(-1)?.id,      // '42'
  orgId: item.orgId ?? ctx?.parentChain?.at(0)?.id                 // '1'
})
```

Why this matters:
- **Local filtering**: `useListPage` adds parent filters (e.g., `projectId=42`) for cache filtering
- **Cache consistency**: Items must be filterable regardless of how they were fetched
- **Predictable behavior**: Same entity shape everywhere avoids subtle bugs

### Limitations

Multi-storage routes CRUD operations but some EntityManager features only work with the **primary storage**:

| Feature | Multi-storage support |
|---------|----------------------|
| CRUD operations | ✓ Routed per context |
| Data normalization | ✓ Per storage |
| Cache (`ensureCache`) | ✗ Primary storage only |
| Stats (`getStats`) | ✗ Entity-level only |
| Warmup | ✗ Primary storage only |

The cache limitation exists because `ensureCache()` calls `list()` without context, so it always uses the default storage. A future version may support per-storage caching.

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
- [QuarKernel](../packages/quarkernel/) (signal bus library)
