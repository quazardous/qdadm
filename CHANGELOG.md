# Changelog

All notable changes to qdadm will be documented in this file.
This is not a commit log. Keep entries simple, user-focused.

## [1.1.6] - 2026-02-02

### Added
- **ShowPage system**: New `useEntityItemShowPage` composable for read-only detail pages (mirrors `useEntityItemFormPage` API)
- **ShowPage components**: `ShowPage`, `ShowField`, `ShowDisplay` for building detail pages
- **Display widgets**: Auto-mapping by field type (text, email, number, currency, boolean, date, datetime, select, textarea, reference, url, image, json, badge)
- **Media zone**: Optional `#media` slot in ShowPage for images, avatars, flags with responsive grid layout

### Demo
- Converted detail pages to use ShowPage: `ProductShowPage`, `PostShowPage`, `JpUserShowPage`, `CountryShowPage`

## [1.1.5] - 2026-02-02

### Changed
- **Default item route detection**: `getDefaultItemRoute` now checks for existing routes before returning

## [1.1.3] - 2026-01-21

### Fixed
- **Sidebar header home route**: Now uses injectable `qdadmHomeRoute` instead of hardcoded `'home'`

## [1.1.2] - 2026-01-21

### Fixed
- **Sidebar nav icon animation**: Icons now stay centered during collapse animation (moved to `_sidebar.scss` with absolute positioning)

## [1.1.1] - 2026-01-21

### Added
- **Global cache TTL**: New `defaultEntityCacheTtlMs` Kernel option to set default cache TTL for all entities
- **LocalStorageSessionAuthAdapter config**: Now accepts config object with `storageKey` option, plus static `defaults`

### Fixed
- **Debug panel TTL display**: Shows "X left" for remaining time instead of duplicating TTL value
- **Kernel options propagation**: Fixed `defaultEntityCacheTtlMs` not being passed to EntityManager (via `orchestrator.kernelOptions`)

### Demo
- **Default cache TTL**: Demo now uses 5 minutes default cache TTL

## [1.1.0] - 2026-01-12

### Breaking Changes
- **Renamed `createLocalStorageRoleGranter` to `createLocalStorageRolesProvider`**
- **Renamed type interfaces**: `StaticRoleGranterConfig` → `StaticRolesProviderConfig`, `EntityRoleGranterOptions` → `EntityRolesProviderOptions`, etc.
- **Renamed `roleGranter` config property to `rolesProvider`** in Kernel security options

### Added
- **Clickable footer logo**: "Powered by qdadm" footer now links to GitHub repository

### Fixed
- **Products menu highlighting**: Added `entity` property to navItem for proper active state detection
- **Debug SignalsPanel filter**: Replaced PrimeVue InputText with native input for consistent styling

### Documentation
- **README rewrite**: More punchy, TypeScript-first messaging
- **Updated docs**: AGENT_GUIDE, security.md, QDADM_CREDO updated with new naming

## [1.0.0] - 2026-01-12

### Breaking Changes
- **Full TypeScript migration**: All source files converted to TypeScript with strict mode
- **Type exports**: All public types are now exported from main entry point

### Added
- **TypeScript support**: Complete TypeScript conversion with proper type annotations
- **ESLint + Prettier**: Code quality tooling with TypeScript-aware rules
- **Type declarations**: `vite-env.d.ts` for asset imports (SVG, etc.)
- **Strict mode**: TypeScript strict mode enabled for better type safety

### Changed
- All 64 Vue components now use `<script setup lang="ts">`
- All composables, utilities, and modules converted to `.ts`
- PrimeVue component props properly typed
- Route params use `RouteParamsRawGeneric` for vue-router compatibility

### Technical
- 1806 tests passing
- `vue-tsc --noEmit` type-check passes
- 0 ESLint errors (warnings only for style preferences)

## [0.59.5] - 2026-01-12

