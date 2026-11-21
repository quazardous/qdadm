---
'@quazardous/qdadm': patch
---

useListPage: filters and a search restored from the session now go into the address once the list is mounted, by `router.replace` (no history step), when the address does not carry them (#5425). A list reached by a bare address (`/tasks` from the side menu) no longer shows filtered rows under an unfiltered address: a copied link keeps the filters, and the app's `domainResolver` sees them again.
