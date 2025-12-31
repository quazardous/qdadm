# AGENT_GUIDE - qdadm Quick Index

> Navigation index for AI agents. Read code directly for details.
> Philosophy: see [QDADM_CREDO.md](../packages/qdadm/QDADM_CREDO.md)
>
> **Versions:** qdadm 0.29.0 | demo 0.13.0

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
| Entity CRUD | `qdadm/src/entity/EntityManager.js` | `class EntityManager` |
| Manager registry | `qdadm/src/orchestrator/Orchestrator.js` | `class Orchestrator` |
| Storage backends | `qdadm/src/entity/storage/` | `ApiStorage`, `MockApiStorage`, etc. |
| Permissions | `qdadm/src/entity/auth/` | `AuthAdapter`, `SecurityChecker` |

### Extensibility

| Mechanism | Location | Search Pattern |
|-----------|----------|----------------|
| Signals (events) | `qdadm/src/kernel/SignalBus.js` | `signals.emit`, `signals.on` |
| Hooks (alter/invoke) | `qdadm/src/hooks/HookRegistry.js` | `hooks.register`, `hooks.alter` |
| Zones (UI blocks) | `qdadm/src/zones/ZoneRegistry.js` | `registerBlock`, `defineZone` |
| Decorators | `qdadm/src/core/decorator.js` | `createDecoratedManager` |

### UI Components

| Component | Location | Use Case |
|-----------|----------|----------|
| ListPage | `qdadm/src/components/lists/ListPage.vue` | CRUD list pages |
| FormPage | `qdadm/src/components/forms/FormPage.vue` | Create/Edit forms |
| FormField | `qdadm/src/components/forms/FormField.vue` | Form inputs |
| Zone | `qdadm/src/components/layout/Zone.vue` | Extensible slots |

### Composables (Vue)

| Composable | Location | Use Case |
|------------|----------|----------|
| useListPageBuilder | `qdadm/src/composables/useListPageBuilder.js` | Build list pages |
| useFormPageBuilder | `qdadm/src/composables/useFormPageBuilder.js` | Build form pages |
| useForm | `qdadm/src/composables/useForm.js` | Form state management |
| useOrchestrator | `qdadm/src/orchestrator/useOrchestrator.js` | Access managers |

### Query System

| Component | Location | Search Pattern |
|-----------|----------|----------------|
| Filter queries | `qdadm/src/query/FilterQuery.js` | `class FilterQuery` |
| Query executor | `qdadm/src/query/QueryExecutor.js` | `class QueryExecutor` |

## Demo App Examples

| Feature | Example File | Shows |
|---------|--------------|-------|
| List page | `demo/src/modules/books/pages/BookList.vue` | useListPageBuilder, filters, actions |
| Create form | `demo/src/modules/books/pages/BookCreate.vue` | useFormPageBuilder |
| Edit form | `demo/src/modules/books/pages/BookEdit.vue` | Form with existing data |
| Module init | `demo/src/modules/books/init.js` | Routes, nav, entity config |
| Auth adapter | `demo/src/adapters/authAdapter.js` | Login/logout implementation |
| Entity auth | `demo/src/adapters/entityAuthAdapter.js` | Permissions per entity |
| Zone extension | `demo/src/modules/loans/init.js` | Cross-module UI injection |
| Custom column | `demo/src/modules/loans/components/LoanStatusColumn.vue` | Slot-based column |

## Common Tasks

| Task | Where to Look |
|------|---------------|
| Add a new entity | `demo/src/modules/*/init.js` → `registry.addEntity()` |
| Add CRUD routes | `demo/src/modules/*/init.js` → `registry.addRoutes()` |
| Add navigation item | `demo/src/modules/*/init.js` → `registry.addNavItem()` |
| Create list page | `demo/src/modules/books/pages/BookList.vue` |
| Create form page | `demo/src/modules/books/pages/BookCreate.vue` |
| Add filter | Search `addFilter` in demo pages |
| Add custom action | Search `addAction` in demo pages |
| Extend another module | `demo/src/modules/loans/init.js` (zones example) |
| Handle permissions | `demo/src/adapters/entityAuthAdapter.js` |
| Add presave hook | Search `presave` in tests or docs |

## Tests Location

| Domain | Test Files |
|--------|------------|
| EntityManager | `qdadm/tests/entity/EntityManager.test.js` |
| Storage adapters | `qdadm/tests/entity/storage/*.test.js` |
| Composables | `qdadm/tests/composables/*.test.js` |
| Hooks | `qdadm/tests/hooks/HookRegistry.test.js` |
| Zones | `qdadm/tests/zones/*.test.js` |
| Kernel | `qdadm/tests/kernel/*.test.js` |

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
