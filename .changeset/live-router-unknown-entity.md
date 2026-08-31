---
"@quazardous/qdadm": patch
---

Fix: a live event naming an entity with no registered manager is dropped instead of throwing (#1888). `Orchestrator.get()` raises on an unknown name by design — to catch developer typos loudly — so the live router now checks `has()` first. A typo in `sse.entities`, or an entity whose module is lazily loaded, would otherwise have raised inside the signal bus on every frame the backend sent.
