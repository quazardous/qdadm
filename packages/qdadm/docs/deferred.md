# Deferred & Warmup

Loose async coupling for service initialization and cache preloading.

## Problem

How to coordinate async service loading without tight coupling?

**Without deferred:**
```js
// Component must know service initialization order
async setup() {
  // Hope services are ready... or wait synchronously
  await configService.init()
  await usersManager.loadCache()
  await permissionsService.load()

  // Now render - but page is blocked during loading
  const users = await usersManager.list()
}
```

The component is tightly coupled to service initialization order.

**With deferred:**
```js
// At boot (automatic via Kernel)
// Services register their loading when ready

// Component awaits what it needs by name
const deferred = useDeferred()
await deferred.await('entity:users:cache')

// Cache is ready, render immediately
const { items } = await usersManager.list()
```

The component only knows the key it needs. Services register independently.

## Key Insight

**`await()` can be called BEFORE `queue()`**

The promise is created on first access. This enables true loose coupling:

```js
// Component (runs first, waits)
const result = await deferred.await('my-service')

// Service (registers later, resolves the waiting promise)
deferred.queue('my-service', async () => {
  return await loadExpensiveData()
})
```

## Architecture

```
Boot                              Component
  │                                   │
  ├─ Kernel.createApp()              │
  │   ├─ _createDeferredRegistry()   │
  │   ├─ _createOrchestrator()       │
  │   └─ _fireWarmups() ────────────┐│
  │       └─ orchestrator.fireWarmups()
  │           └─ manager.warmup()   ││
  │               └─ deferred.queue('entity:books:cache', ...)
  │                                  ││
  └─ mount() ───────────────────────┘│
                                      │
                            await deferred.await('entity:books:cache')
                                      │
                            ← promise resolves when cache loaded
```

## Basic Usage

### Access DeferredRegistry

```js
// In Vue component
import { useDeferred } from 'qdadm'

const deferred = useDeferred()
```

### Await a Service

```js
// Wait for entity cache to be ready
await deferred.await('entity:books:cache')

// Wait for multiple services
const [books, config] = await Promise.all([
  deferred.await('entity:books:cache'),
  deferred.await('config:loaded')
])
```

### Register a Service

```js
// In module init or service
deferred.queue('my-service', async () => {
  const data = await fetchData()
  return data
})
```

### Check Status

```js
deferred.status('my-service')    // 'pending' | 'running' | 'completed' | 'failed' | null
deferred.isSettled('my-service') // true if completed or failed
deferred.has('my-service')       // true if key exists
```

## Warmup

EntityManagers with cache support automatically register their cache loading in DeferredRegistry at boot.

### Configuration

```js
// Kernel level (default: true)
const kernel = new Kernel({
  warmup: true,  // Enable warmup at boot
  managers: { ... }
})

// Manager level (default: true)
const booksManager = new EntityManager({
  name: 'books',
  warmup: true,  // Can be disabled per-manager
  storage: new ApiStorage({ ... })
})
```

### Warmup Keys

Each manager registers with key: `entity:{name}:cache`

```js
// Books manager warmup
await deferred.await('entity:books:cache')

// Users manager warmup
await deferred.await('entity:users:cache')
```

### Auth Dependency

When `authAdapter` is configured, Kernel registers `auth:ready` in DeferredRegistry:

```js
// Kernel registers auth:ready if authAdapter is set
// This deferred resolves on first auth:login signal

// Each EntityManager.warmup() awaits auth:ready if it exists:
async warmup() {
  if (deferred?.has('auth:ready')) {
    await deferred.await('auth:ready')  // Wait for login
  }
  // Then load cache with correct user context
  return deferred.queue(`entity:${name}:cache`, () => this.ensureCache())
}
```

The dependency is at the **manager level**, not in `fireWarmups()`. This follows the pattern: each component awaits what it needs.

### Fire-and-Forget

Warmup is triggered at boot but doesn't block app startup:

```js
// In Kernel._fireWarmups()
this.orchestrator.fireWarmups()  // Fire-and-forget by design
// App continues immediately, pages await what they need
```

## External Resolution

For services that don't use `queue()`, resolve/reject externally:

```js
// Create awaitable key
const promise = deferred.await('external-service')

// Later, when service is ready
deferred.resolve('external-service', { data: 'loaded' })

// Or on error
deferred.reject('external-service', new Error('Failed to load'))
```

## Events

When a QuarKernel is provided, DeferredRegistry emits events:

| Event | Payload | When |
|-------|---------|------|
| `deferred:started` | `{ key }` | Queue starts executing |
| `deferred:completed` | `{ key, value }` | Queue completed successfully |
| `deferred:failed` | `{ key, error }` | Queue failed |

```js
// Listen for completion
signals.on('deferred:completed', ({ key, value }) => {
  console.log(`${key} loaded:`, value)
})
```

## Use Cases

### 1. Cache Preloading (Built-in)

```js
// Automatic via EntityManager.warmup()
await deferred.await('entity:books:cache')
const { items } = await booksManager.list()  // Uses cache
```

### 2. Config Loading

```js
// In module init
deferred.queue('config:app', async () => {
  const response = await fetch('/api/config')
  return response.json()
})

// In component
const config = await deferred.await('config:app')
```

### 3. Feature Flags

```js
// At boot
deferred.queue('features', async () => {
  return await featureFlagService.load()
})

// In component
const features = await deferred.await('features')
if (features.darkMode) { ... }
```

### 4. Permissions Sync

```js
// After login
deferred.queue('user:permissions', async () => {
  return await permissionService.loadForUser(user.id)
})

// In protected route
await deferred.await('user:permissions')
```

## API Reference

### DeferredRegistry

| Method | Returns | Description |
|--------|---------|-------------|
| `await(key)` | `Promise<T>` | Get/create promise for key |
| `queue(key, executor)` | `Promise<T>` | Register executor (idempotent) |
| `resolve(key, value)` | `boolean` | Resolve externally |
| `reject(key, error)` | `boolean` | Reject externally |
| `status(key)` | `string\|null` | Get status |
| `isSettled(key)` | `boolean` | Check if done |
| `has(key)` | `boolean` | Check if exists |
| `value(key)` | `T\|undefined` | Get resolved value |
| `keys()` | `string[]` | All registered keys |
| `entries()` | `Entry[]` | All entries with metadata |
| `clear(key)` | `void` | Remove entry |
| `clearAll()` | `void` | Remove all entries |

### useDeferred

```js
import { useDeferred } from 'qdadm'

const deferred = useDeferred()  // Returns DeferredRegistry
```

### useDeferredValue

```js
import { useDeferredValue } from 'qdadm'

// Returns reactive { value, status, error }
const { value, status } = useDeferredValue('entity:books:cache')
```

## See Also

- [Signals](./signals.md) - Event-driven communication
- [Hooks](./hooks.md) - Lifecycle interception
- [Extension](./extension.md) - All extension patterns
