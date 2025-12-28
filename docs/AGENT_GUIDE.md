# AGENT_GUIDE.md - qdadm Architecture Overview

> Quick reference for AI agents working on qdadm. Version 0.16.0.

## Project Structure

```
quazardous/qdadm/
├── packages/
│   ├── qdadm/                    # Core library (v0.16.0)
│   │   ├── package.json
│   │   └── src/
│   │       ├── index.js          # Main exports
│   │       ├── plugin.js         # Vue plugin (createQdadm)
│   │       ├── kernel/           # Bootstrap infrastructure
│   │       ├── entity/           # EntityManager + storage adapters
│   │       ├── orchestrator/     # Manager registry
│   │       ├── composables/      # Vue composables (useListPageBuilder, useForm)
│   │       ├── components/       # UI components (ListPage, FormField)
│   │       ├── module/           # Module registry system
│   │       ├── hooks/            # HookRegistry (Drupal-inspired)
│   │       ├── zones/            # ZoneRegistry (Twig-inspired blocks)
│   │       ├── core/             # Core utilities
│   │       ├── utils/            # Helper functions
│   │       └── styles/           # CSS styles
│   └── demo/                     # Demo application
│       ├── package.json
│       ├── vite.config.js
│       └── src/
│           ├── main.js           # Kernel bootstrap
│           └── modules/          # Demo modules (books, etc.)
├── package.json                  # Workspace root
└── README.md
```

## Core Components (v0.16.0)

### 1. Kernel (`src/kernel/Kernel.js`)

**Purpose**: Bootstrap orchestrator for qdadm applications.

**Responsibilities**:
- Vue app creation and configuration
- Pinia, PrimeVue, ToastService, ConfirmationService setup
- Router creation with auth guard
- Module discovery via `import.meta.glob`
- Orchestrator, SignalBus, HookRegistry, ZoneRegistry instantiation
- Vue injection setup for all registries

**Key Constructor Options**:
```js
{
  root,              // Root Vue component
  modules,           // import.meta.glob result for module init files
  modulesOptions,    // Options for initModules (e.g., coreNavItems)
  sectionOrder,      // Navigation section ordering
  managers,          // Pre-registered EntityManagers { name: manager }
  authAdapter,       // App-level auth (login/logout)
  entityAuthAdapter, // Entity-level permissions (scope/silo checks)
  pages,             // { login, layout } page components
  homeRoute,         // Route name or config for home redirect
  coreRoutes,        // Additional layout children routes
  basePath,          // Router base path
  hashMode,          // Use hash-based routing
  app,               // { name, shortName, version, logo, theme }
  features,          // { auth, poweredBy }
  primevue,          // { plugin, theme, options }
  debug              // Enable debug mode for registries
}
```

**Bootstrap Flow**:
```
1. _initModules()        → Process module glob, set section order
2. _createRouter()       → Build routes with auth guard
3. _createSignalBus()    → Event-driven communication
4. _createHookRegistry() → Drupal-inspired extensibility
5. _createOrchestrator() → EntityManager registry
6. _createZoneRegistry() → UI composition blocks
7. _createVueApp()       → Vue app instance
8. _installPlugins()     → Register all Vue plugins
```

**Accessors**:
- `kernel.getRouter()` - Vue Router instance
- `kernel.getApp()` - Vue app instance
- `kernel.getOrchestrator()` - Orchestrator instance
- `kernel.getSignals()` - SignalBus instance
- `kernel.getZoneRegistry()` - ZoneRegistry instance
- `kernel.getHookRegistry()` - HookRegistry instance
- `kernel.hooks` - Shorthand for HookRegistry

---

### 2. EntityManager (`src/entity/EntityManager.js`)

**Purpose**: Base class for entity CRUD operations with caching, permissions, and relations.

**Two Usage Patterns**:
1. **Delegation** - Provide a storage adapter
2. **Direct Implementation** - Extend and override methods

