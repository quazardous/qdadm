---
'@quazardous/qdadm': minor
---

Entity lists show a refresh button at the end of the filter bar: the rows read again past the entity's cache, the page, filters, search and sort kept, spinning and disabled while it reads. Shown by default: `refresh: false` on `useListPage` hides it, `features.lists.refresh: false` on every list (a list's own `refresh` wins). `list.refresh()` and `list.refreshing` for the app's own trigger (#5462)
