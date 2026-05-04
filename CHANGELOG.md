# Changelog

All notable changes to qdadm will be documented in this file.
This is not a commit log. Keep entries simple, user-focused.

## qdadm-demo [0.22.0] - 2026-05-04

### Added — `/todos` toggles persist in localStorage (demo hack)

- The `completed` checkbox on `/todos` now survives reloads, pagination, filters, and tab switches. Demo-only quality-of-life: JSONPlaceholder accepts PATCH but never persists, so a `TodosLocalOverlayStorage` wrapper stores user patches under `qdadm-demo:todos:patches` in localStorage and re-applies them on every `list()` / `get()` before filter/sort. Reset by clearing the key in DevTools. See the big comment block at the top of `JsonPlaceholderModule.js`

## [1.19.0] - 2026-05-04

### Changed — `@quazardous/qdcore` 0.1.0 → 0.2.0 (BREAKING)

- **Removed `entity`, `plugin`, `migration`, `sql` subpath exports.** They were briefly added in qdcore (Phase 1a/1b — commits `12a1c6e` and `eb37ae0`) under the "shared primitives" reasoning but in practice are qdcms-centric. They've moved to a new `@quazardous/qdcms-core` package in the qdcms repo. Consumers that imported `@quazardous/qdcore/{entity,plugin,migration,sql}` should switch to `@quazardous/qdcms-core/{entity,plugin,migration,sql}`. qdadm itself never consumed these — no internal impact.
- **Removed dependencies**: `@mikro-orm/core`, `@mikro-orm/sqlite`, `@mikro-orm/migrations`, `better-sqlite3`, `semver`, `@types/semver`. They moved to qdcms-core. qdcore is back to a single dependency (`@quazardous/quarkernel`).

### Kept in qdcore
SignalBus, Stack, i18n, hooks, events, SSE — the truly cross-app primitives that BOTH qdadm and qdcms use today.

## [1.18.1] - 2026-05-04

### Fixed
- **Debug Router panel: active stack label stayed stuck on the previous entity's value after navigating** to another entity (`/users/<id>/edit` showing `june` after switching to admin). The panel only re-rendered on `afterEach` (a new navigation entry), but `StackHydrator` finishes its async fetch *after* the navigation and the panel never noticed. `RouterCollector` now subscribes to `stack:change` + `stack:hydrated` and calls `notifyChange()` so the label refreshes once the entity is hydrated
- **Debug Router panel: breadcrumb section was rendered with elements centred at ~1/3 width** instead of full-width. Conflict with the global `.breadcrumb-list` rule from `styles/_main.scss` (AppLayout breadcrumb: `align-items: center`, gap, list-style…) which overrode the debug rule. Namespaced every `.breadcrumb-*` rule in the debug stylesheet under `.router-panel`

## [1.18.0] - 2026-05-04

### Added — i18n: lazy YAML defaults + incremental domain loading

- **Default core bundles ship as YAML, lazy-loaded.** `core.en.yml` and `core.fr.yml` replace the inline TypeScript files. They're fetched on demand via `?raw` + the `yaml` parser, so an app that uses only one locale doesn't pay the JS-bundle cost of the others. Adds `yaml@^2` as a direct qdadm dependency. French is now shipped by the framework — no more duplicated `core.actions.*` block in the demo `BooksModule.js`
- **`LazyTranslationProvider`** — generic, format-agnostic provider that runs a cascade of `(locale) => Promise<bundle | null>` loaders and deep-merges their partial bundles (last-merge-wins). Lets apps split a locale across multiple files (one per domain, e.g. `core` / `shop` / `legal`) without coupling the provider to any specific transport
- **`IncrementalDomainProvider`** — declares one loader per top-level translation domain and loads each `(locale, domain)` pair only when requested. `t('shop.cart.title')` on an unloaded domain returns the raw key synchronously, kicks off a background load, then emits `i18n:domain-loaded { locale, domain }` once merged. `eagerDomains` for boot-critical domains; `i18n.loadDomain(domain)` for explicit pre-warming. Inflight loads are deduped per `(locale, domain)`. The host app subscribes to `i18n:domain-loaded` if it wants to react to the late arrival
- **`createYamlLoader`** helper — wraps a `locale → () => import('./xx.yml?raw')` map into a `LazyLoader` for use in either provider above
- **`isDomainAwareProvider`** type guard — used by `I18n.t()` to recover from misses without coupling the I18n class to the new provider type

