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
| `auth:*` | Session events | `auth:login`, `auth:logout`, `auth:impersonate` |
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

Auth signals handle session lifecycle and security events:

| Signal | When | Payload | Default Handler |
|--------|------|---------|-----------------|
| `auth:login` | User logs in | `{ user }` | Resolves `auth:ready` deferred |
| `auth:logout` | User logs out | `{ user?, reason? }` | - |
| `auth:expired` | Token expired or 401/403 | `{ status?, url? }` | Logout + redirect to `/login` |
| `auth:impersonate` | Admin impersonates user | `{ target, original }` | - |
| `auth:impersonate:stop` | Impersonation ends | `{ original }` | - |

### Token Expiration Flow

Kernel automatically handles `auth:expired`:

```
API 401/403 → emit('auth:expired') → authAdapter.logout() → router.push('/login?expired=1')
```

To emit `auth:expired` from your API client:

```js
// Option 1: Use kernel.setupApiClient()
const client = axios.create({ baseURL: '/api' })
kernel.setupApiClient(client)  // Auto-emits auth:expired on 401/403

// Option 2: Manual interceptor
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      signals.emit('auth:expired', { status: error.response.status, url: error.config?.url })
    }
    return Promise.reject(error)
  }
)
```

### API Error Signal

For centralized error handling:

```js
// Emitted on any API error
signals.on('api:error', ({ status, message, url, error }) => {
  // Log to error tracking service
  errorTracker.capture(error)
})
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

## EventRouter

High-level signal routing for cross-cutting concerns. Configured in Kernel, transforms one signal into multiple target signals.

### Problem

Without routing, components must know global logic:

```js
// WRONG - EntityManager knows about auth
signals.on('auth:impersonate', () => {
  loansManager.invalidateCache()
  tasksManager.invalidateCache()
})
```

Components become coupled to global events they shouldn't know about.

### Solution

EventRouter transforms signals at the Kernel level:

```js
new Kernel({
  eventRouter: {
    // String = forward payload as-is
    'auth:impersonate': [
      'cache:entity:invalidate:loans',
      'cache:entity:invalidate:tasks'
    ],

    // Object = transform payload if needed
    'payment:completed': [
      { signal: 'notify:admin', transform: (ctx) => ({ amount: ctx.total }) },
      'audit:log'  // forward as-is
    ],

    // Function = custom callback
    'user:registered': [
      'welcome:email',
      (payload, { signals, orchestrator }) => {
        // Custom logic with full context access
        console.log('New user:', payload.user.name)
        orchestrator.get('audit').create({
          action: 'user_registered',
          user_id: payload.user.id
        })
      }
    ]
  }
})
```

Then EntityManager listens only to its own signal:

```js
// In EntityManager._setupCacheListeners() - built-in
signals.on(`cache:entity:invalidate:${this.name}`, () => {
  this.invalidateCache()
})
```

### Rules

| Input | Behavior |
|-------|----------|
| `'signal:name'` | `signals.emit(signal, sourcePayload)` |
| `{ signal, transform }` | `signals.emit(signal, transform(sourcePayload))` |
| `function` | `fn(sourcePayload, { signals, orchestrator })` |

### Callback Context

Callbacks receive the source payload and a context object:

```js
(payload, context) => {
  // payload: the original event payload
  // context.signals: SignalBus instance
  // context.orchestrator: Orchestrator instance
}
```

### Topo Check

At boot, EventRouter validates no cycles exist:

```js
// INVALID - detected at boot
{
  'A': ['B'],
  'B': ['A']  // Error: cycle detected A → B → A
}
```

### Principle

Components stay simple. They listen to their own signals, not global events. High-level routing handles the orchestration.

## SSEBridge (Server-Sent Events)

SSEBridge connects Server-Sent Events to SignalBus, enabling components to subscribe to real-time events without managing their own EventSource connections.

### Problem

Without SSEBridge, each component manages its own EventSource:

```js
// TaskList.vue - connection #1
const es = new EventSource('/api/events')
es.addEventListener('task:completed', (e) => updateList(JSON.parse(e.data)))
onUnmounted(() => es.close())

