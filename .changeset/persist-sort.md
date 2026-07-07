---
"@quazardous/qdadm": minor
---

`useListPage` now persists the active sort (`sortField`/`sortOrder`) per entity, on the same session mechanism as filters, and restores it on init with `defaultSort` as fallback (#1218). Sorting a list, navigating to a detail and coming back no longer resets the order. Opt-out with `persistSort: false` (symmetric to `persistFilters`).
