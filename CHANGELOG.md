# Changelog

All notable changes to qdadm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.32.0] - 2026-01-03

### Added
- **Multi-source auth with `CompositeAuthAdapter`**: Route entity permissions to different auth backends
  - `CompositeAuthAdapter`: Routes `canPerform()`/`canAccessRecord()` based on entity patterns
  - Exact match: `'products': apiKeyAdapter`
  - Glob patterns: `'external-*': externalAuth`, `'*-readonly': readonlyAuth`
  - `authFactory()`: Factory/resolver pattern (like storage factory)
  - Backward compatible: passing AuthAdapter instance works as before
  - Kernel auto-resolves via `_resolveEntityAuthAdapter()` at boot

### Example
```js
createKernel({
  authTypes: { apikey: ApiKeyAdapter },
  entityAuthAdapter: {
    default: internalAuth,          // JWT for most entities
    mapping: {
      'products': { type: 'apikey', key: 'xxx' },
      'external-*': externalOAuth   // OAuth for external-*
    }
  }
})
```

## [0.31.1] - 2026-01-03

### Added
- **MockApiStorage `authCheck` option**: Simulates API auth protection
  - Constructor option `authCheck: () => boolean` - throws 401 if returns false
  - Instance `capabilities` getter includes `requiresAuth: true` when authCheck configured
  - Allows demos to realistically simulate protected API behavior
- **Debug bar Test Fetch button**: Test storage access directly from entities panel
  - Shows success (green, item count) or error (red, status code + message)
  - Useful for debugging auth protection (401 errors when not logged in)
- **Module System v2**: Class-based modules with lifecycle hooks
  - `Module` base class with `enabled()`, `connect()`, `disconnect()` lifecycle
  - `ModuleLoader` with dependency resolution via `static requires = []`
  - Priority-based loading via `static priority` (lower = earlier)
  - `KernelContext` provides clean API for modules (signals, zones, router, etc.)
  - `kernel.use(new Module(options))` registration pattern
  - Signal listener auto-cleanup on module disconnect
- **Debug System**: Comprehensive debugging infrastructure
  - `DebugModule` integrates debug tools via Module System v2
  - `DebugBridge` manages collectors and enabled state
  - `DebugBar` component with collapsible panels
  - Collectors: `ErrorCollector`, `SignalCollector`, `ToastCollector`, `ZonesCollector`, `AuthCollector`, `EntitiesCollector`
  - Internal zones convention: `_` prefix hides zones from debug panel
  - Zones panel toggles: "All Pages" (cyan) and "Internal" (orange)
  - Zone highlighting with visual overlay on page
- **Toast System**: Signal-based toast notifications
  - `ToastBridgeModule` bridges signals to PrimeVue Toast
  - `useSignalToast()` composable: `toast.success()`, `toast.error()`, `toast.warn()`, `toast.info()`
  - `ToastCollector` for debugging toast history
- **`useCurrentEntity` composable**: Share entity data between page and nav context
  - Prevents double GET calls on detail pages
  - Page fetches entity, nav context reuses it for breadcrumb label
  - `provideCurrentEntity(manager, id)` in page, `useNavContext()` consumes it

### Fixed
- **Debug bar icons**: Changed `readOnly` icon from lock to eye (`pi-eye`) to avoid conflict with `requiresAuth` lock
- **Debug bar alignment**: Buttons (Load, Fetch, Invalidate) consistently aligned to right with `margin-left: auto`

### Changed
- **Dynamic zones**: Zones now created on-demand when used
  - Removed `registerStandardZones()` - no phantom zones
  - `registerBlock()` auto-creates zone if not exists
- **Internal zones**: `DEBUG_ZONE` → `'_app:debug'`, `TOAST_ZONE` → `'_app:toasts'`
- `ZonesPanel` always renders (toolbar accessible even with no zones)

### Demo (0.14.1)
- MockApiStorage with `authCheck` for books, loans, genres, users (401 when not authenticated)

### Demo (0.14.0)
- All modules refactored to use Module System v2 pattern
- `BooksModule`, `ProductsModule`, `LoansModule`, etc. as class-based modules
- `BookList.vue` demonstrates zone usage with `<Zone name="books-list-header">`

## [0.30.0] - 2026-01-01

### Added
- **Security: Token expiration handling**
  - `auth:expired` signal emitted on 401/403 API responses
  - `auth:logout` signal with `reason` payload
  - `api:error` signal for centralized error handling
  - Kernel auto-handles `auth:expired`: logout + redirect to `/login?expired=1`
