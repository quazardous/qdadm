# Changelog

All notable changes to qdadm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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

### Demo
- `read` field moved from `books` to `loans` entity
- `BookForm`: Tabs in edit mode showing child entities (Loans)
- `LoanList`: Bulk actions "Mark Read" / "Mark Unread"
- `LoanForm`: Toggle for `read` field
- Permission examples updated to use `canCreate()` / `canUpdate()`

## [0.12.0] - 2025-12-21

### Added
- `useListPageBuilder.addFilter({ local_filter })`: Custom filter callback for local mode
  - Specifies HOW to filter when in local mode (items < threshold)
  - Example: `local_filter: (item, value) => value === 'active' ? !item.returned_at : true`
  - Filters with `local_filter` are **not sent to manager** (virtual fields)
  - `local_filter: false` = manager only, skip in local mode
- `useListPageBuilder.setSearch({ local_search })`: Custom search callback for local mode
  - Specifies HOW to search when in local mode
  - Example: `local_search: (item, query) => booksMap[item.book_id]?.title.includes(query)`
  - `local_search: false` = manager only, skip in local mode
- `EntityManager.localFilterThreshold`: Per-entity threshold for auto local filtering
  - Priority: config `autoFilterThreshold` > `manager.localFilterThreshold` > default (100)

### Changed
- **BREAKING**: Renamed `filterMode: 'api'` → `filterMode: 'manager'` (clearer intent)
- **Demo**: `LoanList` uses `local_filter` for virtual `status` filter
- **Demo**: `LoanList` uses `local_search` for book title lookup

### Documentation
- **The threshold decides everything**:
  - `items >= threshold` → **manager mode**: delegate ALL filtering to EntityManager
  - `items < threshold` → **local mode**: filter client-side
- **Modes**:
  - `filterMode: 'manager'`: Always delegate to EntityManager
  - `filterMode: 'local'`: Always filter client-side
  - `filterMode: 'auto'` (default): Switch based on threshold
- **Behavior Matrix**:
  | Type                        | Mode `manager`  | Mode `local`                |
  |-----------------------------|-----------------|-----------------------------|
  | Filter standard             | Manager handles | `item[field] === value`     |
  | Filter + `local_filter`     | Manager handles | `local_filter(item, value)` |
  | Filter + `local_filter:false` | Manager handles | (skipped)                 |
  | Search standard             | Manager handles | `field.includes(query)`     |
  | Search + `local_search`     | Manager handles | `local_search(item, query)` |
  | Search + `local_search:false` | Manager handles | (skipped)                 |
- **Threshold Priority**: config > `manager.localFilterThreshold` > 100

## [0.11.0] - 2025-12-20

### Added
- **Demo**: Permission-aware form fields pattern
  - `LoanForm`: Non-admin users get `user_id` auto-set and field locked
  - `LoansManager.create()`: Enforces `user_id` server-side for non-admin
- **Demo**: Detailed comments on `useForm` return values (`loading`, `saving`, `dirty`, `isEdit`)

### Changed
- **Demo**: Simplified `onMounted` pattern replaces `watch` for form field initialization

## [0.10.0] - 2025-12-20

### Added
- **Demo**: Complete permission patterns with documented examples
  - `UsersManager`: Admin-only access (canRead/canWrite)
  - `BooksManager`: Everyone edits, admin-only delete (canDelete)
  - `LoansManager`: Ownership-based filtering (list override + row-level permissions)
- **Demo**: Detailed JSDoc comments explaining all qdadm patterns
- **Demo**: Fixture seeding system with JSON files

### Changed
- **Demo**: Login page shows all available demo accounts with role explanations

## [0.9.0] - 2025-12-20

### Added
- `useListPageBuilder.props`: Computed object with all ListPage props - use with `v-bind="list.props.value"`
- `useListPageBuilder.events`: Event handlers object - use with `v-on="list.events"`
- `useListPageBuilder.hasBulkActions`: Auto-detects if bulk actions are available
- Auto-selectable: Checkboxes shown only when bulk actions exist (no manual `selectable` prop needed)

