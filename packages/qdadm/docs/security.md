# Security

qdadm provides a unified permission system with role hierarchy, permission matching, and signal-driven auth events.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SecurityChecker                          │
│  Central facade for all permission checks                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  │
│  │  RolesManager   │  │  RolesProvider  │  │PermissionMatcher│  │
│  │  Role → Roles   │  │  Role → Perms   │  │ Wildcard match  │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                     PermissionRegistry                          │
│  Stores all registered permission keys                          │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### SecurityChecker

Central facade for permission checks:

```js
// Check if user has permission
ctx.security.isGranted('entity:books:delete')
ctx.security.isGranted('entity:books:*')  // wildcard

// Get user's effective permissions (resolves hierarchy)
ctx.security.getUserPermissions(user)
```

### PermissionRegistry

Stores all permission keys (for UI display, validation):

```js
// Auto-registered by EntityManager for CRUD
// entity:books:create, entity:books:read, entity:books:update, entity:books:delete

// Register custom permission
ctx.permissionRegistry.register('reports:export', { label: 'Export Reports' })

// Get all keys
ctx.permissionRegistry.getKeys()  // ['entity:books:read', 'reports:export', ...]
```

### RolesProvider

Maps roles to permissions:

```ts
const rolesProvider = new StaticRolesProvider({
  role_permissions: {
    ROLE_ADMIN: ['*'],  // All permissions
    ROLE_EDITOR: ['entity:books:*', 'entity:loans:read'],
    ROLE_USER: ['entity:books:read']
  }
})

// With anonymous role
const rolesProvider = new StaticRolesProvider({
  role_permissions: {
    ROLE_ANONYMOUS: ['entity:books:read'],  // Public read
    ROLE_USER: ['entity:books:*']
  }
}, { anonymousRole: 'ROLE_ANONYMOUS' })
```

### RolesManager

Manages role hierarchy and collects permissions from RolesProvider:

```ts
const rolesManager = new RolesManager(rolesProvider)

// Get all reachable roles
rolesManager.getReachableRoles('ROLE_ADMIN')
// → ['ROLE_ADMIN', 'ROLE_EDITOR', 'ROLE_USER', 'ROLE_ANONYMOUS']
```

### PermissionMatcher

Wildcard permission matching:

```js
PermissionMatcher.matches('entity:books:read', 'entity:books:read')  // true
PermissionMatcher.matches('entity:books:*', 'entity:books:read')     // true
PermissionMatcher.matches('entity:*:read', 'entity:books:read')      // true
PermissionMatcher.matches('*', 'anything')                           // true
```

## Permission Flow

```
1. User has roles: ['ROLE_EDITOR']
2. RolesManager expands via hierarchy: ['ROLE_EDITOR', 'ROLE_USER', 'ROLE_ANONYMOUS']
3. RolesProvider collects permissions for all roles
4. PermissionMatcher checks if requested permission matches any granted
```

## Integration with Kernel

```ts
const kernel = new Kernel({
  authAdapter,
  security: {
    rolesProvider: createLocalStorageRolesProvider({
      key: 'app_roles',
      defaults: {
        role_hierarchy: {
          ROLE_ADMIN: ['ROLE_USER']
        },
        role_permissions: {
          ROLE_ADMIN: ['*'],
          ROLE_USER: ['entity:books:read']
        }
      }
    })
  }
})

// Access via context
ctx.security.isGranted('entity:books:delete')
```

## EntityManager Permissions

EntityManager auto-registers CRUD permissions and provides can* methods:

```js
class BooksManager extends EntityManager {
  // Override for custom logic
  canDelete(record) {
    // Only admin can delete
    const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
    return user?.role === 'ROLE_ADMIN'
  }

  canUpdate(record) {
    // Owner or admin
    const user = this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()
    return record.owner_id === user?.id || user?.role === 'ROLE_ADMIN'
  }
}
```

## Storage-Level Auth

MockApiStorage supports auth checking:

```js
const storage = new MockApiStorage({
  entityName: 'books',
  authCheck: () => {
    if (!authAdapter.isAuthenticated()) {
      throw { status: 401, message: 'Unauthorized' }
    }
    return true
  }
})

// Capability flag for debug panel
storage.capabilities  // { requiresAuth: true }
```

## Auth Signals

Signal-driven authentication events:

| Signal | Payload | When |
|--------|---------|------|
| `auth:login` | `{ user }` | User logs in successfully |
| `auth:login:error` | `{ username, error, status }` | Login failed (wrong credentials) |
| `auth:logout` | - | User logs out |
| `auth:expired` | `{ status, url }` | 401/403 from API (session expired) |
| `auth:impersonate` | `{ target, original }` | Start impersonation |
| `auth:impersonate:stop` | `{ original }` | End impersonation |

### Login Error vs Session Expired

**Important distinction:**
- `auth:login:error` - Login attempt failed (wrong password). User stays on login page, sees error toast.
- `auth:expired` - Authenticated session expired. User is logged out and redirected to login.

When wiring your API client's 401 handler, **exclude the login endpoint** to avoid treating login failures as session expiration:

```js
setAuthExpiredHandler((status, url) => {
  // Don't emit auth:expired on login endpoint
  if (url?.includes('/auth/login')) {
    return  // Let LoginPage handle via toast + auth:login:error
  }
  signals.emit('auth:expired', { status, url })
})
```

### Token Expiration Handling

```js
// API client emits auth:expired on 401/403
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if ([401, 403].includes(error.response?.status)) {
      signals.emit('auth:expired', { status: error.response.status })
    }
    return Promise.reject(error)
  }
)

// Kernel auto-handles: logout + redirect to /login?expired=1
```

## Impersonation

Signal-driven impersonation for testing user permissions:

```js
// Start impersonation
await signals.emit('auth:impersonate', {
  target: { id: 'user-123', username: 'bob', role: 'ROLE_USER' },
  original: authAdapter.getUser()
})

// End impersonation
await signals.emit('auth:impersonate:stop', {
  original: authAdapter.getOriginalUser()
})

// Check state
authAdapter.isImpersonating()     // true/false
authAdapter.getUser()             // Current (or impersonated) user
authAdapter.getOriginalUser()     // Real admin user
```

SessionAuthAdapter handles these signals via `connectSignals()`.

## Debug Bar

AuthCollector displays in debug panel:
- Current user (with effective permissions)
- Impersonated user (when active)
- Token info (expiry, claims)
- Role hierarchy
- Role permissions map
- Auth events (login/logout/impersonate) with auto-expiry

## Best Practices

1. **Use SecurityChecker** - Don't implement permission logic in components
2. **Register permissions** - Use PermissionRegistry for discoverability
3. **Use signals** - Don't manipulate auth state directly
4. **Storage authCheck** - Protect at storage level, not just UI
5. **Role hierarchy** - Define inheritance, don't duplicate permissions
