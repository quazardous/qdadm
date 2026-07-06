---
"@quazardous/qdadm": major
---

**2.0.0 — dead-export removal + unified locale policy.**

## Removed exports (all verified consumer-free)

| Removed | Migrate to |
|---|---|
| `useForm` (+ `UseFormOptions`, `UseFormReturn`, `FormAlterConfig`) | `useEntityItemFormPage` (entity forms) / `useBareForm` (custom forms) |
| `FormTabs`, `FormTab` components | `FieldGroups` with `layout="tabs"` |
| `ActionColumn` component | `ActionButtons` (data-driven, used by `ListPage`) |
| `useCurrentEntity` (+ `UseCurrentEntityReturn`) | `useStackHydrator().setCurrentData()` |
| `get supportsCaching()` instance getter on the 5 storage adapters | static `capabilities.supportsCaching` (e.g. `ApiStorage.capabilities.supportsCaching`) |

## Behavior change: one locale policy (browser locale)

Date/number/currency rendering previously used three conflicting policies (`fr-FR` hardcoded in `useListPage.formatDate`, `en-US` fallback in `ShowDisplay`, browser locale in `utils/formatters`). Everything now routes through `utils/formatters` with the **browser locale** by default:

- `useListPage`'s `formatDate` no longer forces `fr-FR`.
- `ShowDisplay` no longer falls back to `en-US`; the per-field `field.locale` override still wins.
- `formatDate` / `formatDateOnly` / `formatNumber` gain an optional trailing `locale` parameter; new `formatCurrency(value, currencyCode?, locale?)` export.

If your app relied on the hardcoded `fr-FR`/`en-US` rendering, pass `field.locale` explicitly (show fields) or set the browser/app locale.
