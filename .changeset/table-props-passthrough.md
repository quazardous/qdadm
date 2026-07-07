---
"@quazardous/qdadm": minor
---

`ListPage` and `DefaultTable` accept a new `tableProps` prop, forwarded verbatim to the underlying PrimeVue `DataTable` and bound last so it can override defaults (#1217). Unlocks every DataTable prop qdadm doesn't wrap explicitly — e.g. `:table-props="{ nullSortOrder: -1 }"` to sort `null` values last ("Never"-style date columns) without leaking a display concern into the API payload.
