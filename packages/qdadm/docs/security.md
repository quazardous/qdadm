# Security

qdadm is **auth-agnostic** - it provides interfaces, not implementation.

## Two Security Dimensions

### Scope (Actions)

What can the user **do**?

- Create, Read, Update, Delete
- Custom actions (export, archive, approve)
- Field-level: which fields can be read/written

### Silo (Records)

Which records can the user **see**?

- Row-level filtering based on user/role
- Multi-tenant isolation
- Ownership-based access

## EntityManager as Gatekeeper

EntityManager exposes security methods:

| Method | Purpose |
|--------|---------|
| `canRead(entity)` | Can user see this entity type? |
| `canAccess(entity, action)` | Can user perform action? |
| `canAccess(entity, action, record)` | Can user act on specific record? |

Pages call these via builders - never implement security logic directly.

## AuthAdapter Pattern

```
┌─────────────────────────────────────────┐
│ App Bootstrap                           │
│   └─► Registers AuthAdapter             │
├─────────────────────────────────────────┤
│ EntityManager                           │
│   └─► Calls adapter.canRead/canAccess   │
├─────────────────────────────────────────┤
│ AuthAdapter (app-specific)              │
│   └─► Implements actual auth logic      │
│       - JWT validation                  │
│       - Role checking                   │
│       - Record ownership                │
└─────────────────────────────────────────┘
```

qdadm doesn't define **how** security is implemented. Each app provides its own AuthAdapter at bootstrap.

## Why This Design?

- **Flexibility** - Any auth system works (JWT, sessions, OAuth)
- **Separation** - Framework doesn't impose auth choices
- **Testability** - Mock adapter for testing
- **Multi-app** - Same qdadm, different auth per app

## Token Expiration & Auto-Logout

qdadm handles token expiration via signals:

### The Problem

When an API returns 401/403, the user should be automatically logged out and redirected to login. Without centralized handling, users continue with stale sessions.

### The Solution: `auth:expired` Signal

```javascript
// 1. API client emits auth:expired on 401/403
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      signals.emit('auth:expired', { status: error.response.status })
    }
    return Promise.reject(error)
  }
)

// 2. Kernel auto-handles: logout + redirect to /login
// This is automatic when authAdapter is configured
```

### Using setupApiClient

Kernel provides a helper to wire axios clients:

```javascript
import axios from 'axios'

const apiClient = axios.create({ baseURL: '/api' })
kernel.setupApiClient(apiClient)  // Adds 401/403 → auth:expired

// Now use apiClient with ApiStorage
const storage = new ApiStorage({ endpoint: '/users', client: apiClient })
```

### Auth Signals

| Signal | Emitted When | Default Handler |
|--------|--------------|-----------------|
| `auth:login` | User logs in | Resolves `auth:ready` deferred |
| `auth:logout` | User logs out | - |
| `auth:expired` | 401/403 from API | Logout + redirect to `/login?expired=1` |

### Token Expiration Check

AuthAdapter should check token expiration proactively:

```javascript
// In authAdapter.isAuthenticated()
function isTokenExpired(token) {
  const payload = JSON.parse(atob(token.split('.')[1]))
  return payload.exp * 1000 < Date.now()
}

isAuthenticated() {
  const token = this.getToken()
  if (!token || isTokenExpired(token)) {
    this.logout()
    return false
  }
  return true
}
```

## Audit Trail

Use signal bus for audit:
- `entity:presave` - log who's changing what
- `entity:postsave` - log what changed
- `entity:delete` - log deletions

Decoupled from security logic itself.