### Changed
- Demo `BooksModule.js` no longer overrides `core.actions.*` in French — those defaults now ship from `core.fr.yml`

## [1.17.0] - 2026-05-01

### Changed — `@quazardous/qddebug` 0.1.0 → 0.2.0
- **Dropped the PrimeVue peer dependency.** The DebugBar now ships native HTML buttons + badges with scoped CSS, so the debug panel can be reused in apps that don't run PrimeVue (notably qdcms). PrimeIcons (`pi-*` class names) are still referenced as visual hints and rendered as glyphs when the consumer loads PrimeIcons CSS — otherwise buttons stay functional via `title` attributes.
- **Tab badge now overlays the icon** (small red bubble at the top-right corner) in every display mode, no longer relying on consumer CSS to position itself.
- Loose duck-typed `Collector` / `DebugBridge` interfaces in `DebugBar.vue` no longer carry an index signature, so the real classes from `@quazardous/qddebug/bridge` are accepted as props without casts.
- qdadm `modules/debug/styles.scss` updated: `.p-badge` → `.qd-badge` to match the new native badge class.

### Fixed
- **DebugBar tests** updated to query the new native HTML structure (badge text content + child icon class) instead of the removed PrimeVue mock attributes.

## [1.16.2] - 2026-05-01

### Fixed
- **Demo `LocaleSwitcher` hides in compact sidebar mode**: switcher was always rendered with its own padding-only wrapper, so it stayed visible when the sidebar collapsed. Refactored to use the `SidebarBox` component with the `#full` slot — same pattern as `UserImpersonator` — so it picks up the existing `.sidebar--collapsed .sidebar-box--full` rule for free. Also adds a "LANGUAGE" label for visual consistency with the other footer boxes (USER, IMPERSONATE)

## [1.16.1] - 2026-05-01

### Fixed
- **Demo pagination on `/posts`, `/jp_users`, `/todos`**: JSONPlaceholder ignores `?page` / `?page_size` and returns the full collection on every request, so cycling pages or filtering by author kept showing the same 10 items. Added a small `JsonPlaceholderStorage` subclass that fetches once and slices/filters/sorts client-side, mirroring the `RestCountriesStorage` pattern already used for `/countries`

### Chore
- Tighten `.gitignore` to catch stray codegen runs launched from the repo root instead of the package

## [1.16.0] - 2026-05-01

### Added — `@quazardous/qdcore/i18n` (extraction)
- **`MessagesRegistry`, `Resolver`, `InlineTranslationProvider`, strategies, types** moved from `qdadm/i18n/` into `@quazardous/qdcore/i18n`. qdadm files are now thin re-export shims; the public API surface is unchanged
- **`I18N_SIGNALS`** (new) — signal name constants (`LOCALE_CHANGE`, `LOCALE_CHANGED`, `I18N_MISSING`) shared with qdcms via `@quazardous/qdcore`. Lets a vue-i18n-based qdcms talk to qdadm i18n through the SignalBus with a one-line bridge
- **`BaseI18nOptions`** (new) — generic shape that qdadm extends with the admin-only `disableDefaultCoreBundle` flag (declared in `qdadm/i18n/types.ts`)
- **`./i18n` subpath export** added to `@quazardous/qdcore/package.json`

### Changed — qdadm internals
- `qdadm/i18n/I18n.ts` now imports its primitives from `@quazardous/qdcore` instead of local files. The qdadm orchestrator (`I18n` class), `useI18n()` composable, and `defaults/core.en.ts` admin bundle stay in qdadm — they're admin-flavoured and not relevant to qdcms
- `qdadm/i18n/{types,MessagesRegistry,Resolver,InlineTranslationProvider,strategies}.ts` reduced to re-export shims

