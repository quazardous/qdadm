# i18n — Design Plan (TODO)

Working document. Captures the current design direction for i18n in qdadm before implementation. To be revised when we come back to it.

## Goal

Make qdadm i18n-ready without adding weight to projects that don't translate. Translation should be **free to skip** and **easy to adopt**. No backwards-compat constraint (nothing is shipped yet).

## CREDO alignment

| CREDO principle | i18n application |
|---|---|
| Declaration over implementation | No `t('...')` in configs. Keys are derived from the declarative schema |
| Invisible storage | Translations come from pluggable providers — pages don't know they exist |
| Module boundaries | Each module declares its own messages alongside its entities |
| Signals over imports | Locale change is a signal; providers don't import each other |
| Smart filters (source, not values) | Labels derive from schema structure, not hand-written keys |

## Core thesis (unique value)

**The entity/field schema IS the i18n key source.** Nobody ships this pattern. All surveyed libraries (react-admin, Refine, AdminJS, AdminForth) require hand-written keys. We derive them from module/entity/field names. The provider only supplies overrides.

## Decisions made

1. `label` / `labelPlural` / `placeholder` are **removed** from field/entity/nav/group configs. Configs hold structure only; text lives in messages.
2. Keys are derived from the schema by a fixed convention (see below).
3. Customizing a label requires going through `ctx.messages()` or a translation provider. **Forcing function** — projects are always i18n-ready.
4. Fallback `snakeCaseToTitle(fieldName)` preserves zero-friction prototyping: no declarations needed to get something usable on screen.
5. Translation backends are **pluggable via a `TranslationProvider` interface**, mirroring the Storage adapter pattern.
6. Provider interface is **minimal**. `changeLocale`/`getLocale` belong on the Kernel, not on providers.
7. Locale change is dispatched via the **signal bus** (`locale:change` / `locale:changed`), not via direct coupling to vue-i18n or PrimeVue.
8. **Adopt react-admin's `i18nProvider` shape** where it makes sense, but trim dead weight.
9. **Start without `vue-i18n`** and without `@intlify/message-compiler`. No ICU at MVP — simple `{placeholder}` interpolation is enough for labels. ICU comes later via an optional provider/adapter.
10. Tolgee and Paraglide providers are **deferred** — structure the package layout so they can be added later with no core refactor.

## TranslationProvider interface

```ts
interface TranslationProvider {
  readonly name: string
  load(locale: string): Promise<MessagesBundle>
  availableLocales?(): string[] | Promise<string[]>
  save?(locale: string, bundle: MessagesBundle): Promise<void>
  watch?(locale: string, cb: (b: MessagesBundle) => void): () => void
}

type MessagesBundle = {
  entities?: Record<string, EntityMessages>
  nav?: Record<string, unknown>
  core?: Record<string, unknown>
  modules?: Record<string, unknown>
  aliases?: AliasPattern[]
  [ns: string]: unknown
}
```

Provider's only job: deliver bundles (and optionally persist / watch). Anything else is kernel responsibility.

## Kernel API

```ts
kernel.i18n.t(key, params?)               // resolver + simple {placeholder} interpolation
kernel.i18n.locale                         // reactive ref
kernel.i18n.availableLocales               // union from all providers
kernel.i18n.resolve(key)                   // dev-facing: returns resolution trace

signals.emit('locale:change', 'fr')        // public API to switch locale
signals.on('locale:changed', (loc) => {})  // past-tense broadcast once switch done
signals.on('i18n:missing', ({ key, locale }) => {})  // dev tool

// Composable
const { t, locale } = useI18n()
```

On `locale:change`:
1. Load bundles from providers for the new locale (if not cached).
2. Merge into registry.
3. Sync PrimeVue locale.
4. If `vue-i18n` instance is registered, sync its global locale.
5. Invalidate label cache.
6. Emit `locale:changed`.

Integrated with Deferred/Warmup: `deferred.queue('i18n:locale:{loc}:ready')` gates locale-sensitive pages.

## Key convention (derived from schema)

```
entities.{entity}.label
entities.{entity}.labelPlural
entities.{entity}.fields.{field}
entities.{entity}.fields.{field}.placeholder
entities.{entity}.fields.{field}.options.{value}
entities.{entity}.groups.{group}
entities.{entity}.actions.{action}
entities.{entity}.errors.{error}

modules.{module}.*                         # module-scoped overrides
nav.sections.{section}
nav.routes.{route}

core.actions.{save|cancel|delete|edit|...}
core.fields.{id|created_at|updated_at|...}
core.messages.{empty|loading|noResults|...}
core.errors.{required|tooShort|notFound|...}
```

The dev never writes these keys in field configs. They appear only on the left-hand side of a `ctx.messages()` bundle — which mirrors the convention structurally.

## Fallback chain

```
1. key in currentLocale (via merged registry)
2. key in fallbackLocale
3. apply matching alias pattern (if any) → restart from step 1 with rewritten key
4. if key matches entities.*.fields.{field} → snakeCaseToTitle(field)
5. return the raw key (visible trace of the miss) + emit 'i18n:missing'
```

Step 4 is intentionally narrow — only field keys fall back to a humanized form. `core.actions.save` missing must not silently become "Save".

## Aliases

### Value-level (user request)

A message value starting with `@` is a pointer to another key:

```js
ctx.messages('fr', {
  entities: {
    books: {
      actions: { save: '@core.actions.save' }
    }
  }
})
```

Resolution: detect `@` prefix → lookup target → if also `@`, follow (cycle detection, depth cap 8). Interpolation params pass through transitively. Escape literal `@` as `@@`.

### Pattern-level

Declared separately or carried by a provider bundle. Matches the lookup key with wildcards, rewrites to a target (with capture back-references):

