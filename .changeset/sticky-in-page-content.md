---
"@quazardous/qdadm": patch
---

`position: sticky` works in page content again (#2534).

`.main-content` declared `overflow-y: auto` in `AppLayout` and `BaseLayout`, but the window scrolls, not that box. It became the anchor of every sticky element below it — a box that never moves — so nothing stuck.

- The shell is no longer a scroll container. It keeps `min-width: 0`, so a wide child cannot stretch the content column.
- DataTables scroll horizontally in their own container (`.p-datatable-table-container`) at every width. The previous rule targeted PrimeVue 3's `.p-datatable-wrapper` on tablets only; on desktop, wide tables were contained only by the shell's overflow.

Measured in Chromium with the shell's own chain (`.main-content` > show grid > media > sticky child), window scrolled 1200 px: the sticky child moved from 56 px to −1144 px before, and settles at its `top: 1rem` after. A 3000 px-wide child no longer stretches the column nor scrolls the page sideways when it sits in a scrolling container.