### Fixed
- **vue-tsc resolution of quarkernel 2.3 types in workspace symlinks**: `vue-tsc` couldn't resolve `Kernel` / `ListenerFunction` from `@quazardous/quarkernel` when reaching them through the `qdcore` workspace symlink (the bundled `.d.ts` chain `a as Kernel` / `l as ListenerFunction` confused vue-tsc but not `tsc`). Replaced the public-typed imports with locally-defined structural interfaces inside `qdcore/signal/SignalBus.ts` and `qdcore/hook/HookRegistry.ts`. Runtime behaviour unchanged

## [1.15.0] - 2026-05-01

### Added — `@quazardous/qdcore` (new package)
- **`signal/`**: generic `SignalBus` (was `qdadm/kernel/SignalBus`). Framework-agnostic, no qdadm-specific signal registry. `once()` supports both callback-style (subscribe + unbind) and Promise-style (resolves on first emission, optional timeout)
- **`hook/`**: `HookRegistry` (Drupal-style hooks: lifecycle `invoke()` + chained `alter()`)
- **`event/`**: `EventRouter` (declarative signal routing). `RouteContext` is now extensible via index signature + new `context` constructor option for arbitrary extras
- **`sse/`**: `SSEBridge` with configurable `connectOnSignal` / `disconnectOnSignal` (defaults remain `auth:login` / `auth:logout`)
- **`stack/`**: generic `Stack<L>` + `ContentStackLevel` + `StackBuilder<L>` + `Hydrator<L>` interfaces — extracted as the canonical stack abstraction shared with qdcms

### Added — `@quazardous/qddebug` (new package)
- **`bridge/`**: `Collector` base class, `DebugBridge` aggregator, `LocalStorageAdapter`
- **`collectors/`**: generic collectors `SignalCollector`, `ErrorCollector`, `ToastCollector`, `I18nCollector`
- **`components/`**: panel-pluggable `DebugBar` (new `panels` and `collectorMeta` props let consumers register their own panels and tab metadata), `ObjectTree`, generic panels (`EntriesPanel`, `SignalsPanel`, `ToastsPanel`)

### Changed — qdadm internals
- **`SignalBus`, `HookRegistry`, `EventRouter`, `SSEBridge`** now live in `@quazardous/qdcore`. qdadm files in `kernel/` and `hooks/` are thin re-export shims; the public API surface is unchanged
- **`ActiveStack`** rewritten as a composition over `Stack<EntityStackLevel>` from qdcore. `EntityStackLevel extends ContentStackLevel` and dual-carries `name` + `entity` so existing readers (`level.entity`) keep working unchanged. `StackHydrator` now formally implements qdcore's `Hydrator<EntityStackLevel, HydratedLevel>` interface
- **`DebugBridge`, `Collector`, generic collectors and UI** now live in `@quazardous/qddebug`. qdadm `modules/debug/` files are re-export shims; the public API is unchanged
- **`DebugBar`** in qdadm becomes a thin wrapper that injects qdadm's admin panels (auth, entities, router, zones, i18n) and tab metadata into the qddebug bar via the new `panels` / `collectorMeta` props
- **`EventRouter`**: dropped the unused `orchestrator` constructor option (was never read by any registered callback). Consumers needing extras can pass them via the new generic `context` option

### Fixed
- **quarkernel 2.3 type renames**: `QuarKernel` → `Kernel`, `ListenerCallback` → `ListenerFunction` — previously masked by `skipLibCheck` in qdadm
- **`once()` against quarkernel 2.3**: the legacy callback-style was silently broken (2.3 reused `once()` for the Promise-returning variant). qdcore's `SignalBus.once()` overload now routes correctly to `on(..., { once: true })` for callbacks and to the kernel's Promise-based `once()` otherwise

## [1.14.0] - 2026-04-30

