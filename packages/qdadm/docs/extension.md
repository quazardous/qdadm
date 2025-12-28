# Extension Patterns

How to extend qdadm without modifying core code.

## Overview

qdadm provides four extension mechanisms:

| Mechanism | Purpose | Coupling | Scope |
|-----------|---------|----------|-------|
| [Zones](./zones.md) | UI composition | None | Layout slots |
| [Signals](./signals.md) | Event communication | None | Cross-module |
| [Hooks](./hooks.md) | Intercept & modify | Low | Global behavior |
| [Decorators](#decorators) | Wrap operations | Medium | Per-manager |

## Quick Comparison

### When to use what?

| Need | Use |
|------|-----|
| Add UI to another module's page | Zones |
| React to events without coupling | Signals |
| Validate/transform all entities | Hooks |
| Add behavior to one manager | Decorators |

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

## See Also

- [Drupal Hooks](https://www.drupal.org/docs/develop/creating-modules/understanding-hooks)
- [Twig Template Inheritance](https://twig.symfony.com/doc/3.x/tags/extends.html)
- [QuarKernel](../../quarkernel/) (signal bus library)
