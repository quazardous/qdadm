# Changelog

## 2.13.0

### Minor Changes

- 910a7c2: Path-addressable dirty detection (#1396): `isFieldDirty('config.login')`
  tracks sub-fields of JSON objects like root fields — `FormField` accepts
  dot paths in `name` with zero changes, dot-free names keep the exact
  previous behavior. Kills the flatten-and-repack pattern for pages editing
  nested objects.
- d60b123: qdadmVitePlugin `primevue` flavor option (#1393): alias every `primevue/*`
  import to a compatible fork (e.g. `openvue`) from the consumer config —
  qdadm officially tests primevue@4 only, other flavors are the consumer's
  adaptation. `primevue` peer is now optional so flavor-only installs don't
  fight npm.

## 2.12.0

### Minor Changes

- d0ceb97: MockApiStorage accepts a `storageKey` option to override the default
  `mockapi_<entityName>_data` localStorage key — several apps sharing one
  origin (e.g. multiple demos on a GitHub Pages site) can now seed the same
  entity names without clobbering each other.

### Patch Changes

- 6798731: qdadmVitePlugin picks ONE CJS-transitive include form per install mode
  (nested for npm installs, plain for symlinked) instead of declaring both —
  kills the cosmetic "Failed to resolve dependency" optimizer warning
  (skybot testbed feedback).

## 2.11.0

### Minor Changes

- 35a3411: New `qdadmVitePlugin()` export at `@quazardous/qdadm/vite` (#1385)

  One line in the consumer's `vite.config.ts` replaces the hand-written
  `resolve.dedupe` + `optimizeDeps` block that npm-installed qdadm needed to
  avoid the dual-PrimeVue instance split (`Error: No PrimeVue Toast provided!`
  blank page in dev). Covers both the npm-install and `file:`/workspace-link
  scenarios. The package README's misleading claim that npm installs were
  unaffected is corrected.

### Patch Changes

- ad1069d: Published sources now pass a strict consumer typecheck out of the box (#1386)
  - Removed the write-only private fields and unused v-for alias that failed
    `noUnusedLocals` in consumer builds (create-vite vue-ts template flags),
    including `EntityRolesProvider._ctx` (caught once the smoke fixture gained
    the `/security` subpath import).
  - `@types/pluralize` moved into dependencies — consumers no longer shim it.
  - `@quazardous/qdadm/styles` gained a `types` exports condition + d.ts
    companion, so the side-effect import typechecks (was TS2882).
  - The consumer-smoke CI gate now runs with the vue-ts template's strict
    flags (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
    `erasableSyntaxOnly`) and no local shims, so this can't regress.

- 05edc80: DX polish pack from the onboarding audit (#1388)
  - SecurityChecker warns (once per role) when a user's role matches no
    configured role — the "role: admin instead of ROLE_ADMIN → silently zero
    permissions" trap is now debuggable.
  - Kernel warns at boot when `security` is configured without
    `entityAuthAdapter` (permission checks silently permissive).
  - No-auth apps no longer log `injection "authAdapter" not found` on every
    page (inject defaults in useAuth).
  - Number fields accept `useGrouping: false` to disable locale digit
    grouping in show displays (years render as 1965, not "1 965").
  - Sidebar user zone prettifies unmapped ROLE\_\* constants
    (ROLE_SUPER_USER → "Super User").
  - `examples/hello-world` rewritten on the canonical Kernel bootstrap
    (drops the legacy createQdadm path, toast stub and stale
    @primevue/themes import; dogfoods qdadmVitePlugin).
  - Sibling navlinks only forward the route params their target declares —
    silences vue-router's "Discarded invalid param(s)" warning on child
    item pages.

- 0fdb5e6: Shipped types now match the documented patterns — no more `as any` in a
  strict TS consumer (#1387)
  - `KernelOptions.authAdapter` accepts session-adapter subclasses (removed
    the index signature that rejected class instances).
  - `entityAuthAdapter` accepts the documented function form
    (`() => authAdapter.getUser()`).
  - `ChildConfig` gains `foreignKey` / `label` (the README parent-child shape).
  - `FormInput` accepts generated fields (`ResolvedFieldConfig`) and binds
    v-model over `Record<string, unknown>` indexes; `ShowField.value` accepts
    arbitrary values.
  - `useEntityItemShowPage` data defaults to `Record<string, unknown>`;
    `parentData` is a typed record (property access works).
  - The tutorial patterns are now a cast-free type-conformance fixture inside
    the consumer-smoke CI gate — docs and types can no longer drift apart.

## 2.10.0

### Minor Changes

- aa5c366: Support vue-router 5 and pinia 4 (#1384)
  - Peer ranges widened: `vue-router: ^4 || ^5`, `pinia: ^2 || ^3 || ^4` — a plain
    `npm install @quazardous/qdadm vue-router pinia` no longer hits ERESOLVE with
    npm's current latest. Compatibility verified end-to-end (build, routing, auth
    guard, child routes) against vue-router 5.2 / pinia 4.0.
  - Kernel auth guard migrated from the deprecated `next()` callback to
    return-style navigation guards (vue-router 4 compatible, silences the
    `VUE_ROUTER_R0025` deprecation on vue-router 5).
  - Sidebar version badge no longer renders a dangling `v` chip when
    `app.version` is not configured (#1382 audit).

## 2.9.0

### Minor Changes

- Navigation train: shared NavlinksGroup + breadcrumb fixes
  - New exported `NavlinksGroup` component (#1357): single rendering of the
    mode-links + navlinks group used by AppLayout's inline breadcrumb and
    DefaultBreadcrumb. Dedups navlinks whose target route a shown mode link
    already covers — the auto "Details" link no longer renders next to an
    identical "Edit" mode link on child pages. "Details" label now resolves
    through i18n (`breadcrumb.details`, fallback "Details").
  - Create pages keep their entity-list crumb (#1356): `/books/create` renders
    `Dashboard > Books > Create` (Books linked) instead of `Dashboard > Create`.
  - Package README doc links are absolute GitHub URLs so they work on
    npmjs.com; `repository.directory` added (#1358).

## 2.8.0

### Minor Changes

- e967100: Mode links on child-list pages (#1353): `useNavContext` gains `modeLinks` — the uniform list the breadcrumb components render at the end of the navlinks group. Item pages keep the single opposite-mode entry (unchanged behavior, `modeToggle` preserved for compatibility); child pages (routes with `meta.parent`) now surface the PARENT item's `View | Edit` pair, each under the same route-existence/`canUpdate`/i18n rules.

## 2.7.3

### Patch Changes

- 380e897: Sidebar select overlays no longer get painted over by the next sidebar box (#1352): every `.sidebar-box` is its own stacking context (`z-index: 1`), so an open overlay (`appendTo="self"`, z 1001) was trapped inside its box's context and later sibling boxes painted over it — the "transparent dropdown" symptom. `.sidebar-box:focus-within` now raises the whole box (`z-index: 20`) while its control is open.

## 2.7.2

### Patch Changes

- 1652d02: The breadcrumb View↔Edit toggle now renders in the right-side navlinks block (with the Details/child links) instead of trailing the breadcrumb, as a plain text link — no default icons (#1341 follow-up).

## 2.7.1

### Patch Changes

- 5733042: AppLayout's inline breadcrumb now renders the View↔Edit mode toggle (#1341): the `breadcrumbModeToggle` flag shipped in 2.7.0 was wired only in DefaultBreadcrumb, leaving it inert for AppLayout consumers — the default layout now honors the same opt-in contract.
- 5733042: Show field resolver crashed on canonical object-form references: `generateFields()` passed `reference: { entity }` straight to `orchestrator.get()`, throwing `No manager for entity "[object Object]"` and blanking the show page. The resolver now normalizes both forms (object and bare string) and probes `orchestrator.has()` before resolving.

## 2.7.0

### Minor Changes

- 8386de8: Declarative View↔Edit navigation on entity pages (#1332): `useNavContext` exposes a `modeToggle` computed (twin-mode route resolved from the semantic breadcrumb terminal, `router.hasRoute`-checked, `canUpdate`-gated on the Edit side, locale-reactive labels via `breadcrumb.view` / `breadcrumb.edit` keys), and `DefaultBreadcrumb` renders it as a toggle next to the terminal crumb — opt-in via `qdadmFeatures.breadcrumbModeToggle: true`. Edit→show navigation stays covered by the form page's own unsaved-changes guard.

### Patch Changes

- 550d23a: Two types consumers could not satisfy without casts (#1281): `ctx.entity()` is now generic (`entity<T extends EntityRecord>`) so narrowed `EntityManager<T>` subclasses pass (the invariant `EntityManager<EntityRecord>` parameter rejected them); `ResolvedAction` has a single declaration — `ShowPage` imports the composable's type instead of redeclaring it, and `severity` is typed `ButtonSeverity` (now exported from the main barrel) across `ActionConfig`, `LazyActionConfig` and show badges, so `v-bind="show.props.value"` typechecks.
- eacb435: JsonStructuredField.jsonMode now accepts string literals ('tree' | 'text' | 'table') like its VanillaJsonEditor sibling — consumers no longer need to import the vanilla-jsoneditor Mode enum (#1280, mirror of #1253).

## 2.6.1

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @quazardous/qdcore@1.0.0
  - @quazardous/qddebug@1.0.0

## 2.6.0

### Minor Changes

- f2a7e08: Column header shadowing made loud + consistent (#1255). When an i18n key
  `entities.{entity}.fields.{field}` shadows an explicit header (per-call
  `column()` override or inline `addColumn` header) with a DIFFERENT value, a
  one-shot dev warning announces it (deduped per entity+field; silent when the
  key merely copies the header). The precedence itself is unchanged and now
  documented where it lives: the catalog wins by design — an inline `header`
  is the no-key fallback, not an absolute override; to pin a header, don't
  create the key.

  Consistency fix uncovered by the warning's tests: `addColumn` used to let
  the inline header win at registration and only flip to the i18n value on the
  first locale change — silently and inconsistently. The catalog now wins at
  registration too.

- 01233b5: Structural views tightened + exported (#1253 phase 2). `query`,
  `invalidateCache`, `getFieldConfig` and `canRead` are now REQUIRED on the
  `EntityManagerRead` / `EntityManagerPermissions` views — they are
  unconditionally implemented on `EntityManager` and called unguarded by list
  pages; the `?` was a #1191 unification leftover that forced consumer-side
  casts on base methods (`.manager.invalidateCache()` no longer needs one).
  The badge/severity capability (`getEntityBadges`, `hasSeverityMap`,
  `getSeverity`, `getSeverityDescriptor`) stays optional by design, documented
  as such. Optionality contract documented in the interface header: required
  iff qdadm composables call it unguarded, plus capability coherence.

  The views are now exported from the main barrel (`EntityManagerBase`,
  `EntityManagerPermissions`, `EntityManagerRead`, `EntityManagerCrud`,
  `EntityManagerLike`, `OrchestratorLike`) so consumers can type manager-likes
  and test doubles against the same contract.

  Type-only tightening: hand-rolled manager-likes missing the flipped members
  stop compiling (they were one call away from a runtime crash inside list
  pages). No runtime change.

## 2.5.0

### Minor Changes

- 6083daf: OpenAPIConnector now warns on contract-less object schemas (#1240). A consumed
  `type: 'object'` node with no `properties`, no `additionalProperties` and no
  `$ref`/`oneOf`/`anyOf`/`allOf` emits an `EMPTY_OBJECT_SCHEMA` `ParseWarning` —
  under Fastify (fast-json-stringify) such a field serializes to `{}` at runtime,
  stripping every key. `parse()` now logs collected warnings via `console.warn`
  so CLI/vite-plugin users see them without switching to `parseWithWarnings()`;
  the structured API is unchanged. Generated output is untouched (object fields
  already emit `Record<string, unknown>`).
- 5593ef2: List column binding + OpenAPI field enrichment (#1255):
  - **`column(name, overrides?)`** on `useListPage` — spread onto a PrimeVue
    `<Column v-bind="list.column('botUuid')">` to derive `field` + `header`
    from one source while keeping the `#body` template. Header resolution:
    i18n key > override > inline `addColumn` header > `manager.fields[].label`
    > humanized field name. Pure read, additive — explicit `#columns` slots
    > and `addColumn` are untouched.
  - **`OpenAPIConnector` opt-in `inferLabels: 'humanize'`** — emit a humanized
    label (`botUuid` → "Bot Uuid") when a field has no `description`.
  - **`OpenAPIConnector` opt-in `inferReadOnly: true`** — fields present in
    responses but in no request-body schema become `readOnly: true` (entities
    without write operations get all fields readOnly); schema-declared
    `readOnly` always wins.
  - New `humanizeFieldName` util exported from `@quazardous/qdadm/utils`.

  Both connector options are off by default: enabling them changes generated
  manager output (by design — regen and commit under your drift gate).

- a78429b: Four TypeScript consumer-experience fixes (#1253):
  - **`QdadmManagerRegistry`** — consumer-augmentable interface (vue-router
    `RouteNamedMap` pattern). Declare your entity-name → manager-subclass map
    once via `declare module '@quazardous/qdadm'` and `getManager('bots')` /
    `useEntity('bots')` return the concrete subclass; unregistered names keep
    the historical `EntityManager<T>` fallback.
  - **`StorageResolution` / `ResolvedStorage` exported** from the main barrel —
    typing a `resolveStorage()` override no longer needs `ReturnType<...>`
    archaeology. (`undefined` was already legal in the union.)
  - **`baseClass` option in `generateManagers`** — global or per-entity
    `{ import, name }`; generated managers extend (classMode) or instantiate
    (instance mode) your own EntityManager subclass instead of the hardwired
    `EntityManager`.
  - **`VanillaJsonEditor.mode`** accepts `'tree' | 'text' | 'table'` string
    literals (the JSDoc example finally typechecks); the `Mode` enum is also
    re-exported from `@quazardous/qdadm/editors`.

## 2.4.5

### Patch Changes

- 25d839d: Type-safety / legacy cleanup (#1196, KPI-9 Phase A). `SecurityChecker`'s parallel legacy branch is retired: `rolePermissions`/`roleHierarchy` constructor options are normalized once into a `StaticRoleProvider` (a passed `RoleHierarchy` instance now contributes its config to the provider instead of living in a shadow field) — the config surface is unchanged and back-compat is test-locked. New public `hasSecurityChecker()` on `EntityAuthAdapter`; `EntityManager` no longer reaches into the private `_securityChecker` field through a cast. Phase B **complete**: all 13 kernel split files converted from `type Self = any` to their real prototype shapes (`Kernel`/`KernelContext`) — with the 4 entity files already on `EntityManagerInternal`, **all 17 prototype-patched files are now this-typed**. The typing immediately caught real drift: the #1201 options `parentParamMode`/`routeParamResolver` were missing from the KernelContext-side `KernelOptions` view — now declared.

## 2.4.4

### Patch Changes

- ef158ec: Dirty-tracking perf (#1194, KPI-7). `checkDirty` runs on every keystroke (deep watch on the form): the initial-side per-key `JSON.stringify` is now precomputed once at `takeSnapshot()` (cached map) instead of re-stringified on each check, and the snapshot's `JSON.parse(JSON.stringify(state))` deep clone is gone. Measured on a 100-field form with nested values: **checkDirty ×1.6 faster per keystroke, takeSnapshot ×1.85 faster**. Behavior identical (locked by a new dedicated test suite — `useDirtyState` previously had no direct tests); `isFieldDirty` reactivity untouched.
- 9ff8267: Split `useListPage.ts` (#1195, KPI-8): the two self-contained subsystems are extracted into composables it composes back in — `useListFilters` (filter state, the three option-source modes optionsEntity/optionsEndpoint/optionsFromCache, session persistence, URL sync, registry auto-load) and `useListAlterHooks` (`list:alter`/`filter:alter` wiring). Pure mechanical extraction: the public surface is unchanged and the existing useListPage tests pass untouched; the file drops from 1557 to ~1200 lines and both subsystems now have focused unit tests. `QueryOrchestratorLike` is now exported from FilterQuery.

## 2.4.3

### Patch Changes

- 75785de: Null placement in local sorts is now **configurable** (#1222) — it depends on the API and the field semantics. New `nullSort: 'first' | 'last' | 'low' | 'high'` accepted at three levels: per **field** (`fields.lastSeen.nullSort`), per **manager** (`nullSort` option, default for all fields), and on the shared `sortItems(items, by, order, { nulls })` helper. Default stays `'last'` (the 2.4.1 behavior — nulls at the end both ways). Use `'low'` for "last seen"-style dates: "Never" then sorts beyond the oldest period (first in asc, last in desc — PrimeVue `nullSortOrder: -1` semantics). `nullSortRank` and the types are exported.

## 2.4.2

### Patch Changes

- ca7ed56: Fix sort toggling on lists (#1222) — four stacked defects made inverting a sort a visual no-op:
  1. **Ghost loading mask**: near-synchronous loads (cache/local storage, fast APIs) flipped `loading` true→false within one frame, interrupting the PrimeVue overlay-mask transition — the invisible mask stayed in the DOM and swallowed every subsequent header click. The loading indicator is now **delayed 150 ms** (no spinner flash on fast loads, unchanged on slow ones).
  2. **removableSort's "sort removed" state** (PrimeVue cycles asc → desc → removed) reached the composable as `sortField: ''` / `sortOrder: 1`, loading unsorted; on the cache path this re-served the cache in whatever order the previous sort left it — identical rows. Removed-state now **falls back to the list's `defaultSort`**, and the null mapping is honest end-to-end.
  3. **Cache mutation**: the local sort reordered `cache.items` in place, so later unsorted reads returned the last sort's order. The sort now copies first.
  4. Session sort entries with an empty field (artifact of 2) are rejected on read.

  Also fixes the demo countries storage silently ignoring `sort_by`/`sort_order` (inherited from the dead REST Countries contract), and actually exports the KPI-5 `clientFilter` helpers (`sortItems`/`filterItems`/`searchItems`/`paginate`/`defaultGenerateId`) — the 2.3.1 changeset promised them but the barrel entry was missing.

- f8b424f: Dedup the page/composable copy-paste clusters (#1193, KPI-6). New shared units: `CardShell` (conditional Card wrapper — ShowPage and FormPage no longer duplicate their entire content body per branch), `useActionRegistry<A, Ctx, R>` (the map + ordered add/remove/resolve skeleton behind the list/form/show action registries; per-page resolution stays local), `createOrchestratorToast()` (was verbatim ×3), `runFieldValidators` (required → type → custom pipeline shared by validateField/validate), `formatFetchError` (utils). `useListPage`/`useEntityItemPage` now use the canonical `useOrchestrator()` injection (same error message). Also: `editRouteSuffix` option is now honored in the create→edit redirect, small dead code removed. Pure refactor, zero behavior change.

## 2.4.1

### Patch Changes

- 3a9e266: Local sort (cache path used by `useListPage`/`query()`) now places `null` values **last in both directions** (#1221). The previous direction-aware placement put nulls first on `desc` — a "Last Seen desc" list showed the never-seen rows on top. Aligns with the storage adapters' shared comparator. Note for lazy/server-paginated lists: the network request skybot captured (`limit=100`, no sort) is the #1204 cache-fill, which legitimately fetches everything unsorted — ordering happens in this local sort; `loadItems` does send `sort_by`/`sort_order` on real server-side fetches.

## 2.4.0

### Minor Changes

- 63f1db2: `useListPage` now persists the active sort (`sortField`/`sortOrder`) per entity, on the same session mechanism as filters, and restores it on init with `defaultSort` as fallback (#1218). Sorting a list, navigating to a detail and coming back no longer resets the order. Opt-out with `persistSort: false` (symmetric to `persistFilters`).

## 2.3.1

### Patch Changes

- 8ac586b: Dedup the client-side list pipeline across storage adapters (#1192, KPI-5). The byte-identical sort/search/paginate blocks in MemoryStorage, LocalStorage, MockApiStorage and SdkStorage now live in one shared `query/clientFilter.ts` (`sortItems` / `filterItems` / `searchItems` / `paginate` / `defaultGenerateId` — new public exports). Filtering keeps its historical per-adapter semantics via an explicit `stringMatch` mode (`includes` for Memory/Sdk, `exact` for Local); MockApiStorage keeps delegating operator filters to QueryExecutor. `StorageError` moved to `storage/errors.ts` (still re-exported from MemoryStorage and the storage barrel — no import breaks). The triplicated `generateId` default loses its deprecated `String.substr`. Pure behavior-preserving refactor.

## 2.3.0

### Minor Changes

- c039920: `ListPage` and `DefaultTable` accept a new `tableProps` prop, forwarded verbatim to the underlying PrimeVue `DataTable` and bound last so it can override defaults (#1217). Unlocks every DataTable prop qdadm doesn't wrap explicitly — e.g. `:table-props="{ nullSortOrder: -1 }"` to sort `null` values last ("Never"-style date columns) without leaking a display concern into the API payload.

## 2.2.2

### Patch Changes

- ee576ee: `PageNav` no longer builds navlinks that vue-router rejects (#1205). On a child family with a show route (`jobs/:jobId/tasks/:id`), the sibling/children navlink builders passed only the currently-available params, so `useLink` threw `Missing required param "id"` on every list/detail view (non-fatal console error ×2). Item-level routes (`-show`, like `-create`/`-edit`) are now excluded from navigation tabs, and a `routeParamsSatisfied` guard (exported from `module/moduleRegistry`) drops any navlink whose target route requires params that aren't available — mirroring the breadcrumb's existing guard.
- fe73669: Shared minimal structural types (#1191, KPI-4). `EntityManager.interface.ts` now exports assignment-safe `EntityManagerLike` / `OrchestratorLike<M>` / `ToastLike` views (method-syntax members, so the canonical generic classes satisfy them structurally — compile-time asserted in `Orchestrator.ts`). The 24 drifting local `interface EntityManager/Orchestrator` redeclarations across composables, security and components are migrated onto them; only the two deliberate internal `EntityManagerInstance` ducks remain (KPI-9 scope). New `ButtonSeverity` union export replaces `severity: string` + `as any` casts in ShowPage/PageHeader. Types only — no runtime change.

## 2.2.1

### Patch Changes

- e2e90da: The router auth guard's entity access check now fails **closed** (#1190). Previously a blanket `catch {}` — intended for "entity not registered" — swallowed every error from the access check (e.g. a throwing `canRead()`), silently ALLOWING navigation. Registration is now checked explicitly (`orchestrator.isRegistered`, the only allowed pass-through); an unexpected failure in the access check logs a `console.error` and denies navigation.
- dc07d7f: Fix `query()` returning `{items: [], total: 0}` for any entity whose total exceeds `effectiveThreshold` (#1204). `list()` never filled the cache above the threshold but also never flagged the overflow, so `query()` — which `useListPage` uses — filtered an empty cache instead of hitting the API: **any entity growing past ~100 rows silently rendered an empty list**.

  The cache is an optional layer and now behaves like one: `list()` marks the cache `overflowed` when the total exceeds the threshold, the `overflow` getter reflects it, `query()` skips the futile cache-fill and goes straight to the API (server-side pagination), and `invalidateCache()` resets the flag so a shrunk entity can re-cache. Small entities keep the local-cache fast path unchanged.

## 2.2.0

### Minor Changes

- 5a5cd35: Fix the child-route `:id` collision (#1201): `ctx.crud(child, { show/form }, { parentRoute })` generated `parent/:id/child/:id` when parent and child both used `idField: 'id'` — the child param shadowed the parent, breaking parent resolution (breadcrumb, parentChain, FK filter) on every child show/edit page.

  **New naming policy (`parentParamMode: 'auto'`, default):**
  - List-only child families keep the bare param — `/jobs/:id/tasks` URLs are **unchanged**.
  - Families with show/edit routes namespace the parent and keep the principal (child) id bare: `/jobs/:jobId/tasks/:id`.

  **Overrides** (by precedence): per-call `CrudOptions.parentParam` (e.g. `'jobUuid'`) > kernel `routeParamResolver(ctx)` global mapping service > kernel `parentParamMode` (`'auto' | 'always' | 'bare'`; `bare` = legacy naming with an explicit registration error on collision instead of silent shadowing).

  Framework consumers read the resolved name from `route.meta.parent.param`, so breadcrumbs, parent chains and FK filters adapt automatically. Only app code reading `route.params.id` directly in a child show/edit page to get the **parent** id needs updating — that pattern was broken by the shadowing anyway.

## 2.1.0

### Minor Changes

- 51098aa: `useOptionsLookup` endpoint mode is now kernel-aware (#1198) — the raw-fetch footgun is gone.
  - **New kernel option `apiClient`** (`HttpClient` or factory), provided as `qdadmApiClient`: `new Kernel({ apiClient: myAxios })`. New exports: `useApiClient()`, `resolveApiClient()`, `API_CLIENT_INJECTION_KEY`.
  - **Endpoint routing precedence**: `via: 'entityName'` (new option — that entity's `storage.request()`) > relative endpoint → kernel `apiClient` (base URL + auth applied, zero per-call wiring) > absolute URL → raw `fetch` + `headers` (escape hatch, unchanged) > relative without a registered client → legacy raw fetch **with a console warning**.
  - **Failed lookups are no longer silent**: non-JSON responses (HTML page), 401/403 and parse failures log a `console.warn` naming the endpoint and the likely cause.
  - `ScopeEditor` falls back to the kernel `apiClient` when no `apiAdapter` is injected (existing contract unchanged).

  Purely additive — existing `endpoint` + `headers` calls keep working.

## 2.0.0

### Major Changes

- 3fbc921: **2.0.0 — dead-export removal + unified locale policy.**

  ## Removed exports (all verified consumer-free)

  | Removed                                                            | Migrate to                                                                             |
  | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
  | `useForm` (+ `UseFormOptions`, `UseFormReturn`, `FormAlterConfig`) | `useEntityItemFormPage` (entity forms) / `useBareForm` (custom forms)                  |
  | `FormTabs`, `FormTab` components                                   | `FieldGroups` with `layout="tabs"`                                                     |
  | `ActionColumn` component                                           | `ActionButtons` (data-driven, used by `ListPage`)                                      |
  | `useCurrentEntity` (+ `UseCurrentEntityReturn`)                    | `useStackHydrator().setCurrentData()`                                                  |
  | `get supportsCaching()` instance getter on the 5 storage adapters  | static `capabilities.supportsCaching` (e.g. `ApiStorage.capabilities.supportsCaching`) |

  ## Behavior change: one locale policy (browser locale)

  Date/number/currency rendering previously used three conflicting policies (`fr-FR` hardcoded in `useListPage.formatDate`, `en-US` fallback in `ShowDisplay`, browser locale in `utils/formatters`). Everything now routes through `utils/formatters` with the **browser locale** by default:
  - `useListPage`'s `formatDate` no longer forces `fr-FR`.
  - `ShowDisplay` no longer falls back to `en-US`; the per-field `field.locale` override still wins.
  - `formatDate` / `formatDateOnly` / `formatNumber` gain an optional trailing `locale` parameter; new `formatCurrency(value, currencyCode?, locale?)` export.

  If your app relied on the hardcoded `fr-FR`/`en-US` rendering, pass `field.locale` explicitly (show fields) or set the browser/app locale.

### Patch Changes

- 92ceeaa: Fix `EntityManager.list()` total extraction on the resolved-endpoint path (child lists via `resolveStorage` → `storage.request`). Wrapper responses like `{ data: [...], pagination: { total } }` (or `{ data: [...], total }`) had their total read from the unwrapped items array, falling back to the page length — so pagination believed there was only one page. The wrapper-level `total` / `pagination.total` are now read before the page-length fallback (#1197).

## 1.22.0

### Minor Changes

- 916d871: `VanillaJsonEditor` now supports inline JSON Schema validation (qdadm #1050).

  New optional props forward vanilla-jsoneditor's native `validator`:
  - `:schema="<JSON Schema>"` — compiled with `createAjvValidator` (Ajv is bundled in vanilla-jsoneditor, no new dependency), errors are highlighted live in the editor tree/text;
  - `:validator="<fn>"` — a raw validator for advanced cases, takes precedence over `schema`;
  - `:schema-definitions` / `:ajv-options` — passthrough to the Ajv validator.

  With none set, behavior is unchanged (no validation). Schema/validator changes are reactive (`editor.updateProps`). Validation errors already surface through the existing `error` event and the editor's status bar.

## 1.21.0

### Minor Changes

- 76f1ba8: Add `i18n.emitMissing` option (default `true`) to silence the `i18n:missing` debug signal (qdadm #1048).

  In an untranslated app, every unresolved key fires `i18n:missing`, flooding the debug panel's "Missing" section. Set `new Kernel({ i18n: { emitMissing: false } })` to suppress that stream. No functional impact — only the debug collector consumes the signal, so the section just stays empty; `i18n:domain-loaded`, `locale:changed`, and the inbound `locale:change` listener are unaffected.

## 1.20.0

### Minor Changes

- 062006e: Add `<ParentCard>` — a normalized parent detail cartouche for embedding at the top of a child `ListPage` (the "B2" hybrid composition, qdadm #1038).

  On a child-list route, `useListPage` already resolves and exposes the parent record (`parentData` / `parentLoading`) with no extra fetch. `<ParentCard>` renders it read-only above the table, auto-deriving its fields from the parent entity's manager and using the **same** field resolver as `ShowPage`, so the cartouche looks exactly like a real detail page:

  ```vue
  <template #beforeTable>
    <ParentCard
      :entity="'books'"
      :data="list.parentData.value"
      :loading="list.parentLoading.value"
    />
  </template>
  ```

  Pass `fields` to restrict/order the displayed fields, or use the default slot to render the parent yourself with the resolved field set. Works whether the child route comes from `ctx.crud(...,{foreignKey})` or `ctx.childPage()` — it only depends on `parentData`.

  Internally, the show field-resolver (schema-type → display-type mapping, auto reference routes, severity badges) was extracted into a shared `createShowFieldResolver` used by both `useEntityItemShowPage` and `<ParentCard>` — no behavior change to existing show pages.

## 1.19.7

### Patch Changes

- c80ed6c: Drop the Vite-specific `?raw` import for the built-in i18n defaults so qdadm works across bundlers and in `file:`/symlink consumer setups (qdadm #492).

  `DefaultCoreProvider` previously did `import('./core.<locale>.yml?raw')`. The `?raw` query is a Vite-only binding: when qdadm is consumed via a `file:` link through a symlink (testbed, `npm link`, pnpm workspace), Vite serves the YAML over `@fs/<realpath>`, the real path resolves outside the consumer's workspace root, and `server.fs.allow` rejects it — breaking the admin at boot. It also fails outright under non-Vite bundlers (Webpack, esbuild, standalone Rollup) that don't understand `?raw`.

  The `core.<locale>.yml` files remain the editable, translator-friendly source of truth. A generator (`scripts/gen-i18n-defaults.mjs`, `npm run gen:i18n-defaults`) emits committed `core.<locale>.generated.ts` modules that `export default` the raw YAML string; the provider now imports those plain TS modules. No build step at publish (the `.generated.ts` are committed, preserving the source-only model), per-locale code-splitting is unchanged, and a test fails if a `.yml` is edited without regenerating. Consumers on `file:`/symlink setups can drop the `server.fs.allow` workaround.

## 1.19.6

### Patch Changes

- 57f0acb: Fix two `TS2532: Object is possibly 'undefined'` errors that leaked to consumers via the source-only distribution. Under `noUncheckedIndexedAccess`, indexed access returns `T | undefined`, and neither a `.length === 1` check nor a bounded `for` loop narrows the element type for the compiler:
  - `useOptionsLookup.ts` — `filtered[0].toLowerCase()` guarded only by `filtered.length === 1`; now binds the sole element to a local that the `!== undefined` check narrows.
  - `EntityManager.cache.ts` — `entries[i][0]` inside the eviction loop; now iterates `entries.slice(0, toRemove)` and destructures the key, dropping the unchecked index entirely.

  No runtime behavior change — `vue-tsc --noEmit` against the package source is now clean. Reported in qdadm #1019.

## 1.19.5

### Patch Changes

- 1a35219: Fix codegen class-mode constructor TS2345 on `fields`. The generated `Generated${X}Manager` constructor was typing its `options` argument as a hand-rolled `Partial<{ ... fields: Record<string, unknown>; [key: string]: unknown }>`. The toxic combo (`Record<string, unknown>` + index signature) widened the inline literal's strictly-typed `fields: Record<string, FieldConfig>` at the `super({ ...literal, ...options })` spread, so `vue-tsc --noEmit` against generated files reported `TS2345: Argument of type '{ ...; fields: Record<string, unknown>; ... }' is not assignable to parameter of type 'EntityManagerOptions<XxxEntity>'`.

  The codegen now emits `constructor(options: Partial<EntityManagerOptions<${className}Entity>> = {})` and imports `EntityManagerOptions` from `@quazardous/qdadm`. The signature stays in sync with the parent class automatically — future additions to `EntityManagerOptions` no longer require touching the template — and the strict `fields` typing survives the spread. Reported by skybot-claude on `vue-tsc --noEmit` over generated managers in 1.19.4.

- 8043b44: Fix asymmetric button size between `FormPage` and `ListPage` header actions. `ListPage.vue` forced `size='small'` on its header action buttons, but `FormPage.vue` rendered actions from `form.addAction(...)` without a `size` prop — so PrimeVue's default (normal/large) showed up on edit pages, breaking visual coherence with the list. Reported by skybot-claude in qdadm #1016.

  `FormPage.vue` now renders header actions with `:size="action.size || 'small'"` to match `ListPage`. Symmetric overrides: `size?: string` is now part of the shared `ActionConfig` (`useEntityItemFormPage.types.ts`) and `HeaderActionConfig` (`useListPage.types.ts`) — consumers can opt into a different size from either side without touching component code. `ListPage.vue`'s local widening `interface ResolvedHeaderAction extends BaseResolvedHeaderAction { size?: string }` is removed since the base type now carries `size` directly.

  Default remains `'small'` on both pages, so no breaking change for existing consumers.

## 1.19.4

### Patch Changes

- Two docs/devDeps tweaks driven by feedback from a downstream consumer (qdcms) who hit a primevue dedupe trap when consuming qdadm via a `file:` link from a sibling monorepo:
  - **README — new section "Consuming via `file:` link from a sibling monorepo"** documents the `resolve.dedupe` pattern in the host's bundler config. Symptom = PrimeVue components render without Aura preset tokens (paginator buttons collapsed, datatable padding gone) because two copies of `primevue` end up in the bundle when the symlink is followed into the qdadm-monorepo's hoisted `node_modules`. Fix is one line in `vite.config.ts`: `resolve.dedupe: ['vue', 'vue-router', 'primevue', '@primeuix/themes']`. Doesn't affect npm consumers (the tarball ships no `node_modules/`) — purely a `file:`/`workspace:` link trap.
  - **`primevue` and `@primeuix/themes` added to `devDependencies`**, complementing the existing `peerDependencies` entries. The library itself doesn't ship primevue (it stays a peer), but local tests/builds of qdadm now resolve a deterministic version instead of relying on whatever the consumer workspace happens to have hoisted.

## 1.19.3

### Renamed — `qdadm` → `@quazardous/qdadm`

The package has been renamed from the unscoped `qdadm` to the scoped `@quazardous/qdadm`, joining `@quazardous/qdcore` and `@quazardous/qddebug` under a single scope. The unscoped `qdadm` on npm (versions up to 1.19.2) is being deprecated with a redirect notice. **Consumers must update**:

```diff
- "qdadm": "^1.19.2"
+ "@quazardous/qdadm": "^1.19.3"
```

```diff
- import { EntityManager } from "qdadm"
+ import { EntityManager } from "@quazardous/qdadm"
```

The codegen output also switches: generated `import { EntityManager } from "qdadm"` lines become `from "@quazardous/qdadm"`. Re-run `qdadmGen` after upgrade to refresh the generated files. The library API is unchanged — this is strictly a name/import-path migration.

The reasoning: keeping `qdadm` as an unscoped name created a permanent special case for tokens (npm Granular tokens scoped to `@quazardous` don't cover unscoped packages), Trusted Publishers (per-package config instead of scope-level), and CI tooling. Folding into the scope removes that whole class of friction.

### Patch Changes

- Three fixes reported by a downstream consumer running `vue-tsc --noEmit` against `qdadm@1.19.2`:
  - **Codegen now parameterizes the storage class with the entity type.** Generated managers were emitting `new ApiStorage(opts)` which defaults to `IStorage<EntityRecord>`; `EntityManager<XxxEntity>` expects `IStorage<XxxEntity>`, so every generated `*.ts` file failed type-check with TS2322. The codegen now emits `new ApiStorage<XxxEntity>(opts)` in both instance and class modes. Class mode also stops typing the constructor's `storage` override as `unknown` and uses `IStorage<XxxEntity>` instead.
  - **`vite-env.d.ts` declares `*.scss`, `*.css`, `*.sass` directly.** Previously these were only reachable through the `/// <reference types="vite/client" />` triple-slash, which silently failed for consumers whose `tsconfig.compilerOptions.types` didn't include `vite/client` or who didn't have `vite` installed. The internal `import('./styles.scss')` calls in `Module.ts`, `DebugModule.ts`, and `NotificationModule.ts` now type-check from any consumer context.
  - **`vite` declared as an optional peer dependency** with the wide range `^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0`, mirroring `@vitejs/plugin-vue@6.x`. Bumped the dev dep `@vitejs/plugin-vue` to `^6.0.0`. Consumers on Vite 7+ will see `qdadm/gen/vite-plugin` and `qdadm/vite-plugin-debug` resolve `Plugin` against their own Vite without the cross-version `Plugin<any>` mismatch that was hitting their `vue-tsc --noEmit`.

> **Note**: From 1.19.3 onwards, this per-package changelog is the source of truth, written automatically by [Changesets](https://github.com/changesets/changesets) on each release. For history up to 1.19.2 (and for cross-package release notes that pre-date Changesets adoption), see the repository root [../../CHANGELOG.md](../../CHANGELOG.md).