### Added — i18n subsystem
- **i18n core**: `kernel.i18n` orchestrator with reactive locale, schema-derived keys (`entities.{entity}.fields.{name}`, `core.actions.*`, `nav.*`), `_label` shorthand, value-level `@key` aliases (with `@@` escape), wildcard pattern aliases (`*` + `$1`/`$2` captures), and key-strategy presets (`global`, `module`, `entity`)
- **`TranslationProvider` interface**: pluggable `name`, `load(locale)`, optional `availableLocales`/`save`/`watch`. Built-in `InlineTranslationProvider` backs `ctx.messages(locale, bundle)`
- **Module API**: `ctx.messages(locale, bundle)`, `ctx.aliases([...])`, `ctx.messagesProvider(p)`, plus auto entity→module tracking for module-scoped key strategies
- **`useI18n()` composable**: `{ t, locale, i18n }` with no-op shim outside a kernel
- **Composables wired**: `useFieldManager`, `useListPage`, `useNavigation` resolve labels via i18n and re-render on locale change (no template churn)
- **Components migrated**: `FormActions`, `LookupPickerDialog` use `t('core.actions.update')` etc. — apps not opting into i18n keep their inline labels via fallback
- **Default `core.*` bundle (en)**: actions, fields, messages, errors, tooltips, placeholders
- **Locale switching via signal bus**: emit `locale:change` on the bus → kernel switches locale and re-resolves
- **Documentation**: `docs/i18n.md` (usage + recipes), `docs/todo-i18n.md` (open questions tracker)

### Added — Debug HTTP API for agents
- **Self-describing collector contract**: every `Collector` exposes `describe()` (manifest with entry shape + actions), `snapshot()` (JSON-clean state), and `call(action, args)` with universal verbs `clear`/`markSeen`/`getEntries`
- **`DebugBridge.dump()` / `describe()` / `call()`**: aggregate JSON surface across all collectors
- **Vite dev plugin `qdadm/vite-plugin-debug`**: serves `/__qdadm/{describe,snapshot,call,sessions}.json` as a true HTTP API. Per-tab session keying (uuid), push+cache via Vite's HMR socket, `X-Qdadm-{Source,Stale-Ms,Session}` response headers, configurable session TTL
- **Per-collector actions**: `signals.{emit,getByDomain,getByPattern}`, `entities.{refreshCache,invalidateCache,testFetch,testStorageFetch}`, `router.{navigate,getCurrentRoute,getRoutes,getBreadcrumb}`, `i18n.{resolve,translate,dumpBundle,changeLocale,asJsonSkeleton,byNamespace,getLocaleHistory,availableLocales}`, `zones.{highlight,clearHighlights,setShowCurrentPageOnly,setShowInternalZones}`, `toasts.getBySeverity`
- **`I18nCollector`**: deduplicating buffer for `i18n:missing` (count, firstSeen, lastSeen) plus locale-change history; powers a dedicated `I18nPanel` (state, resolve, missing, coverage matrix, bundle download)
- **Signals panel filter**: i18n preset (`'i18n:** locale:**'`) and multi-pattern whitespace alternatives
- **`AGENTS.md` at repo root**: documents the API, recipes, custom-collector authoring

### Changed
- **`window.__qdadm` unified**: single `debug` namespace exposing `{describe, dump, call, bridge}`. Drops the duplicate `window.__qdadmZones` (already in `ZonesCollector`) and the legacy `window.__debug` `DebugInjector`
- **DebugBar**: new I18n tab (globe icon) alongside existing collectors

### Removed
- **`utils/debugInjector.ts`** (`window.__debug`): unused PrimeVue probing utility, superseded by the new bridge surface

## [1.13.1] - 2026-04-21

### Changed
- **Peer dep `pinia` elargi** : `^2.0.0 || ^3.0.0` (avant: `^2.0.0` strict) — permet l'usage avec pinia 3.x (ex. skybot) sans `--legacy-peer-deps`

## [1.13.0] - 2026-04-21

### Added
- **`JsonStructuredField` invalid-JSON guard**: New `guardInvalidJson` prop (default `true`) blocks switching from JSON to structured view while the raw JSON is invalid, preventing silent data loss on toggle
- **`invalidJsonMessage` prop**: Customizable error banner text shown when JSON is invalid (default: `Invalid JSON — fix errors before switching views`)
- **`json-error` event**: Emitted with `true` when JSON becomes invalid, `false` when valid again — lets parents react to validity changes