- **Centralized auth invalidation**: Kernel remounts entire app on auth signals (`auth:login`, `auth:logout`, `auth:impersonate`, `auth:impersonate:stop`). Composables no longer need individual signal listeners.
- **Kernel.invalidateApp()**: New method to force app remount via key-changing technique. Used internally by auth signal handlers.
- **Simplified composables**: Removed auth signal listeners from `useAuth`, `useNavigation`, `useUserImpersonator`. Fresh state is guaranteed by app remount.

## [0.59.4] - 2026-01-12

- **useUserImpersonator composable**: Reusable composable for user impersonation in admin dashboards. Supports entity-based or direct users list, configurable ID/label fields, and permission checks.
- **Permission-based access for RolesManager/UsersManager**: Replaced `canPersist` logic with proper permission checks (`security:roles:manage`, `security:users:manage`). Permissions are dynamically registered by SecurityModule.
- **adminPermission option**: Both managers accept `adminPermission` option to customize the required permission.

## [0.59.3] - 2026-01-12

- **Access denied toast**: Route guard shows visible error toast when access is denied (not just console log)
- **Kernel entity permissions**: Kernel route guard now checks entity `canRead()` (was only checking authentication)
- **Auth signal**: Emits `auth:access-denied` signal for custom error handling
- **Menu refresh on auth**: Navigation re-filters on `auth:impersonate`, `auth:login`, `auth:logout` signals
- **Debug warning**: Warning when `crud()` called without entity registration (helps diagnose nav filtering)

## [0.59.2] - 2026-01-11

- **Mobile responsive**: Filter bar wraps on mobile, card container invisible
- **Mobile header actions**: SplitButton replaces individual buttons (primary action + dropdown)
- **SplitButton outlined style**: Consistent thin border styling with severity variants

## [0.59.1] - 2026-01-11

- **Debug bar mobile fix**: Hide per-tab pause/clear buttons on mobile
- **Debug bar badges**: Fix badge overflow clipping on mobile mini menu

## [0.59.0] - 2026-01-11

- **Mobile row tap**: Tap on a table row navigates to edit/show page (based on declared routes)
- **Route-based action detection**: `getPrimaryRowAction()` checks if `-edit` or `-show` routes exist
- **Smart click handling**: Ignores taps on buttons, links, and interactive elements

## [0.58.0] - 2026-01-11

- **Session loss detection**: Kernel detects session loss and emits `auth:session-lost` signal with toast warning
- **Destroy Session button**: Debug bar Auth panel button to simulate token loss
- **Global Toast**: Kernel injects Toast/ToastListener at root level - works on all pages including login
- **Toast helper**: `orchestrator.toast.success/error/warn/info(summary, detail, emitter)` with configurable defaults
- **Configurable toast life**: `createKernel({ toast: { success: 2000, error: 8000 } })`
- **Debug panel toolbars**: Unified styling with `.debug-panel-toolbar` classes
- **Breaking**: Apps must remove `<Toast />` from layouts (Kernel provides it globally)

## [0.57.0] - 2026-01-11

- **InfoBanner component**: Unified message banner with severity support (info, success, warn, error)
- **useInfoBanner composable**: Programmatic banner management with BannerZone renderer
- **SCSS reorganization**: Split _main.scss into focused partials (_forms, _stats, _states, _lists, _filter-bar, _helpers)
- **Debug bar mobile**: Fullscreen mode with vertical mini menu on mobile devices

## [0.56.0] - 2026-01-11

- **Collapsible sidebar**: Mini icon-only mode for desktop/tablet with persistent state
- **Mobile fullscreen menu**: Sidebar opens as fullscreen overlay on mobile (100vw, 100dvh)
- **Powered by link**: qdadm text now links to GitHub repository

## [0.55.0] - 2026-01-11

- **Debug bar refactor**: Put debug bar outside main codebase

## [0.54.0] - 2026-01-11