**Constructor Options**:
```js
{
  name,                    // Entity name (required)
  storage,                 // Storage adapter instance
  idField: 'id',           // Primary key field
  label,                   // Singular label (auto: capitalize name)
  labelPlural,             // Plural label (auto: name + 's')
  routePrefix,             // Route prefix (auto: singular name)
  labelField: 'name',      // Field for display labels
  fields: {},              // Field schema { fieldName: { type, label, required, ... } }
  localFilterThreshold: 100, // Cache threshold (0 = disable)
  readOnly: false,         // Disable write operations
  scopeWhitelist: null,    // Scopes that bypass restrictions
  children: {},            // Child relations { name: { entity, endpoint? } }
  parent: null,            // Parent relation { entity, foreignKey }
  relations: {},           // Many-to-many relations
  authAdapter: null        // Permission adapter (auto: PermissiveAuthAdapter)
}
```

**CRUD Methods**:
| Method | Description |
|--------|-------------|
| `list(params)` | List with pagination, filters, sorting |
| `get(id)` | Get single entity |
| `getMany(ids)` | Batch fetch by IDs |
| `create(data)` | Create entity (emits signal, invokes hooks) |
| `update(id, data)` | Full update (PUT) |
| `patch(id, data)` | Partial update (PATCH) |
| `delete(id)` | Delete entity |
| `query(params, options)` | Smart cache/API decision |
| `request(method, path, options)` | Generic HTTP request |

**Permission Methods**:
| Method | Description |
|--------|-------------|
| `canAccess(action, record?)` | Primary check (scope + silo) |
| `canRead(entity?)` | Read permission |
| `canCreate()` | Create permission |
| `canUpdate(entity?)` | Update permission |
| `canDelete(entity?)` | Delete permission |
| `canList()` | List permission |

**Cache System**:
- Opportunistic caching: fills on first `list()` if items <= threshold
- `query()` auto-decides cache vs API based on overflow status
- `invalidateCache()` clears after mutations
- `getCacheInfo()` for debugging
- `cacheSafe: true` param for session-bound filters (e.g., user_id)

**Lifecycle Hooks** (via HookRegistry):
| Hook | When | Context |
|------|------|---------|
| `{entity}:presave` | Before create/update | `{ entity, record, isNew, id?, manager }` |
| `{entity}:postsave` | After create/update | `{ entity, record, result, isNew, id, manager }` |
| `{entity}:predelete` | Before delete | `{ entity, id, manager }` |

**Signals** (via SignalBus):
| Signal | When |
|--------|------|
| `{entity}:created` | After create |
| `{entity}:updated` | After update/patch |
| `{entity}:deleted` | After delete |
| `entity:created/updated/deleted` | Generic signals |

---

### 3. Orchestrator (`src/orchestrator/Orchestrator.js`)

**Purpose**: Central registry for EntityManagers with lazy creation.

**Constructor Options**:
```js
{
  entityFactory,      // (name, config) => EntityManager
  managers: {},       // Pre-registered managers
  signals,            // SignalBus instance
  hooks,              // HookRegistry instance
  entityAuthAdapter   // Default auth adapter for all managers
}
```

**Key Methods**:
| Method | Description |
|--------|-------------|
| `get(name)` | Get/create manager (lazy) |
| `has(name)` | Check if manager exists or can be created |
| `register(name, manager)` | Manual registration |
| `setFactory(factory)` | Set entity factory |
| `getRegisteredNames()` | List registered managers |
| `dispose()` | Cleanup all managers |

**Manager Registration Flow**:
1. Check existing managers first
2. Query module registry for entity config
3. If config is EntityManager, use directly
4. Otherwise, invoke factory function
5. Inject signals, hooks, entityAuthAdapter
6. Call `manager.onRegister(orchestrator)`

---

### 4. Storage Adapters (`src/entity/storage/`)

**Available Adapters**:

| Adapter | Purpose | Key Options |
|---------|---------|-------------|
| `ApiStorage` | REST API | `{ endpoint, client, idField }` |
| `LocalStorage` | Browser localStorage | `{ key, idField }` |
| `MemoryStorage` | In-memory (testing) | `{ data, idField }` |
| `MockApiStorage` | Simulated API (testing) | `{ data, delay, idField }` |
| `SdkStorage` | SDK wrapper | `{ sdk, entity, idField }` |

**Storage Interface**:
```js
{
  list(params),        // → { items, total }
  get(id),             // → entity
  getMany?(ids),       // → [entity] (optional)
  create(data),        // → created entity
  update(id, data),    // → updated entity
  patch(id, data),     // → updated entity
  delete(id),          // → void
  request?(method, path, options)  // → any (optional)
}
```

---

### 5. useListPageBuilder (`src/composables/useListPageBuilder.js`)

