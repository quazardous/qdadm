---
"@quazardous/qdadm": patch
---

Show field resolver crashed on canonical object-form references: `generateFields()` passed `reference: { entity }` straight to `orchestrator.get()`, throwing `No manager for entity "[object Object]"` and blanking the show page. The resolver now normalizes both forms (object and bare string) and probes `orchestrator.has()` before resolving.
