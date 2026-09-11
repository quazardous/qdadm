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

### RoleGrantsEditor

A role's composition, made readable:
- the roles it inherits;
- an entity × action matrix of the registry's entity grants;
- the named grants, grouped by namespace.

Every checked grant says where it comes from: the role's own key, one of its wildcards (`via entity:*:read`), or an inherited role (`via ROLE_USER`).

```vue
<RoleGrantsEditor
  v-model="composition"
  :roles="roles"
  :inherited="inherited"
  :self="role.name"
/>
```

| Prop | |
|------|---|
| `v-model` | `{ inherits: string[], permissions: string[] }` — the role's own composition, never what it inherits |
| `roles` | `[{ name, label?, description? }]` — the roles it can inherit from |
| `inherited` | `[{ permission, via }]` — what the inherited roles bring, and the role that declares each grant |
| `grants` | the grants to compose from; default: the kernel's `PermissionRegistry` |
| `self` | this role's name, left out of `roles` |
| `readonly` | for roles that cannot change |

The widget judges nothing: it resolves no hierarchy and refuses no key.

- **When the front knows the roles**, `inheritedGrants(rolesProvider, composition.inherits)` computes `inherited`. SecurityModule's role form does exactly that.
- **When a server judges**, the server sends `inherited`, and the app shows its refusals as form errors.

A group's "All" box is `<namespace>:*`. Like every wildcard, `*` is one segment, so `offers:*` does not cover `offers:debug:read`.

Keys the registry does not know stay in the role, listed under "Other grants". `composeGrants()` (from `@quazardous/qdadm/security`) returns the model the widget draws, for a view of your own.

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

## Delegating the judgement to your backend

When your backend is the authority on who may do what, give qdadm a judge
instead of mirroring its rules in `role_permissions`:

```js
const answers = new Map() // attribute -> boolean, filled from your API
let refresh // set in install(), awaited before mount

const kernel = new Kernel({
  authAdapter,
  entityAuthAdapter,
  security: {
    grant: {
      isGranted: (attribute, subject, user) => answers.get(attribute),

      install({ signals, permissionRegistry }) {
        refresh = async () => {
          // Read the keys HERE, not in install(): modules register their
          // entities after install() runs.
          const keys = permissionRegistry.getKeys()
          const next = await api.post('/me/permissions', { keys })
          const changed = keys.some((k) => answers.get(k) !== next[k])
          for (const k of keys) answers.set(k, next[k])
          if (changed) signals.emit('security:changed')
        }
        signals.on('auth:login', () => refresh())
      },
    },
  },
})
```

The judge is consulted **first**, for roles (`ROLE_*`) and permissions alike:

| The judge returns | qdadm does |
|---|---|
| `true` / `false` | uses it as the verdict |
| anything else (`undefined`, a cache miss) | falls through to `role_hierarchy` / `role_permissions` |
| throws | **denies**, and logs once per attribute |

Nobody logged in is denied before the judge is asked.

`isGranted` is called **synchronously**, on every check: menus, list actions,
`canCreate`, the route guard. Answer from memory — fetch in bulk beforehand.
Until the first answers land the judge abstains, so whatever the role matrix
grants is what the user sees; with no matrix, that is nothing.

Pre-warm before mounting, the same way a session is restored
([Restoring a session before the app mounts](#restoring-a-session-before-the-app-mounts)):

```js
authAdapter.revalidate()
  .then(() => refresh())
  .then(() => kernel.createApp().mount('#app'))
```

### Re-evaluating: `security:changed`

Nothing on screen reads permissions reactively, so new answers only show once
the app re-evaluates. Emit `security:changed` and qdadm remounts the app,
exactly as it does on `auth:login`.

Emit it **only when an answer actually differs**. A remount discards unsaved
form state; emitting on every refresh would wipe the user's edits on a timer.

`install(ctx)` receives the same context as a `rolesProvider`'s: `signals`,
`orchestrator`, and `permissionRegistry` — the live registry, not a snapshot.

### In a component: `useSecurity()`

A page asks `useSecurity()`, which returns the managers' own verdict — the
`security.grant` judge first, then the role matrix:

```vue
<script setup>
import { useSecurity } from '@quazardous/qdadm'
const { isGranted } = useSecurity()
</script>

<template>
  <ReplyBox v-if="isGranted('offers:debug:write')" />
</template>
```

- `isGranted(attribute, subject?)` takes a permission or a `ROLE_*`, and the
  record the answer is about when that matters.
- Nothing is cached: the remount on `security:changed` (and on login and
  logout) is what makes new answers show.
- With no security configured it grants, as the managers do, so a page never
  disagrees with the list actions next to it.
- Call it in a component's `setup()`; a module asks `ctx.security.isGranted()`.

Hiding is a convenience: the server still has to refuse.

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
| `security:changed` | - | The app's permission answers changed — the app remounts ([Delegating the judgement](#re-evaluating-securitychanged)) |

`auth:login` is emitted by **`LoginPage`** — by the screen, not by the change
of authentication state. If you replace that screen with your own, emit it
yourself once the session is established:

```js
orchestrator.signals.emit('auth:login', { user })
```

Several things wait on it: the `auth:ready` deferred, the re-arming of the
expired-session guard, role loading in a `PersistableRolesProvider`, and the
live-entity stream ([live-entities.md](./live-entities.md)). None of them
fails loudly when it never arrives — they simply never happen.

### Restoring a session before the app mounts

`isAuthenticated()` is **synchronous**. The route guard calls it and decides in
the same breath, so there is no moment at which the framework can await a
network round trip on your behalf.

An app whose session lives in a refreshable token must therefore settle that
question **before mounting**:

```js
authAdapter.revalidate().then(() => {
  kernel.createApp().mount('#app')
})
```

Mount first and the guard runs against a session that has not been restored
yet: the user lands on `/login` with a perfectly valid credential in storage,
and nothing anywhere says why.

`session_lost=1` is added to that redirect only when a session this tab had
is gone. A first visit goes to `/login` without it, so an app can read the
flag to say "your session expired".

The framework cannot do this for you, and deliberately does not try — only the
app knows whether it would rather show a blank screen for 200 ms or a login
form it will immediately replace.

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
- Delegated judgement: what the checker answers for every registered permission, when `security.grant` is set
- Auth events (login/logout/impersonate) with auto-expiry

## Best Practices

1. **Use SecurityChecker** - Don't implement permission logic in components
2. **Register permissions** - Use PermissionRegistry for discoverability
3. **Use signals** - Don't manipulate auth state directly
4. **Storage authCheck** - Protect at storage level, not just UI
5. **Role hierarchy** - Define inheritance, don't duplicate permissions
