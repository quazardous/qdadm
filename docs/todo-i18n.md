# i18n — TODO

Tracking what's still open. **Delete this file once everything below ships.**

For usage and concepts, see [`i18n.md`](./i18n.md).

## Deferred providers

External provider packages, scaffolded as separate `@qdadm/translation-provider-*` packages so adding any of them requires no core refactor.

| Package | Purpose | Status |
|---|---|---|
| `@qdadm/translation-provider-json` | File-based, lazy per locale, Vite glob | not started |
| `@qdadm/translation-provider-http` | API-backed, optional `watch()` for live reload | not started |
| `@qdadm/translation-provider-intlify` | ICU/plurals via `@intlify/message-compiler` | not started — only needed when projects ask for plurals |
| `@qdadm/translation-provider-tolgee` | Live in-context editing + AI translation | not started — high differentiation, project-driven |
| `@qdadm/translation-provider-paraglide` | Compile-time, type-safe, tree-shaken | not started — wait for type-safety demand |

## Open questions

Decide before publishing the first external provider:

- **Bundle format on disk** for the JSON/YAML provider: nested object (mirrors `ctx.messages()`) or flat dotted-keys? Leaning nested.
- **Merge strategy across providers**: last-wins by default, with a flag for inline-first (module bundles beat external files)?
- **`@intlify/message-compiler` integration**: wrap as an optional resolver layer (transparent) or expose a separate `translate-icu()` method? The current resolver only does `{placeholder}` substitution.

## Engine work

- **PrimeVue locale auto-sync**: ship a `qdadm-locale → primevue-locale` mapping table, update PrimeVue's locale config on `locale:changed`. Handle FR/EN/DE/ES out of the box, leave the table extensible.
- **Pluralization fallback for non-EN locales** without ICU: today `labelPlural` derives from `pluralize` (English-only). Either keep using it for `locale.startsWith('en')` and require explicit `labelPlural` translations otherwise (current behaviour), or document this clearly.
- **Audit remaining hardcoded strings in qdadm specialised editors**: `placeholder=` in `RoleForm.vue`, `RouterPanel.vue`, `KeyValueEditor.vue`, `ScopeEditor.vue`, `LanguageEditor.vue`, `BulkStatusDialog.vue`. Low-visibility but worth migrating to `t('core.placeholders.*')` for completeness.
- **DebugBar i18n panel**: a panel that lists missing keys captured from `i18n:missing`, plus a "dump current locale" button. Useful dev affordance.

## Demo polish

- **Project template strings**: custom `<h1>` in `BookForm.vue`, `BookStats.vue`, `BookInfo.vue` etc. are still hardcoded English. Migrate as a showcase of the `useI18n()` pattern in user code.
- **Settings page custom strings**: `SettingsEditPage` and `JsonStructuredField` editor have UI strings that aren't yet translated.

## When to delete this file

When all five external providers exist (or are explicitly out of scope), the open questions are decided, the editor strings are migrated, and PrimeVue locale sync ships — this file is no longer load-bearing and should be removed.
