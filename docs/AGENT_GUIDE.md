# AGENT_GUIDE - qdadm Quick Index

> Navigation index for AI agents. Read code directly for details.
> Philosophy: see [QDADM_CREDO.md](../packages/qdadm/QDADM_CREDO.md)
>
> **Versions:** qdadm 0.45.0 | demo 0.17.3

## Dev Commands

```bash
npm install          # Install all (from root)
npm run dev          # Start demo http://localhost:5175
npm test             # Run tests (from packages/qdadm)
```

## Where to Find Things

### Core Concepts

| Concept | Location | Search Pattern |
|---------|----------|----------------|
| App bootstrap | `qdadm/src/kernel/Kernel.js` | `class Kernel` |
| Module base class | `qdadm/src/module/Module.js` | `class Module` |
| Module context | `qdadm/src/module/KernelContext.js` | `class KernelContext` |
| Entity CRUD | `qdadm/src/entity/EntityManager.js` | `class EntityManager` |
| Manager registry | `qdadm/src/orchestrator/Orchestrator.js` | `class Orchestrator` |
| Storage backends | `qdadm/src/entity/storage/` | `ApiStorage`, `MockApiStorage`, `SdkStorage` |
| Permissions | `qdadm/src/entity/auth/` | `SecurityChecker`, `PermissionRegistry` |

### Extensibility

| Mechanism | Location | Search Pattern |
|-----------|----------|----------------|
| Signals (events) | `qdadm/src/kernel/SignalBus.js` | `signals.emit`, `signals.on` |
| Hooks (alter/invoke) | `qdadm/src/hooks/HookRegistry.js` | `hooks.register`, `hooks.alter` |
| Zones (UI blocks) | `qdadm/src/zones/ZoneRegistry.js` | `ctx.zone()`, `ctx.block()` |
| Decorators | `qdadm/src/core/decorator.js` | `createDecoratedManager` |

### UI Components

| Component | Location | Use Case |
|-----------|----------|----------|
| ListPage | `qdadm/src/components/lists/ListPage.vue` | CRUD list pages |
| PageLayout | `qdadm/src/components/layout/PageLayout.vue` | Page wrapper |
| FormField | `qdadm/src/components/forms/FormField.vue` | Form inputs |
| Zone | `qdadm/src/components/layout/Zone.vue` | Extensible slots |
| AppLayout | `qdadm/src/components/layout/AppLayout.vue` | Main layout |

### Composables (Vue)

| Composable | Location | Use Case |
|------------|----------|----------|
| useListPageBuilder | `qdadm/src/composables/useListPageBuilder.js` | Build list pages |
| useForm | `qdadm/src/composables/useForm.js` | Form state management |
| useOrchestrator | `qdadm/src/orchestrator/useOrchestrator.js` | Access managers |

## Module Pattern (Current)

Modules extend `Module` class and use `ctx` (KernelContext) for registration:

```js
import { Module, EntityManager, MockApiStorage } from 'qdadm'

export class BooksModule extends Module {
  static name = 'books'

  async connect(ctx) {
    // Entity
    ctx.entity('books', new EntityManager({
      name: 'books',
      labelField: 'title',
      fields: { title: { type: 'text', label: 'Title' } },
      storage: new MockApiStorage({ entityName: 'books' })
    }))

    // CRUD routes + nav (single form pattern)
    ctx.crud('books', {
      list: () => import('./pages/BookList.vue'),
      form: () => import('./pages/BookForm.vue')  // create & edit
    }, {
      nav: { section: 'Library', icon: 'pi pi-book' }
    })

    // Zones
    ctx.zone('books-header')
    ctx.block('books-header', { id: 'header', component: MyHeader })
  }
}
```

## Entity Relations

Three ways to link entities:

| Type | Declared On | Purpose | Strength |
|------|-------------|---------|----------|
| `reference` | Field config | UI dropdown populated by another entity | Weak |
| `parent` | Entity config | Hierarchical routing `/books/:id/loans` | Strong |
| `children` | Entity config | Inverse of parent (optional) | Strong |

### reference (weak link)

Populates a select/dropdown from another entity. Can enable auto-filtering but no routing.

```js
// In fields config
role: {
  type: 'select',
  label: 'Role',
  reference: { entity: 'roles' }  // Dropdown options from roles entity
}

// In list page - filter by reference field
list.addFilter('genre_id', {
  label: 'Genre',
  optionsEntity: 'genres'  // Auto-populated from genres entity
})
```

### parent (strong link)

Creates hierarchical navigation. Entity "lives under" parent.

```js
// loans belongs to books
ctx.entity('loans', new EntityManager({
  parents: {
    book: { entity: 'books', foreignKey: 'book_id' }
  }
}))
// Result: /books/:bookId/loans route, auto-filtered by book_id
```

### children (inverse of parent)

Declared on parent to enable child routes. Optional if parent already declares.

```js
// books has loans
ctx.entity('books', new EntityManager({
  children: {
    loans: { entity: 'loans', endpoint: 'loans' }
  }
}))
```

