---
'@quazardous/qdadm': minor
---

A list filter with a `default` emptied on purpose is written explicitly in the address (`tasks.state=null`) and kept as null in the session: read back as null, not given its default again, one change one load; Clear filters still returns it to its default. The token is the entity's `filterEmptyValue` or the filter's own `emptyValue` when set, read back as null too (#5460)
