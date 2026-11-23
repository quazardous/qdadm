---
'@quazardous/qdadm': patch
---

Docs: `docs/storage.md`, a storage's list contract: what `list(params)` receives (no offset), the `{ items, total }` it must return and what a wrong total shows, where `ApiStorage` reads the total (header, then body) and its `paramMapping`, when the manager pages from its local cache (under `localFilterThreshold`, decided on an unfiltered read; off without `supportsTotal`), a storage of one's own with the `Headers.get()` pitfall, and tests to copy (#5463)
