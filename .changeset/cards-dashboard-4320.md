---
'@quazardous/qdadm': minor
---

Card dashboards (#4320): `CardsDashboard` shows a zone's blocks as cards each user reorders (drag with mouse, touch or pen, or arrow keys on the handle, announced), hides and pins at the top, in an edit mode with a tray of hidden cards (whole and dimmed, or as chips, `hiddenView` and a per-user switch) and Reset. The arrangement is kept in localStorage per dashboard and per user, and reconciled with the declared cards on each load. Any block with an id is a card, so the same blocks serve a classic `Zone`; a new optional `card` field on blocks adds `title`, `required`, `fixed`, `pinned` and `span`. `DashboardLayout customizable` renders its widgets zone this way. New: `useCardsArrangement`, `reconcileArrangement`, type `BlockCard`.
