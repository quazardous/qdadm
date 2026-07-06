---
"@quazardous/qdadm": patch
---

Fix `EntityManager.list()` total extraction on the resolved-endpoint path (child lists via `resolveStorage` → `storage.request`). Wrapper responses like `{ data: [...], pagination: { total } }` (or `{ data: [...], total }`) had their total read from the unwrapped items array, falling back to the page length — so pagination believed there was only one page. The wrapper-level `total` / `pagination.total` are now read before the page-length fallback (#1197).
