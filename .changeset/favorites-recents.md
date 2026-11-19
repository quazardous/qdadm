---
'@quazardous/qdadm': minor
---

Favourites and recents (#5349, lot 3b of #5337). A star beside the page title (`QdFavoriteStar`, drawn by `ListPage`, `ShowPage` and `FormPage` in edit mode, `:favorite="false"` to turn it off) adds the page to the person's favourites; "Save this search" on a filtered list keeps the list with its query under a name. The show and edit pages record the records opened lately (at most 20); a deleted record leaves both. They live in two entities the app declares, `favorites` (`{ kind, label, to, entity, at }`) and `recents` (`{ entity, itemId, label, to, at }`), read and written through their managers; `configureFavorites()` names others or turns one off, and without the entity the star does not show. `useFavorites()` and `useRecent()` read and change them; `QdFavoritesCard` and `QdRecentCard` show them live, through the new built-in card types `favorites` and `recent`.