**Purpose**: Declarative builder for CRUD list pages.

**Config Options**:
```js
{
  entity,              // Entity name (required)
  dataKey: 'id',       // Primary key for DataTable
  defaultSort,         // Default sort field
  defaultSortOrder: -1, // 1 = asc, -1 = desc
  pageSize: 10,        // Items per page
  loadOnMount: true,   // Auto-load on mount
  persistFilters: true, // Session storage persistence
  syncUrlParams: true,  // URL query param sync
  filterMode: 'auto',  // 'auto' | 'manager' | 'local'
  autoFilterThreshold: 100,
  autoLoadFilters: true,
  onBeforeLoad,        // (params) => modified params
  onAfterLoad,         // (response, processed) => void
  transformResponse    // (response) => { items, total }
}
```

**Builder Methods**:
```js
// Columns
list.addColumn(field, config)
list.removeColumn(field)
list.updateColumn(field, updates)

// Filters
list.addFilter(name, config)
list.removeFilter(name)
list.setFilterValue(name, value)
list.updateFilters(values)
list.clearFilters()

// Search
list.setSearch({ placeholder, fields, debounce, local_search? })

// Actions (row-level)
list.addAction(name, config)
list.addViewAction(options?)
list.addEditAction(options?)
list.addDeleteAction(options?)

// Header Actions
list.addHeaderAction(name, config)
list.addCreateAction(label?)
list.addBulkDeleteAction()
list.addBulkStatusAction(config)

// Cards
list.addCard(name, config)
list.updateCard(name, config)
list.removeCard(name)
```

**Returned State**:
```js
{
  // Data
  items, displayItems, loading, totalRecords,

  // Selection
  selected, hasSelection, selectionCount,

  // Pagination/Sorting
  page, pageSize, sortField, sortOrder,

  // Filters/Search
  filters, filterValues, searchQuery, filteredItems, fromCache,

  // Permissions
  canCreate, canDelete, canEditRow(row), canDeleteRow(row),

  // ListPage integration
  props,   // Computed props for <ListPage v-bind="props">
  events,  // Event handlers for <ListPage v-on="events">

  // Methods
  loadItems(params?, { force? }),
  goToCreate(), goToEdit(item), goToShow(item),
  confirmDelete(item), confirmBulkDelete(),
  // ...
}
```

**list:alter Hook**:
```js
// Modules can modify list configuration
hooks.register('list:alter', (config) => {
  config.columns.push({ field: 'custom', header: 'Custom' })
  return config
})

// Entity-specific hook
hooks.register('books:list:alter', (config) => {
  config.filters.push({ name: 'year', type: 'select', options: [...] })
  return config
})
```

---

### 6. SignalBus (`src/kernel/SignalBus.js`)

**Purpose**: Event-driven communication via QuarKernel.

**Signal Naming**:
- Entity-specific: `{entity}:{action}` (e.g., `books:created`)
- Generic: `entity:{action}` (e.g., `entity:created`)
- Wildcards: `books:*`, `*:created`, `entity:*`

**Methods**:
```js
signals.emit(signal, payload)           // Emit signal
signals.on(signal, handler, options?)   // Subscribe (returns unbind)
signals.off(signal, handler?)           // Unsubscribe
signals.once(signal, options?)          // Promise-based one-time
signals.emitEntity(entityName, action, data)  // Emit both specific + generic
signals.listenerCount(signal?)          // Get listener count
signals.signalNames()                   // List all signals
```

---

### 7. HookRegistry (`src/hooks/HookRegistry.js`)

**Purpose**: Drupal-inspired hook system for extensibility.

**Hook Types**:
- **Lifecycle** (`invoke`): Fire-and-forget, no return expected
- **Alter** (`alter`): Chained transforms, handlers return modified data

**Methods**:
```js
hooks.register(name, handler, options?)  // Register handler
hooks.invoke(name, context, options?)    // Lifecycle hook
hooks.alter(name, data, options?)        // Alter hook
hooks.hasHook(name)                      // Check for handlers
hooks.getRegisteredHooks()               // List all hooks
hooks.getHandlerCount(name?)             // Handler count
hooks.dispose()                          // Cleanup
```

