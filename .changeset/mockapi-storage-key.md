---
'@quazardous/qdadm': minor
---

MockApiStorage accepts a `storageKey` option to override the default
`mockapi_<entityName>_data` localStorage key — several apps sharing one
origin (e.g. multiple demos on a GitHub Pages site) can now seed the same
entity names without clobbering each other.
