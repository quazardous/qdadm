# Changelog

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
