---
"@quazardous/qdadm": minor
---

feat(display): the marker for an empty value is configurable. `new Kernel({ display: { emptyPlaceholder: '—' } })` sets it for detail pages and for the formatters in `@quazardous/qdadm/utils`, and a field's `emptyText` overrides it. `setEmptyPlaceholder` / `getEmptyPlaceholder` are exported from `/utils`. The default stays `'-'`.
