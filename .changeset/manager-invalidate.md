---
'@quazardous/qdadm': minor
---

`manager.invalidate(id?)`: the app says a record changed (or the whole entity without an id). The caches drop what they hold of it and every mounted view reads it again, as for a change from the live stream (`source: 'app'`, heard like `'remote'`). A change event carrying an id now drops only that record's detail cache entry; the list cache still goes whole (#4959).
