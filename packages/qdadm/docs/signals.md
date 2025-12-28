# Signals

Event-driven communication via SignalBus (QuarKernel wrapper).

## Problem

How to communicate between components without tight coupling?

**Without signals:**
```js
// BookService must know about all consumers
class BookService {
  async create(data) {
    const book = await this.storage.create(data)
    // Tight coupling to every feature that cares
    this.auditLog.log('book created', book)
    this.cache.invalidate('books')
    this.notifications.send('New book added')
    this.analytics.track('book_created')
    return book
  }
}
```

Adding a new consumer requires editing BookService.

**With signals:**
```js
class BookService {
  async create(data) {
    const book = await this.storage.create(data)
    // Fire and forget - consumers subscribe independently
    this.signals.emit('books:created', { data: book })
    return book
  }
}

// Consumers subscribe without touching BookService
signals.on('books:created', ({ data }) => auditLog.log('book created', data))
signals.on('books:created', ({ data }) => cache.invalidate('books'))
signals.on('*:created', ({ entity, data }) => analytics.track(`${entity}_created`))
```

## Architecture Rule

**Business logic → SignalBus, Presentation → Vue**

| Channel | Purpose | Examples |
|---------|---------|----------|
| SignalBus | Services communicating | `auth:login`, `entity:updated`, `cache:invalidate` |
| Vue patterns | UI state changes | props/emit, provide/inject, Pinia |

When both need to react, use **parallel approach**: actuator fires both channels.

```js
// Login handler fires both channels
async function handleLogin() {
  const { user } = await authAdapter.login(credentials)

  // Business channel (services)
  orchestrator.signals.emit('auth:login', { user })

  // Presentation channel (Vue)
  router.push('/')
}
```

## Signal Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `entity:*` | Data lifecycle | `books:created`, `entity:updated`, `users:deleted` |
| `auth:*` | Session events | `auth:login`, `auth:logout`, `auth:impersonate:start` |
| `cache:*` | Infrastructure | `cache:invalidate`, `cache:clear` |

## Basic Usage

### Access SignalBus

```js
// Via orchestrator (recommended)
const orchestrator = inject('qdadmOrchestrator')
orchestrator.signals.emit('my:signal', payload)

// Via direct inject
const signals = inject('qdadmSignals')
signals.emit('my:signal', payload)

// In EntityManager context
const { signals } = useOrchestrator()
signals.emit('my:signal', payload)
```

### Emit a Signal

```js
// Simple emit
signals.emit('books:created', { data: newBook })

// Entity lifecycle (emits both specific and generic)
signals.emitEntity('books', 'created', newBook)
// Emits: 'books:created' then 'entity:created'
```

### Subscribe to Signals

```js
// Basic subscription
const unbind = signals.on('books:created', (payload) => {
  console.log('New book:', payload.data)
})

// With options
signals.on('books:updated', handler, {
  priority: 100,  // Higher = earlier
  id: 'my-handler',
  once: true  // Auto-remove after first call
})

// Unsubscribe
unbind()
// or
signals.off('books:created', handler)
```

### Wildcards

QuarKernel supports wildcard patterns:

```js
// Match all book signals
signals.on('books:*', ({ data }) => {
  console.log('Book event:', data)
})

// Match all creation events
signals.on('*:created', ({ entity, data }) => {
  console.log(`${entity} created:`, data)
})

// Match all entity events
signals.on('entity:*', ({ entity, data }) => {
  auditLog.append(entity, data)
})
```

### Promise-based (once)

```js
// Wait for next signal
const event = await signals.once('auth:login', { timeout: 5000 })
console.log('User logged in:', event.user)
```

## Entity Signals

EntityManager automatically emits signals on CRUD operations:

| Signal | When | Payload |
|--------|------|---------|
| `{entity}:created` | After create | `{ entity, data }` |
| `{entity}:updated` | After update | `{ entity, data }` |
| `{entity}:deleted` | After delete | `{ entity, data }` |
| `entity:created` | After any create | `{ entity, data }` |
| `entity:updated` | After any update | `{ entity, data }` |
| `entity:deleted` | After any delete | `{ entity, data }` |

Example: Creating a book emits `books:created` then `entity:created`.

## Auth Signals

Emit auth signals for session lifecycle:

```js
// On login
orchestrator.signals.emit('auth:login', { user })

// On logout
orchestrator.signals.emit('auth:logout', { user })

// On impersonation
orchestrator.signals.emit('auth:impersonate:start', { target, original })
orchestrator.signals.emit('auth:impersonate:end', { original })
```

Consumers can react (e.g., clear caches, update UI state, log audit).

## API Reference

### SignalBus Methods

```js
// Emit
signals.emit(signal, payload)              // Fire signal
signals.emitEntity(entity, action, data)   // Fire entity + generic

// Subscribe
signals.on(signal, handler, options?)      // Returns unbind function
signals.off(signal, handler?)              // Unsubscribe
signals.once(signal, options?)             // Promise-based one-time

// Introspection
signals.listenerCount(signal?)             // Count listeners
signals.signalNames()                      // List registered signals
signals.offAll(signal?)                    // Remove all listeners
```

### Handler Options

| Option | Type | Description |
|--------|------|-------------|
| `priority` | number | Execution order (higher = earlier) |
| `id` | string | Unique handler identifier |
| `after` | string[] | Run after these handler IDs |
| `once` | boolean | Auto-remove after first call |

### Signal Payload Convention

```js
// Entity signals
{ entity: 'books', data: { id, title, ... } }

// Auth signals
{ user: { id, username, role } }

// Generic signals
{ ...contextual data }
```

## Best Practices

1. **Use signal categories**: `domain:action` format (`books:created`, `auth:login`)
2. **Keep handlers fast**: Don't block the signal chain
3. **Use wildcards for cross-cutting**: Audit logs, analytics, caching
4. **Emit before side effects complete**: Fire-and-forget pattern
5. **Business in SignalBus, UI in Vue**: Don't mix channels
