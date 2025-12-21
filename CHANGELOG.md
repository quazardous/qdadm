# Changelog

All notable changes to qdadm will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
