---
'@quazardous/qdadm': minor
---

List filters of several values, and of the app's own (#5467):
- `multiple: true` (or `type: 'multiselect'`): the value is an array, none chosen is off; drawn by `QdMultiFilter` with the choices under their `group` headings (a heading toggles its group), a `badge: { label, tone }` per choice, the chosen ones as badges then « +N » when closed, and a search past 8 choices. Comma-joined in the address, kept as an array in the session, filtered as `$in` locally; `dependsOn` keeps the values still among the new choices; endpoint choices keep `group` and `badge`.
- `component`: any filter drawn by the app's own component under the filter contract (props `modelValue`, `filter`, `options`, `loading`, `atDefault`; `update:modelValue` back, wrapped into an array for a `multiple` filter); `useFilterModel`, `QdFilterProps`, `QdFilterEmits`; `describe(value)` names it in "Save this search" and a run.
- `ApiStorage` sends an array comma-joined by default (`types=a,b`), whatever the HTTP client; `arrayFormat: 'repeat' | 'brackets' | 'client'` (or per parameter) for other backends. An app that relied on axios's `types[]=` for an array filter sets `arrayFormat: 'client'`.
- The filter bar's Clear returns each filter to its default (a defaulted filter was left as a choice of none since 2.70), and shows only when a filter is off its default.