### Changed
- ListPage template simplified from ~20 props/events to just `v-bind` + `v-on`

## [0.8.0] - 2025-12-20

### Added
- `EntityManager.canDelete(entity?)`: Fine-grained delete permission check
- `useListPageBuilder`: Standard actions now respect permissions:
  - `addCreateAction()`: Hidden if `manager.canCreate()` returns false
  - `addEditAction()`: Hidden per row if `manager.canUpdate(row)` returns false
  - `addDeleteAction()`: Hidden per row if `manager.canDelete(row)` returns false
  - `addBulkDeleteAction()`: Hidden if `manager.canDelete()` returns false

## [0.7.0] - 2025-12-20

### Added
- `Kernel`: All-in-one bootstrap class - handles Vue app, Pinia, PrimeVue, router, auth guard, and qdadm
  - Constructor is declarative (stores config only)
  - `createApp()` does all initialization, returns Vue app for mount
  - Allows tweaking `kernel.options` before `createApp()`, or adding plugins/directives before `mount()`
  ```js
  const kernel = new Kernel({
    root: App,
    modules: import.meta.glob('./modules/*/init.js', { eager: true }),
    managers, authAdapter,
    pages: { login, layout },
    homeRoute: 'book',
    app: { name: 'My App' },
    primevue: { plugin: PrimeVue, theme: Aura }
  })
  kernel.createApp().mount('#app')
  ```
- `kernel.getRouter()`, `kernel.getApp()`, `kernel.getOrchestrator()` - access internals

## [0.6.0] - 2025-12-20

### Added
- `registry.addRoutes(prefix, routes, { entity })`: Route-level entity binding for permission checks
- `registry.addNavItem({ entity })`: Nav item entity binding for permission checks
- **Auto Route Guard**: Plugin adds `beforeEach` guard that redirects to `/` if `manager.canRead()` returns false
- **Auto Nav Filtering**: `useNavigation` filters items and hides empty sections based on `manager.canRead()`

## [0.5.0] - 2025-12-20

### Added
- `useGuardStore`: Shared reactive store for automatic UnsavedChangesDialog rendering
- `AppLayout`: Automatically renders UnsavedChangesDialog when a form is active (no code needed in forms)
- `EntityManager.canRead(entity?)`: Permission check for reading (general or specific entity)
- `EntityManager.canWrite(entity?)`: Permission check for writing (general or specific entity)

### Changed
- `useBareForm`: Uses `registerGuardDialog`/`unregisterGuardDialog` from store instead of provide/inject
- `UnsavedChangesDialog`: Refactored to use `SimpleDialog` internally
- `PageLayout`: Removed `guardDialog` prop (dialog is now automatic via AppLayout)

### Removed
- `features.scopes`: Removed from plugin config - permission logic belongs in EntityManager
- `useAuth.hasScope()`: Replaced by `EntityManager.canRead()`/`canWrite()` pattern

### Fixed
- `useDirtyState`: Fixed timing issue where `takeSnapshot()` used `nextTick()` causing navigation to be blocked after save

## [0.4.0] - 2025-12-20

### Added
- `EntityManager.getEntityLabel(entity)`: Method to get display label, handles both string field and callback
- `EntityManager.labelField`: Can now be a string (field name) or callback function `(entity) => string`
- `PageLayout`: `manager` prop - derives labelField automatically from EntityManager

### Changed
- `PageLayout`: Uses `manager.getEntityLabel()` instead of manual field access
- `useBreadcrumb`: Shows entity label in breadcrumb (replaces ID segment), keeps action labels (Edit/Create/View)

## [0.3.1] - 2025-12-20

### Added
- `AppLayout`: "powered by qdadm" footer with version display
- `assets/logo.svg`: Hexagon logo with "QD" in two-tone blue
- `features.poweredBy`: Option to hide "powered by" footer (default: true)

