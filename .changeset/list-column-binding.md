---
"@quazardous/qdadm": minor
---

List column binding + OpenAPI field enrichment (#1255):

- **`column(name, overrides?)`** on `useListPage` — spread onto a PrimeVue
  `<Column v-bind="list.column('botUuid')">` to derive `field` + `header`
  from one source while keeping the `#body` template. Header resolution:
  i18n key > override > inline `addColumn` header > `manager.fields[].label`
  > humanized field name. Pure read, additive — explicit `#columns` slots
  and `addColumn` are untouched.
- **`OpenAPIConnector` opt-in `inferLabels: 'humanize'`** — emit a humanized
  label (`botUuid` → "Bot Uuid") when a field has no `description`.
- **`OpenAPIConnector` opt-in `inferReadOnly: true`** — fields present in
  responses but in no request-body schema become `readOnly: true` (entities
  without write operations get all fields readOnly); schema-declared
  `readOnly` always wins.
- New `humanizeFieldName` util exported from `@quazardous/qdadm/utils`.

Both connector options are off by default: enabling them changes generated
manager output (by design — regen and commit under your drift gate).