- **`Kernel.setupApiClient()`**: Wire axios clients with auth interceptors
  - Adds Authorization header from authAdapter.getToken()
  - Emits `auth:expired` on 401/403 responses
  - Emits `api:error` on any API error
- **`qdadm/editors` subpath export**: Optional editors requiring vanilla-jsoneditor
  - `VanillaJsonEditor` and `JsonStructuredField` moved from `qdadm/components`
  - Reduces bundle size for apps not using JSON editor (~690KB saved)
  - `vanilla-jsoneditor` now optional peer dependency

### Changed
- **BREAKING**: `VanillaJsonEditor` and `JsonStructuredField` now imported from `qdadm/editors`
  - Before: `import { VanillaJsonEditor } from 'qdadm/components'`
  - After: `import { VanillaJsonEditor } from 'qdadm/editors'`
- `vanilla-jsoneditor` moved from peerDependencies to optionalDependencies

### Documentation
- Updated `docs/security.md` with Token Expiration & Auto-Logout section
- Updated `docs/signals.md` with Auth Signals table and setupApiClient examples
- Added "Security by Default" section to `QDADM_CREDO.md`

## [0.29.0] - 2025-12-31

### Added
- **qdadm-gen**: Integrated code generation system for EntityManagers
  - `generateManagers()` creates managers from OpenAPI/JSON schemas
  - `createManagers()` factory with storage profile resolution
  - `FieldMapper` for schema-to-field type conversion
  - `StorageProfileFactory` for connector configuration
  - Decorators: `withPagination`, `withSearch`, `withFilters`
  - Connectors: `ApiConnector`, `MockConnector` for different backends
  - Vite plugin for build-time manager generation

### Demo (0.13.0)
- **New modules**: Countries (REST Countries API), Products (DummyJSON), Posts, Todos, Favorites, Settings, JP-Users
- **useFavoriteAction composable**: DRY favorite toggle action for list pages
- **Fixed**: RestCountriesStorage now uses proper storage pattern (list override vs custom _fetchAll)
- **Fixed**: useFavoriteAction uses `useOrchestrator()` instead of invalid `inject('qdadm')`
- **Added**: Vite `@` alias for src imports

## [0.28.0] - 2025-12-31

### Added
- **EventRouter**: Declarative signal routing for cross-cutting concerns
  - Transforms high-level events into targeted signals
  - Supports string (forward payload), object (transform), function (callback)
  - Cycle detection at boot (topological sort)
  - Config via `Kernel({ eventRouter: { 'source': ['target', ...] } })`
  - EntityManager listens to `cache:entity:invalidate:{name}` signal
- **DeferredRegistry**: Async service coordination with named promises
  - `await()` can be called before `queue()` - true loose coupling
  - Kernel registers `auth:ready` deferred when authAdapter configured
  - EntityManager warmup awaits `auth:ready` before populating cache
  - `useDeferred()` and `useDeferredValue()` composables
- **Storage factory**: String pattern resolution for manager configs
  - `'api:/api/books'` → creates ApiStorage + EntityManager
  - `'mock:books'` → creates MockApiStorage
  - Custom `storageResolver` and `managerResolver` options

### Changed
- **Warmup renamed**: `warmupAll()` → `fireWarmups()` (fire-and-forget semantic)
- **Cache invalidation**: EntityManager no longer listens to auth signals directly
  - Use EventRouter for `auth:impersonate` → `cache:entity:invalidate:*` routing
  - Components stay simple, high-level routing handles orchestration

### Demo (0.12.1)
- Added `eventRouter` config example for `auth:impersonate` → loans cache invalidation

## [0.27.0] - 2025-12-31

### Added
- **LoginPage component**: Generic login page for admin dashboards
  - Customizable via props: `title`, `icon`, `logo`, `usernameLabel`, `passwordLabel`, `submitLabel`, `redirectTo`
  - Pre-fill support: `defaultUsername`, `defaultPassword`
  - Business signals: `emitSignal` prop emits `auth:login` event on success
  - Slots: `#logo` (custom logo component), `#footer` (custom help text)
  - Uses injected `authAdapter` from qdadm context
  - Emits `login` and `error` events
- **useSSE composable**: Server-Sent Events with auto-reconnect
  - Options: `eventHandlers`, `reconnectDelay`, `autoConnect`, `withCredentials`, `tokenParam`, `getToken`
  - Returns: `connected`, `error`, `reconnecting`, `connect`, `close`, `reconnect`
  - Auto-connects on mount, auto-disconnects on unmount
  - Uses `authAdapter.getToken()` for authentication