## [1.12.0] - 2026-03-04

### Added
- **Generic typing on interfaces and composables**: `EntityManagerBase<T>`, `EntityManagerRead<T>`, `EntityManagerCrud<T>`, `useEntityItemPage<T>()`, `useEntityItemShowPage<T>()`, `useEntityItemFormPage<T>()`, `useListPage<T>()` — all default to `unknown` for full backward compatibility
- **TypeScript manager generation**: `generateManagers` now outputs `.ts` files with auto-generated entity interfaces from field schemas and typed `EntityManager<XxxEntity>` instances
- **`fieldTypeToTsType()` and `generateEntityInterface()` helpers**: Exported from `qdadm/gen` for custom generation workflows

### Changed
- **Demo modules use `static moduleName`**: All demo/hello-world modules standardized from `static name` to `static moduleName` for consistency with framework modules

## [1.11.1] - 2026-02-17

### Added
- **`detailCacheMaxSize` option**: Limit the number of items in the detail cache (0=unlimited, >0=max items); oldest entries (by `loadedAt`) are evicted when the limit is exceeded
- **Debug panel**: Detail cache row now shows `size/maxSize` when a limit is configured

## [1.11.0] - 2026-02-17

### Added
- **Asymmetric entity mode**: New `asymmetric` option on EntityManager for APIs where `list()` returns summaries and `get()` returns full details; `get()` bypasses the list cache entirely
- **Detail cache**: Optional per-item cache for asymmetric entities with configurable TTL (`detailCacheTtlMs`: 0=disabled, -1=infinite, >0=ms); includes per-entry expiration and stats tracking (`detailCacheHits`/`detailCacheMisses`)
- **Concurrent get() deduplication**: `_detailInflight` Map prevents duplicate network requests when multiple callers request the same entity ID simultaneously (e.g., StackHydrator + useEntityItemPage)
- **`invalidateDetailCache()` method**: Clear only the detail cache without affecting the list cache
- **Signal-based detail cache invalidation**: `entity:data-invalidate` signal automatically clears the detail cache for the targeted entity
- **`asymmetric` storage capability**: Storages can declare `asymmetric: true` in their capabilities as a fallback when the EntityManager option is not set
- **Debug panel**: Asymmetric entity badge (purple icon), detail cache size/TTL display, detail cache hit/miss stats in EntitiesPanel
- **Asymmetric mode tests**: 22 tests covering configuration, cache behavior, TTL, invalidation, deduplication, getMany, and non-regression

### Documentation
- **README rewrite**: Updated all code snippets to match current API (`EntityManager`, `MockApiStorage`, hooks, signals, Kernel init)
- **Tutorial**: New step-by-step guide (`docs/tutorial-mini-admin.md`) for building a parent-child admin

### Demo
- **Countries module**: Enabled asymmetric mode (`asymmetric: true`, `localFilterThreshold: 300`, `detailCacheTtlMs: 300000`) to showcase list/detail cache separation

## [1.10.4] - 2026-02-13

### Changed
- **EntityManager prototype patching**: Replace ~250 lines of delegation boilerplate with prototype patching via `applyCacheMethods()`, `applyQueryMethods()`, `applyRelationsMethods()`, `applyCrudMethods()`; TypeScript interface merging provides type safety; add `EntityManagerInternal<T>` utility type for internal access

## [1.10.0] - 2026-02-13

### Added
- **`pathSegment` CRUD option**: Override the URL path segment for entities (e.g., `pathSegment: 'tasks'` for a `jobTasks` entity); defaults to kebab-case of entity name
- **Child entity CRUD in demo**: Genres as child of books, user posts/todos in JsonPlaceholder module