- **Navigation stack refactored**: Better separation between sync and async layers
- **Breadcrumb labels**: Now display correctly for nested routes
- **Code generation**: Auto-detect ID field from OpenAPI, support class generation mode
- **Field defaults**: Support dynamic defaults based on parent context
- **Storage routing**: Dynamic endpoints and default query params support

## [0.52.0] - 2026-01-10

- **Navigation stack system**: Centralized management of entity hierarchy in routes
- **Breadcrumb improvements**: Auto-display entity labels on detail pages
- **Form navigation**: After create, navigate to edit page instead of reset
- **Navlinks**: Only show list routes as tabs, not create/edit/show pages

## [0.49.0] - 2026-01-09

- **Child entity navigation**: Detail pages show links to related entities
- **Entity item pages**: New composable for single entity detail pages
- **Pluralization**: Proper English singular/plural handling (countries → country)

## [0.47.0] - 2026-01-06

- **Form inputs**: Auto-render appropriate input based on field type
- **Reference fields**: Auto-load dropdown options from related entities
- **Filters**: Support callback for custom option display format
- **Debug panel**: Show field references between entities
- **Hash mode routing**: Support for static hosting (GitHub Pages)
- **Semantic breadcrumb**: Single source of truth for navigation
- **404 page**: Default not-found page component

## [0.38.0] - 2026-01-05

- **Security module**: Built-in role and user management UI
- **Permission system**: Wildcard-based permissions with module registration
- **Role management**: Create/edit roles with visual permission picker
- **Auth adapters**: Session-based authentication with localStorage support
- **Single form pattern**: Unified create/edit form component
- **Module template**: Copy-ready scaffold for new modules

## [0.32.0] - 2026-01-03

- **Multi-source auth**: Route permissions to different auth backends
- **Module system v2**: Class-based modules with lifecycle hooks
- **Debug system**: Comprehensive debugging infrastructure with panels
- **Toast notifications**: Signal-based toast system

## [0.30.0] - 2026-01-01

- **Token expiration**: Auto-logout on 401/403 API responses
- **JSON editor**: Moved to optional subpath export (reduces bundle size)

## [0.29.0] - 2025-12-31

- **Code generation**: Generate EntityManagers from OpenAPI schemas
- **Event routing**: Declarative signal routing for cross-cutting concerns
- **Deferred registry**: Async service coordination with named promises
- **Login page**: Generic customizable login component
- **SSE composable**: Server-Sent Events with auto-reconnect
- **Responsive layout**: Mobile-first design with sidebar drawer

## [0.26.0] - 2025-12-30

- **Smart filters**: Auto-load options from entities, endpoints, or cache
- **Search persistence**: Search query saved to session
- **Auto-cache**: Automatic caching for small datasets
- **Query executor**: MongoDB-like local filtering

## [0.19.0] - 2025-12-29

- **Filter options**: Automatic loading from entities or API
- **Cache-based filters**: Extract unique values from loaded items

## [0.18.0] - 2025-12-28

- **Module system**: Zones, signals, and hooks passed to module init
- **Extension docs**: Separate documentation for zones, signals, hooks
- **Legacy cleanup**: Removed unused composables

## [0.16.0] - 2025-12-21

- **Navigation context**: Route-aware breadcrumb and navlinks
- **Child routes**: Navigate to filtered child entity lists
- **Permissions**: Fine-grained create/update/delete checks
- **Route guards**: Auto-redirect based on permissions
- **Batch fetch**: Get multiple entities by IDs
- **Local filtering**: Custom filter callbacks

## [0.7.0] - 2025-12-20

- **Kernel**: All-in-one bootstrap class
- **AppLayout**: Auto-nav from module registry
- **Entity labels**: Display labels from EntityManager
- **Unsaved changes**: Automatic dialog on navigation

## [0.1.0] - 2025-12-20

- Initial release
- EntityManager with CRUD and permissions
- Storage adapters (API, localStorage)
- Composables: useForm, useListPageBuilder
- Components: ListPage, FormField, AppLayout
- Module system with auto-discovery