### Fixed
- `AppLayout`: Vue Flow and full-height components now render correctly (flex layout)
- `AppLayout`: Use `<RouterView />` fallback when no slot content provided

### Changed
- `AppLayout`: Sidebar width uses CSS variable `var(--fad-sidebar-width, 15rem)` instead of hardcoded `250px`
- `tokens.css`: Layout tokens now use `rem` units (`--fad-sidebar-width`, `--fad-header-height`, `--fad-content-max-width`)
- `main.css`: Removed ~130 lines of duplicated styles (sidebar, nav, login, user-info) - now only in AppLayout scoped CSS

## [0.3.0] - 2025-12-20

### Added
- `AppLayout` component with auto-nav from module registry
- `useNavigation` composable for navigation state management
- `useStatus` composable for generic status/option loading
- `setSectionOrder()` to configure navigation section order
- `initModules()` accepts external module imports and core nav items

### Changed
- Module registry is now fully configurable (no hardcoded imports)
- Navigation auto-builds from module declarations (registry.addNavItem)
- Branding comes from bootstrap config (createQdadm app option)
- Dashboard now uses qdadm AppLayout instead of local implementation

### Removed
- Hardcoded import.meta.glob in moduleRegistry
- Hardcoded sectionOrder in moduleRegistry

## [0.2.0] - 2025-12-20

### Added
- README.md with quick start guide
- TODO.md for planned features
- docs/FRAMEWORK.md moved from dashboard

### Changed
- Successfully integrated with Faketual dashboard
- All 60+ dashboard modules migrated to use qdadm imports
- Validated build and runtime functionality

### Fixed
- Component import paths (PageHeader, CardsGrid, ListPage)
- useJsonSyntax import paths in editor components
- Theme CSS import path in styles/index.css

## [0.1.0] - 2025-12-20

### Added
- Initial extraction from Faketual dashboard
- `createQdadm` plugin for Vue 3 bootstrap
- **Adapters**:
  - `ApiAdapter` interface for CRUD operations
  - `AuthAdapter` interface for authentication (optional)
- **Composables**:
  - `useForm` - Form state management with validation
  - `useListPageBuilder` - Paginated list with filters and actions
  - `useBareForm` - Minimal form without routing
  - `useBreadcrumb` - Breadcrumb builder
  - `useDirtyState` - Track unsaved changes
  - `useEntityTitle` - Dynamic page titles
  - `useJsonSyntax` - JSON validation helpers
  - `usePageBuilder` - Generic page builder
  - `useSubEditor` - Sub-component for complex forms
  - `useTabSync` - Sync tabs with URL
  - `useUnsavedChangesGuard` - Block navigation if dirty
  - `useAuth` - Authentication access
  - `useApp` - App branding access
- **Components**:
  - Layout: `PageLayout`, `PageHeader`, `Breadcrumb`
  - Forms: `FormField`, `FormActions`, `FormTabs`, `FormTab`
  - Lists: `ListPage`, `ActionButtons`, `ActionColumn`, `FilterBar`
  - Editors: `KeyValueEditor`, `LanguageEditor`, `ScopeEditor`, `VanillaJsonEditor`, `JsonEditorFoldable`, `JsonStructuredField`, `JsonViewer`
  - Dialogs: `SimpleDialog`, `MultiStepDialog`, `BulkStatusDialog`, `UnsavedChangesDialog`
  - Display: `CardsGrid`, `RichCardsGrid`, `CopyableId`, `EmptyState`, `IntensityBar`
  - Auth: `LoginPage`, `AuthGuard`, `ScopeGuard`
- **Module System**:
  - `moduleRegistry` for auto-discovery of modules
  - Route registration with path prefix
  - Navigation item registration
  - Route family for active state detection
- **Configuration**:
  - `app` config for branding (name, logo, version, theme)
  - `features` toggles (auth, scopes)
  - `builtinModules` for users/roles
  - `endpoints` configuration