### Demo (0.12.0)
- `LoginPage.vue`: Now uses qdadm LoginPage component with footer slot for demo accounts hint

## [0.26.3] - 2025-12-31

### Added
- **Responsive layout**: Mobile-first responsive design for admin dashboards
  - SCSS breakpoints system (`_breakpoints.scss`) with desktop-first mixins
  - Global responsive styles (`_responsive.scss`) for layout, DataTable, filters, forms
  - Mobile sidebar drawer with hamburger menu toggle
  - Overlay backdrop when sidebar open on mobile
  - Tablet breakpoint (768-1023px) with narrower sidebar
  - Mobile breakpoint (<768px) with hidden sidebar and drawer pattern

### Fixed
- **Mobile menu clickable**: Fixed z-index issue where overlay (999) was blocking sidebar (100)
  - Changed overlay z-index to 99 so menu items are clickable

### Changed
- **Styles entry point**: Renamed `index.css` → `index.scss`, using modern `@use` syntax

## [0.26.2] - 2025-12-30

### Fixed
- **Search restore on navigation**: Search now initialized from session at declaration time
  - Unified with filter restore: both use `savedSession` at component init
  - Removed complex flag/nextTick workaround
  - `restoreFilters()` simplified to only apply URL overrides

## [0.26.1] - 2025-12-30 (superseded by 0.26.2)

### Fixed
- Search restore attempt with flag (incomplete fix)

## [0.26.0] - 2025-12-30

### Added
- **Search persistence**: Search query now persisted to sessionStorage with filters
  - Stored as `_search` key alongside filter values
  - Restored on page reload (URL params take priority)
  - Cleared with `clearFilters()`

## [0.25.0] - 2025-12-30

### Added
- **searchFields override**: Restrict search scope via `setSearch({ fields: [...] })`
  - Storage declares all searchable fields in `capabilities.searchFields`
  - Page can override to search only a subset of fields
  - Parent entity fields resolved via `_resolveSearchFields()` on cache fill
  - Example: Storage has `['book.title', 'user.username']`, page uses `fields: ['book.title']`

### Fixed
- **Parent field resolution**: `_resolveSearchFields()` now called when cache is populated
  - Added calls in `list()` opportunistic cache fill and `_loadCache()`
  - Uses `orchestrator.get()` instead of non-existent `getManager()`
  - Parent field values cached in non-enumerable `item._search` property

### Demo (0.11.0)
- `LoanList.vue`: Demonstrates searchFields override (`fields: ['book.title']`)
- Search "dune" → 1 result, search "bob" → 0 results (username excluded)

## [0.24.0] - 2025-12-30

### Added
- **FilterQuery class**: Unified abstraction for smart filter options resolution
  - `source` types: `'entity'`, `'endpoint'`, `'field'`, `'static'`
  - Label/value resolution with `optionLabel` and `optionValue`
  - Transform support via `processor` callback
  - `toQuery()` method for API-compatible query generation
- **Tagged console logging**: Debug-friendly log tags for validation
  - `[filterquery]` - options loading events
  - `[cache]` - cache hit/miss events
  - `[signal]` - SignalBus events

### Changed
- `useListPageBuilder`: FilterQuery integration for all smart filter modes
  - `optionsEntity` uses FilterQuery with source='entity'
  - `optionsFromCache` uses FilterQuery with source='field'
  - `optionsEndpoint` uses FilterQuery with source='endpoint'

### Demo (0.10.0)
- All filter scenarios validated via Claude in Chrome (S1-S7)
- `LoanList.vue`: Demonstrates optionsFromCache + autocomplete patterns

## [0.23.0] - 2025-12-30

### Added
- **EntityManager auto-cache**: Automatic caching for small datasets
  - `storageSupportsTotal` getter checks storage capabilities
  - Auto-cache when `total < CACHE_THRESHOLD` (default: 100)
  - Local filtering via QueryExecutor on cached items
- **SignalBus cache invalidation**: Event-driven cache coordination
  - `cache:entity:invalidated` signal on CRUD operations
  - Filters can listen and refresh options automatically

### Changed
- `EntityManager.list()`: Stores items in cache when total within threshold
- `EntityManager._filterLocally()`: Uses QueryExecutor for MongoDB-like queries

