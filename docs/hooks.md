# Hooks

Drupal-inspired hook system for intercepting and modifying behavior.

## Problem

How to let modules alter behavior without subclassing or patching?

**Without hooks:**
```js
// Must subclass or monkey-patch to add validation
class BookManager extends EntityManager {
  async create(data) {
    // Custom validation
    if (!data.isbn) throw new Error('ISBN required')
    return super.create(data)
  }
}
```

Every customization requires a new class.

**With hooks:**
```js
// Register hook - no subclassing needed
hooks.register('entity:presave', async ({ entity, data }) => {
  if (entity === 'books' && !data.isbn) {
    throw new Error('ISBN required')
  }
})

// Original EntityManager unchanged
const book = await booksManager.create({ title: 'Test' })
// Hook runs, throws if no ISBN
```

## Hook Types

### Lifecycle Hooks

Fire-and-forget events. Handlers run but don't return values.

```js
hooks.register('entity:postsave', async ({ entity, data, isNew }) => {
  await auditLog.write(`${entity} ${isNew ? 'created' : 'updated'}`, data)
})
```

Invoked with `hooks.invoke()`.

### Alter Hooks

Transform data through a chain of handlers. Each handler receives and returns modified data.

```js
hooks.register('list:alter', (config, { entity }) => {
  if (entity === 'books') {
    // Add computed column
    config.columns.push({
      field: 'availability',
      header: 'Status',
      computed: true
    })
  }
  return config  // Must return modified config
})
```

Invoked with `hooks.alter()`.

## Built-in Hooks

### Entity Lifecycle

| Hook | When | Payload |
|------|------|---------|
| `entity:presave` | Before create/update | `{ entity, data, isNew }` |
| `entity:postsave` | After create/update | `{ entity, data, isNew, result }` |
| `entity:predelete` | Before delete | `{ entity, id }` |
| `entity:postdelete` | After delete | `{ entity, id, result }` |

### Configuration Alter

| Hook | Purpose | Data |
|------|---------|------|
| `list:alter` | Modify list page config | `{ columns, filters, ... }` |
| `form:alter` | Modify form config | `{ fields, layout, ... }` |
| `menu:alter` | Modify navigation | `{ items, sections }` |

## Basic Usage

### Access HookRegistry

```js
// Via orchestrator
const orchestrator = inject('qdadmOrchestrator')
orchestrator.hooks.register('entity:presave', handler)

// Via direct inject
const hooks = inject('qdadmHooks')
hooks.register('entity:presave', handler)

// In composable
const { hooks } = useOrchestrator()
```

### Register a Hook

```js
// Lifecycle hook
hooks.register('entity:presave', async ({ entity, data, isNew }) => {
  if (entity === 'books') {
    // Validate before save
    if (!data.title) throw new Error('Title required')
  }
})

// Alter hook
hooks.register('list:alter', (config, context) => {
  // Add filter to all lists
  config.filters.push({ field: 'active', default: true })
  return config
})
```

### With Options

```js
hooks.register('entity:presave', handler, {
  priority: 100,     // Higher = runs earlier
  id: 'isbn-validator',
  module: 'books'    // For debugging
})
```

### Invoke Hooks

```js
// Lifecycle (fire-and-forget)
await hooks.invoke('entity:presave', {
  entity: 'books',
  data: bookData,
  isNew: true
})

// Alter (chained transforms)
const finalConfig = await hooks.alter('list:alter', initialConfig, {
  entity: 'books'
})
```

## Patterns

### Validation Hook

```js
hooks.register('entity:presave', async ({ entity, data }) => {
  const errors = await validate(entity, data)
  if (errors.length > 0) {
    throw new ValidationError(errors)
  }
})
```

### Audit Hook

```js
hooks.register('entity:postsave', async ({ entity, data, isNew }) => {
  await auditLog.write({
    action: isNew ? 'create' : 'update',
    entity,
    data,
    user: getCurrentUser(),
    timestamp: new Date()
  })
})
```

### Soft Delete Hook

```js
hooks.register('entity:predelete', async ({ entity, id }, context) => {
  if (entity === 'users') {
    // Convert delete to soft-delete
    await usersManager.update(id, { deleted_at: new Date() })
    context.preventDefault()  // Stop actual delete
  }
})
```

### Config Alter Hook

```js
hooks.register('list:alter', (config, { entity }) => {
  if (entity === 'books') {
    // Add custom action button
    config.actions.push({
      label: 'Export',
      icon: 'pi pi-download',
      handler: exportBooks
    })
  }
  return config
})
```

## Hooks vs Signals vs Decorators

| Mechanism | Purpose | Scope |
|-----------|---------|-------|
| **Hooks** | Intercept and modify | Global (all entities) |
| **Signals** | React to events | Loose coupling, fire-and-forget |
| **Decorators** | Wrap CRUD operations | Per-manager instance |

**Use hooks when:**
- You need to validate/transform data
- You want to react to ALL entities
- You need to prevent default behavior

**Use signals when:**
- You just need to react (no modification)
- Consumers are independent
- Fire-and-forget is acceptable

**Use decorators when:**
- Behavior is specific to one manager
- You need to wrap the entire operation
- You want composable behavior chains

## API Reference

### HookRegistry Methods

```js
// Registration
hooks.register(name, handler, options?)   // Returns unbind function
hooks.unregister(name, handlerId)         // Remove by ID

// Invocation
hooks.invoke(name, context)               // Lifecycle (fire-and-forget)
hooks.alter(name, data, context?)         // Alter (chained transforms)

// Introspection
hooks.getHandlers(name)                   // List handlers
hooks.hasHandlers(name)                   // Check if any registered
```

### Handler Options

| Option | Type | Description |
|--------|------|-------------|
| `priority` | number | Execution order (higher = earlier) |
| `id` | string | Unique handler identifier |
| `module` | string | Module name (for debugging) |

### Context Object

Lifecycle hooks receive a context object with control methods:

```js
hooks.register('entity:predelete', (payload, context) => {
  context.preventDefault()  // Stop default behavior
  context.stopPropagation() // Stop remaining handlers
})
```

## Best Practices

1. **Use descriptive hook names**: `entity:presave` not `beforeSave`
2. **Keep handlers focused**: One responsibility per handler
3. **Always return in alter hooks**: Forgetting breaks the chain
4. **Use priority wisely**: Validation early (high), logging late (low)
5. **Handle errors gracefully**: Don't break the chain unexpectedly
