---
"@quazardous/qdadm": minor
---

Cards: a × beside each favourite in `QdFavoritesCard` removes it at once, the line staying a few seconds with an Undo (`removable`, on by default; the generic `favorites` type takes ids and emits `remove` / `restore`). Every card may show an icon before its title: `envelope.icon`, default the type's own from its sheet (`favorites`, `recent`, `agenda`, `feed`, `queue`), `null` for none. A record's star waits for the record: no more favourite named "View Task"; a record without a label is named by its id. Long favourite labels are cut with an ellipsis.