### Debug Bar

EntitiesPanel shows all relations:
- `↑` = parent (arrow up)
- `↓` = children (arrow down)
- `🔗` = reference (link icon, blue)

## Demo App Examples

| Feature | Example File | Shows |
|---------|--------------|-------|
| Module class | `demo/src/modules/books/BooksModule.js` | Full module pattern |
| List page | `demo/src/modules/books/pages/BookList.vue` | useListPageBuilder |
| Form (create/edit) | `demo/src/modules/books/pages/BookForm.vue` | useForm, single form |
| Custom page | `demo/src/modules/books/pages/BookStats.vue` | Non-CRUD route |
| Auth adapter | `demo/src/adapters/authAdapter.js` | Login/logout |
| Entity auth | `demo/src/adapters/entityAuthAdapter.js` | Permissions |
| User impersonation | `demo/src/components/UserImpersonator.vue` | Signal-driven |
| Module template | `demo/src/modules/_template/` | Copy to create new |

## Context Methods (KernelContext)

| Method | Purpose |
|--------|---------|
| `ctx.entity(name, manager)` | Register entity manager |
| `ctx.crud(path, components, options)` | Register CRUD routes + nav |
| `ctx.routes(path, routes, options)` | Register custom routes |
| `ctx.navItem(config)` | Add navigation item |
| `ctx.zone(name)` | Define zone |
| `ctx.block(zone, config)` | Add block to zone |
| `ctx.signals` | Access SignalBus |
| `ctx.hooks` | Access HookRegistry |
| `ctx.security` | Access SecurityChecker |

## Security System

### Core Components

| Component | Location | Purpose |
|-----------|----------|---------|
| SecurityChecker | `qdadm/src/entity/auth/SecurityChecker.js` | Central permission checking |
| PermissionRegistry | `qdadm/src/entity/auth/PermissionRegistry.js` | Register permission keys |
| RoleGranter | `qdadm/src/entity/auth/RoleGranter.js` | Map roles → permissions |
| RoleHierarchy | `qdadm/src/entity/auth/RoleHierarchy.js` | Role inheritance |
| PermissionMatcher | `qdadm/src/entity/auth/PermissionMatcher.js` | Wildcard matching |

### Permission Flow

```
User roles → RoleHierarchy (expand) → RoleGranter (get perms) → PermissionMatcher (check)
```

### Key Patterns

```js
// Check permission
ctx.security.isGranted('entity:books:delete')
ctx.security.isGranted('entity:books:*')  // wildcard

// In EntityManager
canDelete() {
  return this._orchestrator?.kernel?.options?.authAdapter?.getUser?.()?.role === 'ROLE_ADMIN'
}

// Storage-level auth (MockApiStorage)
new MockApiStorage({
  entityName: 'books',
  authCheck: () => authAdapter.isAuthenticated()  // throws 401 if false
})
```

### Auth Signals

| Signal | When |
|--------|------|
| `auth:login` | User logs in |
| `auth:logout` | User logs out |
| `auth:expired` | 401/403 from API |
| `auth:impersonate` | Start impersonation |
| `auth:impersonate:stop` | End impersonation |

### Debug Bar

AuthCollector shows: user, token, permissions, role hierarchy, impersonation events.

## Common Tasks

| Task | How |
|------|-----|
| Add new entity | Create module class extending `Module`, use `ctx.entity()` |
| Add CRUD routes | Use `ctx.crud(path, { list, form }, { nav })` |
| Add custom route | Use `ctx.routes(path, routes)` + `ctx.navItem()` |
| Add filter | `list.addFilter('status', { ... })` in list page |
| Add action | `list.addAction({ ... })` or `list.addEditAction()` |
| Check permissions | `ctx.security.isGranted('permission:key')` |
| Emit signal | `ctx.signals.emit('event:name', payload)` |
| Listen to signal | `ctx.signals.on('event:name', handler)` |

## Tests Location

| Domain | Test Files |
|--------|------------|
| EntityManager | `qdadm/tests/entity/EntityManager.test.js` |
| Storage adapters | `qdadm/tests/entity/storage/*.test.js` |
| Composables | `qdadm/tests/composables/*.test.js` |
| Hooks | `qdadm/tests/hooks/HookRegistry.test.js` |
| Zones | `qdadm/tests/zones/*.test.js` |
| Kernel | `qdadm/tests/kernel/*.test.js` |
| Debug | `qdadm/tests/debug/*.test.js` |

## Documentation

| Topic | File |
|-------|------|
| Philosophy | `packages/qdadm/QDADM_CREDO.md` |
| Architecture (PAC) | `packages/qdadm/docs/architecture.md` |
| Extension overview | `packages/qdadm/docs/extension.md` |
| Hooks deep dive | `packages/qdadm/docs/hooks.md` |
| Signals deep dive | `packages/qdadm/docs/signals.md` |
| Zones deep dive | `packages/qdadm/docs/zones.md` |
| Security | `packages/qdadm/docs/security.md` |