### Changed
- **CSS centralization**: Extracted reusable styles from 13 Vue components into SCSS partials (`_cards.scss` new, `_states.scss`, `_code.scss`, `_forms.scss`, `_alerts.scss`, `_show-pages.scss`, `_main.scss`, `_dialogs.scss` extended); added scoping warning comment to remaining `<style scoped>` blocks
- **Route path generation**: Entity routes now use kebab-case paths by default (e.g., `botTasks` → `/bot-tasks`)
- **Breadcrumb deduplication fix**: Skip parent ID param when already consumed by an ancestor level in breadcrumb builder
- **Entity cache bypass**: Disable list cache when `resolveStorage` provides an endpoint override (prevents stale data across parent contexts)
- **Docs relocated**: Moved documentation from `packages/qdadm/docs/` to root `docs/`

### Demo
- **Genres module merged into BooksModule**: Genres entity now registered inside BooksModule with child book routes instead of standalone module
- **JsonPlaceholder child routes**: User posts and user todos as child CRUD pages

## [1.9.0] - 2026-02-13

### Added
- **`SeverityDescriptor` type**: Rich severity descriptors with optional `icon` and `label` fields alongside the severity string
- **`getSeverityDescriptor()` on EntityManager**: Returns full descriptor (severity + icon + label) for a field value
- **Icon support in `SeverityTag`**: Renders rich badges with icons (including animated spinners) when the severity map provides a descriptor with an `icon` field
- **Icon support in `ShowDisplay` badge**: Badge display type now renders icons from severity descriptors

### Changed
- **Severity maps accept descriptors**: `setSeverityMap()` values can now be plain strings (backward compat) or `SeverityDescriptor` objects
- **Exported types**: `SeverityDescriptor`, `SeverityMapValue`, `SeverityMap` exported from main entry point

## [1.8.0] - 2026-02-13

### Added
- **Severity maps on EntityManager**: `setSeverityMap(field, map)` to define severity-by-value at entity level instead of per-page
- **`SeverityTag` component**: Reusable tag that resolves severity from the entity manager's severity map
- **Auto-severity in ShowPage**: Fields with a severity map auto-promote from `text` to `badge` display type and inject severity callback

### Changed
- **EntityManager interface**: Added optional `hasSeverityMap()` and `getSeverity()` methods

### Demo
- **BookList**: Replaced manual `getGenreSeverity()` with `SeverityTag` component
- **CountriesModule**: Severity map for `region` field defined via `setSeverityMap()` instead of inline callback in ShowPage

## [1.7.0] - 2026-02-11

### Added
- **`useSidebarState()` composable**: Inject sidebar collapsed ref from any component via `provide/inject` (exported from qdadm index)
- **`SIDEBAR_COLLAPSED_KEY`**: Injection key symbol, provided by `AppLayout` automatically

### Changed
- **Notification status zone**: No longer hidden when sidebar collapses — zone stays visible, text fades via `.status-label` class (matching SidebarBox pattern)
- **AppLayout**: Provides `sidebarCollapsed` ref via `SIDEBAR_COLLAPSED_KEY` for zone block components

## [1.6.2] - 2026-02-11

### Fixed
- **Notification panel min-height**: Panel keeps a consistent minimum height whether empty or with status items

## [1.6.1] - 2026-02-11

### Changed
- **NotificationPanel redesign**: Removed dedicated header bar, replaced with floating inline toolbar (mark read, clear, close) positioned top-right
- **Flatter style**: Reduced border-radius to 2px, lighter shadows and separators for a modern look
- **Logo blink effect**: Alpha opacity blink with red tint instead of box-shadow glow, faster animation (1s cycle)
- **Mobile responsive**: Notification panel takes full width at bottom of screen on smartphone

### Fixed
- **Logo offset**: Zone wrapper uses `display: contents` to prevent sidebar logo displacement

## [1.6.0] - 2026-02-10

