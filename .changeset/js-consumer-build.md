---
'@quazardous/qdadm': patch
---

A JavaScript app builds again: `QdMultiFilter` declares its props at runtime instead of `defineProps<QdFilterProps>()`, whose imported type made the app's build load TypeScript ("Failed to load TypeScript, which is required for resolving imported types", 2.73.0). The consumer smoke test now also builds an app without TypeScript (#5469)