**Registration Options**:
```js
{
  priority: 50,        // Higher runs first (default: 50)
  id: 'my-handler',    // Unique ID for dependencies
  after: 'other-id',   // Run after specific handler
  once: false          // Remove after first call
}
```

**Priority Constants**:
```js
HOOK_PRIORITY.FIRST  // 100
HOOK_PRIORITY.HIGH   // 75
HOOK_PRIORITY.NORMAL // 50
HOOK_PRIORITY.LOW    // 25
HOOK_PRIORITY.LAST   // 0
```

---

### 8. ZoneRegistry (`src/zones/ZoneRegistry.js`)

**Purpose**: Twig/Symfony-inspired block composition system.

**Block Operations**:
| Operation | Purpose |
|-----------|---------|
| `add` | Add block to zone (default) |
| `replace` | Substitute existing block by ID |
| `extend` | Insert before/after existing block |
| `wrap` | Decorate existing block with wrapper |

**Methods**:
```js
registry.defineZone(name, { default? })           // Define zone
registry.registerBlock(zoneName, blockConfig)     // Add block
registry.getBlocks(zoneName)                      // Get sorted blocks
registry.getDefault(zoneName)                     // Get default component
registry.hasBlocks(zoneName)                      // Check for blocks
registry.hasZone(zoneName)                        // Check zone exists
registry.listZones()                              // List zone names
registry.removeBlock(zoneName, blockId)           // Remove block
registry.clearZone(zoneName)                      // Clear zone blocks
```

**Block Config**:
```js
{
  component,           // Vue component (required)
  weight: 50,          // Sort order (lower = first)
  props: {},           // Props to pass
  id,                  // Unique identifier
  operation: 'add',    // add | replace | extend | wrap
  replaces,            // Target ID (for replace)
  before,              // Target ID (for extend)
  after,               // Target ID (for extend)
  wraps                // Target ID (for wrap)
}
```

---

### 9. Module Registry (`src/module/moduleRegistry.js`)

**Purpose**: Auto-discovery and registration of application modules.

**Registry API** (passed to module `init` functions):
```js
{
  addRoutes(prefix, routes, options?),  // Register routes
  addNavItem(item),                     // Add navigation item
  addRouteFamily(parent, prefixes),     // Route grouping for active state
  addEntity(name, config)               // Declare entity
}
```

**Module Init Pattern**:
```js
// modules/books/init.js
export function init(registry) {
  registry.addRoutes('books', [
    { path: '', name: 'book', component: () => import('./pages/BookList.vue') },
    { path: 'create', name: 'book-create', component: () => import('./pages/BookForm.vue') },
    { path: ':id/edit', name: 'book-edit', component: () => import('./pages/BookForm.vue') }
  ], { entity: 'books' })

  registry.addNavItem({
    section: 'Library',
    route: 'book',
    label: 'Books',
    icon: 'pi pi-book'
  })

  registry.addRouteFamily('book', ['book-'])
}
```

---

## Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                         Kernel                              │
│  (Bootstrap orchestrator - creates and wires everything)    │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┬──────────────┐
          ▼               ▼               ▼              ▼
    ┌──────────┐    ┌──────────┐   ┌───────────┐  ┌───────────┐
    │  Router  │    │SignalBus │   │HookRegistry│  │ZoneRegistry│
    │(auth guard)   │(events)  │   │(hooks)    │  │(UI blocks)│
    └──────────┘    └────┬─────┘   └─────┬─────┘  └───────────┘
                         │               │
                         ▼               ▼
                    ┌─────────────────────────┐
                    │      Orchestrator       │
                    │  (EntityManager registry)│
                    └───────────┬─────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
           ┌──────────────┐       ┌──────────────┐
           │EntityManager │  ...  │EntityManager │
           │  (books)     │       │  (users)     │
           └──────┬───────┘       └──────┬───────┘
                  │                      │
                  ▼                      ▼
           ┌──────────────┐       ┌──────────────┐
           │  Storage     │       │  Storage     │
           │  Adapter     │       │  Adapter     │
           └──────────────┘       └──────────────┘
```

**Injection Flow**:
```
Kernel
  ├─► provide('qdadmZoneRegistry', zoneRegistry)
  ├─► provide('qdadmSignals', signals)
  ├─► provide('qdadmHooks', hooks)
  └─► createQdadm plugin
        └─► provide('qdadmOrchestrator', orchestrator)
