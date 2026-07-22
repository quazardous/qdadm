---
"@quazardous/qdadm": minor
---

Vendor `pluralize` as an internal ESM module and drop it from dependencies (#1454). qdadm no longer has any CJS transitive, so `qdadmVitePlugin` stops emitting `optimizeDeps.include` entirely — this fixes the unresolvable `pluralize` optimizer error for `file:`-linked consumers (npm `install-links=false`), where qdadm's deps are never installed at the consumer root. Consumers that added `pluralize` as a direct-dependency workaround can remove it.