### Added
- **Notification panel**: Optional notification system that captures toast notifications into a persistent panel
- **`NotificationModule`**: New module that intercepts `toast:*` signals and stores them in a reactive notification store
- **`NotificationStore`**: Reactive store with `useNotifications()` composable for notifications and custom status items
- **`NotificationPanel`**: Sidebar-anchored panel displaying notification history and module status items (follows sidebar collapse, mobile overlay)
- **`NotificationBadge`**: Logo overlay with alpha blink effect when alerts are active
- **Status items**: Modules can register custom status items with severity, count, icon, and navigation link (e.g., "2 loans overdue")
- **`forceToast` option**: Signal toast data flag to force classic PrimeVue toast even when notification module is active
- **`notifications` kernel config**: Enable notification system via `Kernel({ notifications: { enabled: true } })`

### Demo
- **Overdue loans status**: LoansModule registers dynamic overdue loan count as notification status item with navigation link

### Fixed
- **Logout toast error**: Reordered `handleLogout()` to `router.push` before emitting `auth:logout` signal, preventing component remount on current route

## [1.5.0] - 2026-02-10

### Added
- **`ctx.childPage()` API**: Register custom non-entity child pages on entity items (e.g., a "Statistics" tab alongside CRUD child routes like Loans)
- **`useChildPage` composable**: Lightweight composable for child pages to access hydrated parent entity data, loading state, and parent manager
- **`ChildPageOptions` type**: Exported interface for `childPage()` options (`component`, `label`, `icon`, `meta`)

### Fixed
- **ActiveStack for child pages**: `_rebuildActiveStack()` now builds parent levels even when `meta.entity` is absent (non-entity child pages)
- **Semantic breadcrumb**: Flush pending entity ID before non-entity route segments (fixes missing parent item in breadcrumb)
- **NavLinks filter**: Include `layout === 'page'` routes in sibling navlinks (child page tabs appear alongside entity child routes)
- **Debug panel CSS leak**: Scoped `.entity-label` style under `.debug-panel` to prevent overriding PageHeader title on edit/show pages

### Demo
- **BookInfo page**: Demonstrates `ctx.childPage()` + `useChildPage()` with Info tab on book detail

## [1.4.0] - 2026-02-10

### Added
- **Lazy actions**: `addLazyAction()` on ShowPage for actions that resolve asynchronously after entity load (e.g., fetching permissions from a separate endpoint)
- **LazyActionConfig type**: Exported as `ShowLazyActionConfig`, with async `resolve()` returning `{ visible, disabled }`

## [1.3.0] - 2026-02-10

### Added
- **Entity badges**: New `badges` callback on `EntityManagerOptions` to compute badges for entity item headers
- **EntityBadge type**: Exported badge descriptor with `label` and `severity` properties
- **PageHeader badges**: Renders badges as PrimeVue `Tag` components next to entity title
- **ShowPage badges**: Passes badges from `useEntityItemShowPage` to `PageHeader`

### Demo
- **Countries badges**: Region displayed as colored badge on country detail page

## [1.2.0] - 2026-02-02

### Breaking Changes
- **Folder reorganization**: `/components/forms/` renamed to `/components/edit/`, new `/components/item/` for shared components
- **ShowGroups removed**: Use `FieldGroups` with `#field` slot instead

### Added
- **useFieldManager composable**: Shared field and group management for both form and show pages (DRY refactor)
- **FieldGroups component**: Generic slot-based group renderer with 5 layouts (flat, sections, cards, tabs, accordion)
- **Group tab/accordion options**: `icon`, `badge`, `badgeSeverity`, `count`, `visible`, `disabled` on groups
- **Field groups in forms**: `useEntityItemFormPage` now supports `group()` and `defineGroups()` methods

### Deprecated
- **FormTabs/FormTab**: Use `FieldGroups` with `layout="tabs"` instead

### Demo
- **JpUserShowPage**: Updated to use FieldGroups with tabs layout, icons and badges
- **BookForm**: Updated to use FieldGroups with accordion layout

## [1.1.7] - 2026-02-02

### Added
- **Field groups**: Hierarchical field organization with `group()` and `defineGroups()` methods in `useEntityItemShowPage`
- **ShowGroups component**: Renders grouped fields with configurable layouts (flat, sections, cards, tabs, accordion)
- **Nested groups**: Dot notation support for hierarchical groups (e.g., `info.basic`, `info.contact`)

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