```

---

## Development Workflow

### Launch Demo

```bash
cd quazardous/qdadm
npm install              # Install all dependencies
npm run dev              # Start demo on http://localhost:5175
```

Or from skybot workspace:
```bash
make qdadm-demo          # Runs npm run dev in packages/demo
```

### Hot Reload

Vite provides full HMR (Hot Module Replacement) for both demo and qdadm source code. The demo app uses a Vite alias pointing directly to `packages/qdadm/src/`, enabling seamless hot-reload across the entire codebase.

#### What Hot-Reloads Automatically

| File Type | Location | Hot-Reload | Notes |
|-----------|----------|------------|-------|
| Vue components | `packages/demo/src/**/*.vue` | Instant | Demo pages, layouts |
| Vue components | `packages/qdadm/src/**/*.vue` | Instant | Core components (ListPage, PageHeader, etc.) |
| Composables | `packages/qdadm/src/composables/*.js` | Instant | Template/reactive changes |
| JavaScript | `packages/qdadm/src/**/*.js` | Instant | Kernel, EntityManager, etc. |
| CSS/Styles | `packages/qdadm/src/styles/*.css` | Instant | Global styles |

#### Hot-Reload Behavior Notes

1. **Vue Components** - Changes to `.vue` files hot-reload immediately without page refresh
2. **Composables** - Changes to reactive code (refs, computed) hot-reload instantly
3. **Constants/Static values** - Changes to exported constants (e.g., `PAGE_SIZE_OPTIONS`) are picked up but may require a page navigation to take effect (the module reloads, but existing component instances keep old values)
4. **Module init files** - Changes to `init.js` files may require a full page refresh (F5)

#### Development Workflow

```bash
# Terminal 1: Start demo dev server
cd quazardous/qdadm
npm run dev

# Make changes to any file in:
# - packages/demo/src/      → instant hot-reload
# - packages/qdadm/src/     → instant hot-reload

# No rebuild step needed!
```

#### No Build Required

Unlike published npm packages, the demo app imports qdadm source directly via Vite alias:

```javascript
// vite.config.js
resolve: {
  alias: [
    { find: 'qdadm', replacement: resolve(__dirname, '../qdadm/src') }
  ]
}
```

This means:
- **No `npm run build` in packages/qdadm** - changes are picked up instantly
- **No linking/symlinking** - direct source import
- Tests and builds are separate concerns (CI/publish workflow)

#### When to Refresh

Refresh the browser (F5) when:
- Adding new files that aren't imported yet
- Changing route definitions in `init.js`
- HMR fails silently (rare, check console for errors)

### Testing

```bash
cd packages/qdadm
npm test                 # Run Vitest tests
npm run test:watch       # Watch mode
```

---

## Key Patterns

### Entity Definition

```js
const books = new EntityManager({
  name: 'books',
  storage: new ApiStorage({ endpoint: '/api/books', client: axios }),
  labelField: 'title',
  fields: {
    title: { type: 'text', label: 'Title', required: true },
    author: { type: 'text', label: 'Author' },
    published: { type: 'date', label: 'Published' }
  },
  localFilterThreshold: 100
})
```

### Custom Permission Logic

```js
class BooksManager extends EntityManager {
  canCreate() {
    return this.authAdapter.hasRole('editor')
  }

  canUpdate(book) {
    return book?.author_id === this.authAdapter.getCurrentUserId()
  }
}
```

### Hook Extension

```js
// Register presave hook for validation
hooks.register('books:presave', async (event) => {
  const { record, isNew } = event.data
  if (!record.isbn) {
    throw new Error('ISBN required')
  }
  record.updated_at = new Date().toISOString()
})
```

### Zone Block Registration

```js
// Add custom block to header zone
zoneRegistry.registerBlock('header', {
  component: AnnouncementBanner,
  weight: 5,  // Before other content
  id: 'announcements'
})

// Wrap existing block
zoneRegistry.registerBlock('header', {
  component: BorderWrapper,
  operation: 'wrap',
  wraps: 'main-nav',
  id: 'nav-wrapper'
})
```

---

## File Quick Reference

| Component | File |
|-----------|------|
| Kernel | `packages/qdadm/src/kernel/Kernel.js` |
| EntityManager | `packages/qdadm/src/entity/EntityManager.js` |
| Orchestrator | `packages/qdadm/src/orchestrator/Orchestrator.js` |
| SignalBus | `packages/qdadm/src/kernel/SignalBus.js` |
| HookRegistry | `packages/qdadm/src/hooks/HookRegistry.js` |
| ZoneRegistry | `packages/qdadm/src/zones/ZoneRegistry.js` |
| useListPageBuilder | `packages/qdadm/src/composables/useListPageBuilder.js` |
| useForm | `packages/qdadm/src/composables/useForm.js` |
| Module Registry | `packages/qdadm/src/module/moduleRegistry.js` |
| Storage Adapters | `packages/qdadm/src/entity/storage/` |
| Components | `packages/qdadm/src/components/` |
| Demo Entry | `packages/demo/src/main.js` |

---

## Browser Testing (Claude in Chrome)

Agents can use Claude in Chrome MCP tools to validate UI changes directly in the browser.

### Setup Workflow

```
1. tabs_context_mcp          # Get available tabs (creates group if needed)
2. tabs_create_mcp           # Create new tab for testing
3. navigate url="http://localhost:5175"   # Navigate to demo app
```

### Reading Page Structure

```
read_page filter="interactive"   # Get interactive elements (buttons, links, inputs)
read_page                        # Get full accessibility tree
find query="submit button"       # Find specific elements by description
```

### Accessing qdadm Internals

Access Vue provides through the mounted app element:

```javascript
// In javascript_tool - access orchestrator and managers
const appElement = document.getElementById('app');
const vueApp = appElement?.__vue_app__;
const provides = vueApp?._context?.provides || {};

// Available provides:
// - qdadmOrchestrator  → EntityManager registry
// - qdadmSignals       → SignalBus instance
// - qdadmHooks         → HookRegistry instance
// - qdadmZoneRegistry  → ZoneRegistry instance
// - qdadmRouter        → Vue Router instance

const orchestrator = provides.qdadmOrchestrator;
const books = orchestrator.get('books');
```

### Testing EntityManager Operations

```javascript
// In javascript_tool - test CRUD operations
(async () => {
  const app = document.getElementById('app').__vue_app__;
  const orchestrator = app._context.provides.qdadmOrchestrator;
  const books = orchestrator.get('books');

  // List entities
  const response = await books.list({ limit: 5 });
  console.log('[TEST] Total books:', response.total);

  // Get single entity
  const book = await books.get(response.items[0].id);
  console.log('[TEST] Book title:', book.title);

  return { success: true, total: response.total };
})()
```

### Console Message Verification

Use `[TEST]` prefix for filterable assertions:

```javascript
// In javascript_tool
console.log('[TEST] Starting validation');
console.log('[TEST] PASS: EntityManager found');
console.error('[TEST] FAIL: Missing required field');
```

```
read_console_messages pattern="\[TEST\]"   # Filter test messages
read_console_messages onlyErrors=true      # Get errors only
```

**Note**: Console tracking starts when `read_console_messages` is first called. Call it once before running tests to enable tracking.

### Complete Test Example

```
# 1. Setup
tabs_context_mcp createIfEmpty=true
tabs_create_mcp
navigate url="http://localhost:5175" tabId=<tab_id>

# 2. Verify page loaded
read_page filter="interactive" tabId=<tab_id>
# Expected: links to /books, /genres, /loans, /users

# 3. Initialize console tracking
read_console_messages tabId=<tab_id> pattern="\[TEST\]"

# 4. Test EntityManager access
javascript_tool tabId=<tab_id> text="
  const app = document.getElementById('app').__vue_app__;
  const orchestrator = app._context.provides.qdadmOrchestrator;
  console.log('[TEST] Managers:', orchestrator.getRegisteredNames().join(', '));
  'done'
"

# 5. Verify console output
read_console_messages tabId=<tab_id> pattern="\[TEST\]"
# Expected: [TEST] Managers: books, users, loans, genres
```

### UI Interaction

```
# Click navigation
computer action="left_click" ref="ref_2" tabId=<tab_id>

# Fill form inputs
form_input ref="ref_5" value="New Book Title" tabId=<tab_id>

# Take screenshot for visual verification
computer action="screenshot" tabId=<tab_id>
```

---

## Version History

- **v0.16.0** (current): HookRegistry with lifecycle hooks (presave, postsave, predelete), ZoneRegistry with wrap/extend operations, list:alter hook