## [0.22.0] - 2025-12-30

### Added
- **Storage capabilities contract**: Declarative storage feature detection
  - `Storage.capabilities` object: `{ supportsTotal, supportsFilters, supportsSort }`
  - All storage classes updated: ApiStorage, SdkStorage, MemoryStorage, MockApiStorage, LocalStorage
  - Backward-compatible `instance` getter for legacy code

## [0.21.0] - 2025-12-30

### Added
- **QueryExecutor class**: MongoDB-like query execution for local filtering
  - Comparison operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`
  - Set operators: `$in`, `$nin`, `$like`, `$between`
  - Logical operators: `$or`, `$and`
  - Nested field paths: `author.name`, `tags.0`
  - `execute(items, query)` - filter array of items
  - `match(item, query)` - test single item

## [0.20.0] - 2025-12-29

### Added
- **Smart Filters v2**: Enhanced filter configuration options
  - `cacheOptions: true | false | 'auto'` - control option caching behavior
  - `component: 'dropdown' | 'autocomplete'` - explicit component type selection
  - Auto-discovery threshold: >50 options → autocomplete (configurable via `SMART_FILTER_THRESHOLD`)
  - Default component based on cache mode: cached → dropdown, uncached → autocomplete

### Fixed
- **optionsFromCache bug**: Options no longer disappear when filtering
  - Added `_optionsLoaded` flag to prevent re-extraction from filtered data
  - Options extracted only when filter is inactive (captures full dataset)

### Changed
- `loadFilterOptions()`: Now supports cacheOptions and component type logic
- `updateCacheBasedFilters()`: Same caching/component logic as loadFilterOptions

### Demo (0.9.0)
- `LoanList.vue`: Demonstrates `component: 'autocomplete'` explicit override

## [0.19.0] - 2025-12-29

### Added
- **Smart Filter Options**: `addFilter()` now supports automatic option loading
  - `optionsEntity: 'entityName'` - fetch options from related EntityManager
  - `optionsEndpoint: '/path'` or `optionsEndpoint: true` - fetch from API endpoint
  - `optionsFromCache: true` - extract unique values from loaded items
  - `processor: (options) => options` - transform options before display
- Options auto-prepend "All" with `null` value
- `optionLabel` and `optionValue` config for field mapping

### Changed
- `loadFilterOptions()` now processes smart filter modes directly from `addFilter()` config
- `updateCacheBasedFilters()` watcher: auto-updates options when items change

### Demo (0.9.0)
- `BookList.vue`: Uses `optionsEntity: 'genres'` instead of manual `onMounted` loading
- `LoanList.vue`: Demonstrates `optionsEntity: 'books'` and `optionsFromCache` with processor

## [0.18.0] - 2025-12-28

### Added
- **Module init pattern for zones**: Zones/signals/hooks passed to `init({ registry, zones, signals, hooks })`
  - Registration happens during Kernel bootstrap, not Vue lifecycle
  - `defineAsyncComponent()` required for lazy-loading Vue components in init.js
  - Prevents silent failures from composables called before Vue app exists
- **Extension documentation**: Separate docs for zones, signals, hooks
  - `docs/zones.md`: Zone/block operations (add, replace, extend, wrap)
  - `docs/signals.md`: Event-driven communication patterns
  - `docs/hooks.md`: Drupal-inspired lifecycle hooks
  - `docs/extension.md`: Index of extension mechanisms

### Changed
- **Kernel initialization order**: Services (signals, hooks, zones) created before `initModules()`
- **moduleRegistry.initModules()**: Now passes context object `{ registry, zones, signals, hooks }` to modules
- **ZoneRegistry**: Warns on duplicate block ID in debug mode (instead of silent replace)

### Demo (0.8.0)
- Module init files updated to use destructured context: `init({ registry, zones })`
- Zone blocks use `defineAsyncComponent()` for lazy loading

## [0.17.0] - 2025-12-28

### Removed
- **Legacy composables cleanup** (T233):
  - `usePageBuilder`: Replaced by `useListPageBuilder`
  - `useManager`: Redundant with `useOrchestrator().getManager()`
  - `useEntityTitle`: Unused, functionality covered by EntityManager
  - `useSubEditor`: Unused
  - `useTabSync`: Unused
  - `useStatus`: Unused

### Changed
- Exports updated to remove deleted composables from public API
- `useJsonSyntax` and `useSignals` retained (have internal usage)

### Demo (0.7.0)
- Removed `BookForm.vue` (duplicate of `BookCreate.vue` + `BookEdit.vue`)

## [0.16.0] - 2025-12-21

### Added
- `useNavContext` composable: Route-aware navigation context for breadcrumb and navlinks
  - Builds navigation from route path pattern analysis (not heuristics)
  - Supports N levels of nested routes via recursive parent chain
  - Auto-fetches entity labels from EntityManager
  - Path pattern: static segments → list, param segments → item, action segments → ignored
  - Route meta: `entity` (required), `parent: { entity, param }` (for child routes)

### Changed
- `AppLayout`: Uses `useNavContext` instead of `useBreadcrumb` for navigation
- Sidebar header: Version tag now displayed below title
- Route meta `entity` declaration required for proper breadcrumb generation

### Deprecated
- `useBreadcrumb`: Replaced by `useNavContext` (still exported for backwards compat)

## [0.15.2] - 2025-12-21

### Added
- `usePageTitle` composable: Provide custom title for PageHeader in custom pages
  - Simple title: `usePageTitle('My Custom Page')`
  - Decorated title: `usePageTitle({ action: 'View', entityName: 'Stats', entityLabel: 'Dashboard' })`
  - Reactive updates via `setTitle()`
  - For standard CRUD pages, `useForm` handles this automatically

## [0.15.1] - 2025-12-21

### Added
- `Kernel.hashMode`: Option for hash-based routing (`/#/path`) for static hosting (GitHub Pages)
  - No server config needed, Ctrl+R works everywhere

