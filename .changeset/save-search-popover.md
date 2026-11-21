---
'@quazardous/qdadm': patch
---

QdSaveSearch: the search's name is asked in a popover anchored to the bookmark (#5429) instead of an inline form that ran past the window's right edge. It is placed where it fits, width `min(24rem, 100vw - 2rem)`; Enter saves, Escape or a click outside closes, the focus goes into the field and comes back to the bookmark (`aria-haspopup="dialog"`, `aria-expanded`). Same in both places, `'filters'` and `'header'`.
