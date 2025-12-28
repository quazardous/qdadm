# Extension Patterns

How to extend qdadm without modifying core code.

## Hooks (Drupal-inspired)

Modules can intercept and modify behavior at defined points.

### Hook Types

| Type | Purpose | Example |
|------|---------|---------|
| **Lifecycle** | React to events | `entity:presave`, `entity:postsave` |
| **Alter** | Modify configuration | `form:alter`, `list:alter`, `menu:alter` |
| **Filter** | Transform data | `entity:load`, `entity:prepare` |

### Decorator Pattern

Hooks can wrap existing behavior:
- **Replace** - substitute entirely
- **Extend** - add after parent
- **Wrap** - surround parent

This allows modules to modify other modules without tight coupling.

## Zones & Blocks (Twig-inspired)

UI extensibility via named slots and injectable components.

### Concepts

| Term | Definition |
|------|------------|
| **Zone** | Named slot in a layout (WHERE) |
| **Block** | Component that fills a zone (WHAT) |
| **Weight** | Order within a zone |

### Standard Zones

Layouts provide standard zones:
- `header`, `menu`, `breadcrumb`
- `sidebar`, `main`, `aside`
- `footer`, `toaster`, `notifications`

Page types add specific zones:
- List: `before-table`, `table`, `after-table`, `pagination`
- Form: `before-form`, `form-fields`, `after-form`, `actions`

### Three-Level Inheritance

Inspired by Symfony/Twig best practice:

```
BaseLayout      → All zones defined
  ↓ extends
TypeLayout      → List, Form, Dashboard specific
  ↓ extends
EntityPage      → books, users specific
```

Each level can override or extend parent zones.

## Signal Bus (QuarKernel)

Event-driven communication between components.

### Why Signals?

- **Loose coupling** - Components don't import each other
- **No dependency anti-patterns** - Communication via events
- **Reactive updates** - State changes propagate automatically

### Usage

Components emit signals, others subscribe. No direct references.

This enables:
- Cross-module communication
- Audit trails (log all entity changes)
- Real-time updates
- Plugin systems

## EntityManager Decorators

Wrap EntityManager instances to add cross-cutting concerns without modifying the base class.

### When to Use Decorators vs Hooks

| Approach | Use Case | Scope |
|----------|----------|-------|
| **Hooks** | React to events, alter config | Global (all entities) |
| **Decorators** | Wrap CRUD operations | Per-manager instance |

Use **hooks** when you need to respond to events across all entities (e.g., audit all changes).

Use **decorators** when you need behavior specific to one manager instance (e.g., soft-delete for only the `users` entity).

### createDecoratedManager

Apply a chain of decorators to wrap an EntityManager:

```js
import { createDecoratedManager, withAuditLog, withTimestamps } from 'qdadm'

const enhancedBooks = createDecoratedManager(booksManager, [
  withTimestamps(),
  withAuditLog(console.log)
])
```

Decorators apply in order: first wraps the base, last is outermost. When a method is called, execution flows from outermost to innermost and back.

### Built-in Decorators

#### withAuditLog

Logs CRUD operations with timestamps:

```js
withAuditLog(logger, { includeData: false })

// Logger receives: (action, { entity, id, timestamp, data? })
```

#### withSoftDelete

Converts delete to update with timestamp:

```js
withSoftDelete({ field: 'deleted_at', timestamp: () => new Date().toISOString() })

// delete(1) becomes patch(1, { deleted_at: '...' })
```

#### withTimestamps

Adds created_at/updated_at timestamps:

```js
withTimestamps({
  createdAtField: 'created_at',
  updatedAtField: 'updated_at',
  timestamp: () => new Date().toISOString()
})
```

#### withValidation

Validates data before create/update:

```js
withValidation((data, context) => {
  const errors = {}
  if (!data.title) errors.title = 'Required'
  return Object.keys(errors).length ? errors : null
}, { onUpdate: true, onPatch: true })
```

### Custom Decorators

Create your own decorator by following the pattern:

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

Key points:
- Return a function that takes manager and returns enhanced manager
- Spread the original manager to preserve untouched methods
- Forward `name` as a getter (it may be defined as a getter on the original)
- Call the wrapped manager's method and add your behavior around it

### Composition Example

Stack multiple decorators for complex behavior:

```js
const productionBooks = createDecoratedManager(booksManager, [
  // Innermost: adds timestamps to data
  withTimestamps(),
  // Then: validates the timestamped data
  withValidation((data) => data.title ? null : { title: 'Required' }),
  // Then: converts delete to soft-delete
  withSoftDelete(),
  // Outermost: logs all operations
  withAuditLog(auditService.log)
])
```

Execution order for `create({ title: 'Book' })`:
1. Audit log (before)
2. Validation
3. Timestamps add fields
4. Base manager.create()
5. Timestamps (no post-processing)
6. Validation (no post-processing)
7. Audit log (after - logs the result)

## Hook Bundles

Bundles package multiple related hooks into a reusable feature. Unlike decorators that wrap a single manager, bundles register global hooks that apply across entities.

### When to Use Bundles vs Decorators

| Approach | Use Case | Scope |
|----------|----------|-------|
| **Decorators** | Per-manager instance wrapping | Single entity manager |
| **Bundles** | Cross-cutting via hooks | All entities via hooks |

Use **decorators** when you need to wrap a specific manager instance.

Use **bundles** when you need to register hooks that work via the global hook system.

### Built-in Bundles

#### withTimestamps

Automatically manages created_at and updated_at:

```js
import { applyBundle, withTimestamps } from 'qdadm'

applyBundle(kernel.hooks, withTimestamps({
  createdAtField: 'created_at',  // default
  updatedAtField: 'updated_at',  // default
  timestamp: () => new Date().toISOString()  // default
}))
```

#### withSoftDelete

Prevents deletion by setting a timestamp instead:

```js
import { applyBundle, withSoftDelete } from 'qdadm'

applyBundle(kernel.hooks, withSoftDelete({
  field: 'deleted_at',  // default
  timestamp: () => new Date().toISOString()  // default
}))
```

Automatically filters deleted records from lists unless `includeDeleted: true`.

#### withVersioning

Optimistic locking via version field:

```js
import { applyBundle, withVersioning } from 'qdadm'

applyBundle(kernel.hooks, withVersioning({
  field: 'version',  // default
  validateOnUpdate: true  // default
}))
```

Throws `VersionConflictError` when versions mismatch.

#### withAuditLog

Logs all entity operations:

```js
import { applyBundle, withAuditLog } from 'qdadm'

applyBundle(kernel.hooks, withAuditLog({
  logger: console.log,  // default
  includeData: false,   // default
  includeDiff: false    // default
}))
```

### Applying Multiple Bundles

```js
import { applyBundles, withTimestamps, withVersioning } from 'qdadm'

const cleanup = applyBundles(kernel.hooks, [
  withTimestamps(),
  withVersioning(),
  withAuditLog({ logger: auditService.log })
])

// Later: cleanup()  // Removes all bundle hooks
```

### Custom Bundles

Create bundles with `createHookBundle`:

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

// Usage:
applyBundle(kernel.hooks, withSlugGeneration({ sourceField: 'name' }))
```

Bundle handlers receive standard QuarKernel events. Context available in `event.data`.

## See Also

- [Drupal Hooks](https://www.drupal.org/docs/develop/creating-modules/understanding-hooks)
- [Twig Template Inheritance](https://twig.symfony.com/doc/3.x/tags/extends.html)
- [QuarKernel](../../quarkernel/) (signal bus library)
