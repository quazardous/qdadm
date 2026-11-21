---
'@quazardous/qdadm': minor
---

useListPage: an address that names at least one of the list's filters (or its search) now describes a whole state (#5428). The session's other filters go back to their default and its search goes, instead of being merged in, except the filters declared `keepFromSession: true` (preferences that stay whatever the link). A bare address still takes the session back. The list also follows its address when it changes under it (a link to the list while already on it, Back), under the same rule. Behaviour change: a link that relied on inheriting the session's other filters now shows only what it names.
