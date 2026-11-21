---
'@quazardous/qdadm': minor
---

useListPage: `sessionKey` (#5440), the key a list's session memory is kept under: its filters, search, and the sort the default composition keeps in the session. Default: the entity, shared by every list of it; give one per page when several lists show one entity (one per universe). The address keeps the entity's prefix, so links and saved searches do not change; #5425 and #5428 follow the key. The demo's genre books page has its own.
