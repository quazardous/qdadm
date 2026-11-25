---
"@quazardous/qdadm": minor
---

The edge bar (#5506): a thin bar on an edge of the layout, its chevron and badged tabs hooked onto it, a panel over the content, full height. `features.edgeBar.panels(context)` gives the panels for the page's context (the stack's entity levels, the domain, the route, the user), called again when it changes: global panels always, contextual ones in theirs. Badges stay live while it is closed; the open tab is kept across pages while still given, else falls back; tab, chevron, Escape and a click outside; focus in and back; tablist; full width under `narrowAt`. `useEdgeBar()` opens a panel from a page; `QdEdgeBar` and `QdEdgePanel` for a layout of the app's own. Docs: edge-bar.md.
