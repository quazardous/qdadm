---
"@quazardous/qdadm": patch
---

Null placement in local sorts is now **configurable** (#1222) — it depends on the API and the field semantics. New `nullSort: 'first' | 'last' | 'low' | 'high'` accepted at three levels: per **field** (`fields.lastSeen.nullSort`), per **manager** (`nullSort` option, default for all fields), and on the shared `sortItems(items, by, order, { nulls })` helper. Default stays `'last'` (the 2.4.1 behavior — nulls at the end both ways). Use `'low'` for "last seen"-style dates: "Never" then sorts beyond the oldest period (first in asc, last in desc — PrimeVue `nullSortOrder: -1` semantics). `nullSortRank` and the types are exported.