## [0.15.0] - 2025-12-21

### Added
- **Child Routes Support**: Navigate to filtered child entity lists
  - `PageNav` component: Provides breadcrumb + navlinks to AppLayout via inject
  - `ListPage` slot `#nav`: Inject PageNav without extra wrapper
  - Route meta `parent: { entity, foreignKey, param }` for auto-filtering
  - Auto-breadcrumb chain: Parent > Entity Label > Child
  - Navlinks for sibling routes (e.g., Details | Books)
- `LocalStorage.list({ search })`: Substring search across all string fields
- `useBreadcrumb` composable: Auto-generate breadcrumb from route

### Fixed
- `LocalStorage` filters: Use exact match (`===`) instead of substring (`includes`)
  - Fixes "fiction" matching "non-fiction"
- `PageHeader`: Consistent height with `min-height: 2.5rem` (with or without action buttons)

### Changed
- `AppLayout`: Global breadcrumb bar with navlinks support
  - Child pages override via `provide/inject` pattern
  - Flat breadcrumb style (transparent, no border)

## [0.14.4] - 2025-12-21

### Fixed
- Storage adapters: Use `params.filters` object for field filters (was using spread params)
  - Affects `LocalStorage`, `MemoryStorage`, `ApiStorage`
  - Fixes filter not working with `useListPageBuilder`

### Changed
- **Storage interface**: `list()` now expects `{ filters: { field: value } }` instead of spreading filters directly
  - Example: `storage.list({ page: 1, filters: { genre: 'fiction' } })`

## [0.14.3] - 2025-12-21

### Fixed
- Demo: Pass `basePath` to Kernel for correct Vue Router base path on GitHub Pages

## [0.14.2] - 2025-12-21

### Added
- GitHub Pages deployment via GitHub Actions (auto-deploy on push to main)

## [0.14.1] - 2025-12-21

### Added
- `ScopeEditor`: Global config via `provide('scopeConfig', { prefix, endpoint, resources, actions })`
  - Priority: props > globalConfig > defaults
  - Allows app-level scope prefix without per-component props

### Changed
- `ScopeEditor`: Default `scopePrefix` is now "app" (generic default)

### Documentation
- Consolidated CHANGELOG at monorepo root
- Simplified package README with links to root docs

## [0.14.0] - 2025-12-21

### Added
- `EntityManager.list({ cacheSafe })`: Allow caching with ownership/scope filters
  - Use for session-bound filters (e.g., `user_id`) that are constant during the session
  - Example: `params.cacheSafe = true` when filtering by current user's ID
- `Storage.supportsCaching`: Storage adapters declare if they benefit from cache layer
  - `LocalStorage.supportsCaching = false` (already in-memory, cache is redundant)
  - `ApiStorage.supportsCaching = true` (reduces network requests)

### Changed
- `EntityManager.isCacheEnabled`: Now checks `storage.supportsCaching`
  - Cache disabled if storage explicitly sets `supportsCaching = false`

