---
'@quazardous/qdadm': minor
---

ListPage: row bands (#5437). A `#row-band="{ data, index }"` slot draws a full-width band under a row's cells, across every column, for the rows `rowBand(row)` picks (a `useListPage` option or a ListPage prop; every row without it). Rendered on the DataTable's row expansion, always open, with no expander. The row and its band read as one object: no border between them, one hover and one selection, a click in the band is a click on the row (not on the band's own links and buttons), and the row is described by its band (`aria-describedby`). Sorting, paging and runs are unchanged. The demo's books list bands its classics.
