---
'@quazardous/qdadm': patch
---

`query()` honours `cacheTtlMs`: an expired cache is dropped before it answers, so a list (which reads through `query()`) reads again past the TTL instead of serving its first read forever (#5464)