// AlertList.vue - connection #2 (wasteful!)
const es2 = new EventSource('/api/events')
es2.addEventListener('alert:triggered', (e) => updateAlerts(JSON.parse(e.data)))
onUnmounted(() => es2.close())
```

Multiple EventSource connections to the same endpoint waste resources.

### Solution

SSEBridge maintains a single SSE connection and emits events to SignalBus:

```js
// main.js - single connection
const kernel = new Kernel({
  sse: {
    url: '/api/events',
    events: ['task:completed', 'alert:triggered', 'queue:stats']
  }
})

// TaskList.vue - subscribes via signals
const { onEvent } = useSSEBridge()
onEvent('task:completed', ({ data }) => updateList(data))

// AlertList.vue - same signal bus, no extra connection
const { onEvent } = useSSEBridge()
onEvent('alert:triggered', ({ data }) => updateAlerts(data))
```

### Configuration

Configure SSE in Kernel options:

```js
new Kernel({
  sse: {
    url: '/api/events',           // SSE endpoint (required)
    reconnectDelay: 5000,         // Reconnect delay in ms (default: 5000)
    signalPrefix: 'sse',          // Signal prefix (default: 'sse')
    autoConnect: false,           // true = connect immediately
                                  // false = wait for auth:login (default)
    tokenParam: 'token',          // Query param for auth token
    events: [                     // Event names to register
      'task:completed',
      'task:failed',
      'alert:triggered'
    ]
  }
})
```

### Signal Naming

SSE events are prefixed with `sse:` (configurable):

| SSE Event | SignalBus Signal |
|-----------|------------------|
| `task:completed` | `sse:task:completed` |
| `alert:triggered` | `sse:alert:triggered` |
| Connection open | `sse:connected` |
| Connection lost | `sse:disconnected` |
| Connection error | `sse:error` |

### useSSEBridge Composable

```js
import { useSSEBridge } from 'qdadm'

const {
  connected,      // Ref<boolean> - connection status
  reconnecting,   // Ref<boolean> - reconnection in progress
  error,          // Ref<string|null> - last error
  onEvent,        // Subscribe to specific event (auto-cleanup)
  onAnyEvent      // Subscribe to all SSE events (wildcard)
} = useSSEBridge()

// Subscribe to specific event
onEvent('task:completed', ({ data, event, timestamp }) => {
  console.log('Task completed:', data)
})

// Subscribe to all SSE events
onAnyEvent(({ event, data }) => {
  console.log(`SSE ${event}:`, data)
})
```

### Lifecycle

1. **With auth (default)**: SSEBridge waits for `auth:login` signal before connecting
2. **Without auth**: Set `autoConnect: true` to connect immediately
3. **On logout**: SSEBridge disconnects on `auth:logout` signal
4. **Reconnection**: Automatic reconnection with configurable delay

### Direct SignalBus Access

You can also use SignalBus directly for more control:

```js
const signals = inject('qdadmSignals')

// Subscribe with wildcards
signals.on('sse:task:*', ({ data }) => {
  console.log('Any task event:', data)
})

// One-time subscription
await signals.once('sse:connected')
console.log('SSE is ready!')
```

## Best Practices

1. **Use signal categories**: `domain:action` format (`books:created`, `auth:login`)
2. **Keep handlers fast**: Don't block the signal chain
3. **Use wildcards for cross-cutting**: Audit logs, analytics, caching
4. **Emit before side effects complete**: Fire-and-forget pattern
5. **Business in SignalBus, UI in Vue**: Don't mix channels
6. **Use EventRouter for cross-cutting**: Auth → cache invalidation routing
7. **Use SSEBridge for real-time**: Single connection, multiple subscribers
