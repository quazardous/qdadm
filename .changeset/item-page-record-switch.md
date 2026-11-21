---
'@quazardous/qdadm': patch
---

Item pages reload when only the record id changes on the same route (#5431). `/books/A` to `/books/B` (a related-record link, the favourites or recents card, Back) kept the page and, with it, record A on screen. `useEntityItemPage` now empties and reads the new record; a late answer for the one left is dropped. Edit pages already did, behind the unsaved-changes guard.
