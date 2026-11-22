---
'@quazardous/qdadm': minor
---

A list's row band can sit above the row's cells: `rowBandPosition: 'above'` (ListPage prop, useListPage option; default `below`) draws it as a header line, still one object with its row (one hover, one selection, its stripe, the separator after the row), a click in it a click on the row, the row described by it; a list that groups its own rows keeps the band below, with a dev warning (#5451)