```ts
{ pattern: 'entities.*.actions.*', target: 'core.actions.$2' }
```

Applied at step 3 of the fallback chain. **Longest-match wins** when multiple patterns overlap.

## Key strategies (presets of aliases)

Shipped presets:

- **`global`** (default) — common concepts (actions, timestamps, errors) route to `core.*` via wildcards. Maximum DRY.
- **`module`** — routes to `modules.{module}.*` for module-wide customization. Requires kernel to track `entity → module` mapping (already available via `connect(ctx)`).
- **`entity`** — no aliases. Every entity owns its labels. Maximum verbosity, maximum flexibility.

Overridable at three levels (nearest wins):

```js
new Kernel({ i18n: { keyStrategy: 'global' } })       // app default
ctx.i18n.strategy('module')                            // module-scoped
ctx.entity('invoices', new EntityManager({ i18n: { strategy: 'entity' }, ... }))
```

Custom strategies can be defined and composed:

```js
ctx.i18n.defineStrategy('ecommerce', [ ... ])
new Kernel({ i18n: { keyStrategy: ['global', 'ecommerce'] } })
```

## Ways to declare messages

Three entry points, all feed the same registry:

1. **Inline value** `'@foo.bar'` inside bundles passed to `ctx.messages()`.
2. **`ctx.aliases([...])`** — module adds pattern aliases.
3. **Provider `load()`** — returned bundle may include `aliases: [...]`.

## Shipped defaults

qdadm core ships:
- `InlineTranslationProvider` (backs `ctx.messages()`).
- Default English bundle for `core.*` (actions, fields, messages, errors).
- Default alias preset for the `global` strategy.

Projects needing file-based or API-backed translations install a separate provider package.

## Providers roadmap

| Provider | MVP | Later |
|---|---|---|
| `InlineTranslationProvider` (core) | ✅ | — |
| `@qdadm/translation-provider-json` | ✅ minimal | polish (lazy per-locale, Vite glob) |
| `@qdadm/translation-provider-http` | structure only | impl + `watch()` |
| `@qdadm/translation-provider-intlify` (ICU/plurals via `@intlify/message-compiler`) | — | when ICU is needed |
| `@qdadm/translation-provider-tolgee` (live in-context edit, AI) | — | project-driven |
| `@qdadm/translation-provider-paraglide` (compile-time, type-safe) | — | if type-safety becomes a priority |

Package scaffolding is created from day one so adding any of these later requires no core refactor.

## Dev tools

- **`i18n:missing` signal** emitted on step 4 or 5 of the fallback chain. No default listener; a dev-mode collector can aggregate missing keys to seed a bundle.
- **`kernel.i18n.resolve(key)`** returns the trace: matched locale, alias chain, final value or miss reason.
- **Bundle export**: `kernel.i18n.dump(locale)` → plain object, feeds a translator workflow.

## Audit: core strings in qdadm `.vue` files

Before rolling out, one-shot audit of hardcoded strings in `packages/qdadm/src/**/*.vue` (buttons, confirmations, empty states, placeholders, toast defaults, validation messages). Migrate to `t('core.*')`. Done once in the lib, no recurring cost.

## Implementation plan

1. **This doc** — stable contract before any code. ← we are here.
2. **Minimal core implementation** (resolver, fallback chain, `InlineTranslationProvider`, `ctx.messages()`, `useI18n()`, `kernel.i18n.*`, signal wiring, default EN `core.*` bundle, `global` strategy preset).
3. **POC on the `books` module of the demo** with FR/EN. Validates ergonomics end-to-end.
4. **Audit + migration** of `packages/qdadm/src/**/*.vue` strings.
5. **Roll out** to the rest of the demo modules.
6. **Publish `@qdadm/translation-provider-json`** as first external provider.

## Open questions (decide before implementation)

- **Alias syntax**: `@key` (compact, proposed) vs `$t:key` vs object form `{ $alias: 'key' }`. Leaning `@key`.
- **Pattern capture syntax**: positional (`$1`, `$2`) or semantic (`{entity}`, `{module}`) — pick one. Leaning positional for simplicity.
- **Default `keyStrategy`**: `global` (DRY) or `entity` (no magic). Leaning `global`.
- **PrimeVue locale mapping**: ship a built-in `qdadm-locale → primevue-locale` table, or leave it to the project? Built-in with overrides is probably right.
- **Pluralization fallback when no ICU provider**: keep `pluralize` (EN-only) for `labelPlural` derivation when locale starts with `en*`, fail/fallback to singular otherwise? Or require `labelPlural` to be declared explicitly in non-EN locales?
- **Bundle format on disk** (for file providers): nested JSON (mirrors `ctx.messages()` shape) vs flat (dotted keys). Leaning nested.
- **Merge strategy across providers**: last-wins by default, with a flag for inline-first (module bundles beat external files).

## References

- [QDADM_CREDO](../packages/qdadm/QDADM_CREDO.md) — framework philosophy
- [Architecture](./architecture.md) — PAC pattern, layering
- [Signals](./signals.md) — event bus, EventRouter
- [Deferred](./deferred.md) — async coordination, warmup
- react-admin `i18nProvider`: <https://marmelab.com/react-admin/TranslationWriting.html>
- Refine `i18nProvider`: <https://refine.dev/docs/i18n/i18n-provider/>
- AdminForth fallback chain: <https://adminforth.dev/docs/tutorial/Plugins/i18n/>
- `@intlify/message-compiler`: <https://www.npmjs.com/package/@intlify/message-compiler>
- Tolgee: <https://tolgee.io/>
- Paraglide JS: <https://github.com/opral/paraglide-js>
