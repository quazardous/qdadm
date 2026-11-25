---
"@quazardous/qdadm": minor
---

The edge bar's panel can be pinned (#5511): a pin in its head keeps it beside the page, which makes room for it, and a click outside, the focus leaving and Escape no longer close it (the chevron and the open tab still do). It stays open from page to page; the browser keeps the pin, open and on its tab, across a reload. No pin on a narrow screen. `features.edgeBar.pinnable` (default true), `useEdgeBar().pinned` / `docked` / `pin(on)`, `QdEdgePanel` `v-model:pinned` and `pinnable`.