### Fixed
- `LoansManager.list()`: Use `super.list()` instead of `this.storage.list()`
  - Ensures proper cache handling in subclasses

## [0.13.0] - 2025-12-21

### Added
- `EntityManager.getMany(ids)`: Batch fetch multiple entities by IDs
  - Delegates to `storage.getMany(ids)` if available
  - Falls back to parallel `get()` calls
- `EntityManager.canCreate()`: Permission check for creating entities
- `EntityManager.canUpdate(entity?)`: Permission check for updating entities
- `EntityManager.children`: Config for parent-child entity relationships
- `BoolCell` component: Standardized tristate boolean display
  - `true` → green check (`--p-green-500`)
  - `false` → red cross (`--p-red-500`)
  - `null/undefined` → empty
- `LocalStorage.getMany(ids)`: Optimized batch fetch for localStorage adapter

### Changed
- **BREAKING**: Removed `canWrite()` - use `canCreate()` / `canUpdate()` instead
- `addCreateAction()`: Uses `manager.canCreate()` for visibility
- `addEditAction()`: Uses `manager.canUpdate(row)` for visibility

## [0.12.0] - 2025-12-21

### Added
- `useListPageBuilder.addFilter({ local_filter })`: Custom filter callback for local mode
- `useListPageBuilder.setSearch({ local_search })`: Custom search callback for local mode
- `EntityManager.localFilterThreshold`: Per-entity threshold for auto local filtering

### Changed
- **BREAKING**: Renamed `filterMode: 'api'` → `filterMode: 'manager'` (clearer intent)

## [0.11.0] - 2025-12-20

### Added
- Permission-aware form fields pattern (demo)
- Detailed comments on `useForm` return values

## [0.10.0] - 2025-12-20

### Added
- Complete permission patterns with documented examples (demo)
- Fixture seeding system with JSON files (demo)

## [0.9.0] - 2025-12-20

### Added
- `useListPageBuilder.props`: Computed object with all ListPage props
- `useListPageBuilder.events`: Event handlers object
- `useListPageBuilder.hasBulkActions`: Auto-detects bulk actions
- Auto-selectable: Checkboxes shown only when bulk actions exist

## [0.8.0] - 2025-12-20

### Added
- `EntityManager.canDelete(entity?)`: Fine-grained delete permission check
- `useListPageBuilder`: Standard actions now respect permissions

## [0.7.0] - 2025-12-20

### Added
- `Kernel`: All-in-one bootstrap class
- `kernel.getRouter()`, `kernel.getApp()`, `kernel.getOrchestrator()`

## [0.6.0] - 2025-12-20

### Added
- `registry.addRoutes(prefix, routes, { entity })`: Route-level entity binding
- `registry.addNavItem({ entity })`: Nav item entity binding
- **Auto Route Guard**: Redirects to `/` if `manager.canRead()` returns false
- **Auto Nav Filtering**: Hides items based on `manager.canRead()`

## [0.5.0] - 2025-12-20

### Added
- `useGuardStore`: Shared store for automatic UnsavedChangesDialog
- `AppLayout`: Automatic UnsavedChangesDialog rendering
- `EntityManager.canRead(entity?)`: Permission check for reading

### Removed
- `features.scopes`: Permission logic belongs in EntityManager

## [0.4.0] - 2025-12-20

### Added
- `EntityManager.getEntityLabel(entity)`: Get display label
- `EntityManager.labelField`: String or callback function
- `PageLayout`: `manager` prop for automatic label derivation

## [0.3.1] - 2025-12-20

### Added
- `AppLayout`: "powered by qdadm" footer
- `assets/logo.svg`: Hexagon logo with "QD"

### Fixed
- `AppLayout`: Vue Flow and full-height components render correctly

## [0.3.0] - 2025-12-20

### Added
- `AppLayout` component with auto-nav from module registry
- `useNavigation` composable
- `useStatus` composable
- `setSectionOrder()` for navigation order

## [0.2.0] - 2025-12-20

### Added
- README.md with quick start guide
- Successfully integrated with production dashboard (60+ modules)

## [0.1.0] - 2025-12-20

### Added
- `createQdadm` plugin for Vue 3 bootstrap
- EntityManager with CRUD and permissions
- Storage adapters (ApiStorage, LocalStorage)
- Composables: useForm, useListPageBuilder, useBareForm, etc.
- Components: ListPage, FormField, AppLayout, etc.
- Module system with auto-discovery
