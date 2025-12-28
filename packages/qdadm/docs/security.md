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

## Audit Trail

Use signal bus for audit:
- `entity:presave` - log who's changing what
- `entity:postsave` - log what changed
- `entity:delete` - log deletions

Decoupled from security logic itself.
