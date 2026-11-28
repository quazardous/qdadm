---
"@quazardous/qdadm": minor
---

List filters searched on the server (#5576): `searchOptions(query, { limit, signal })` or `searchEndpoint` (`GET <endpoint>?q=…&limit=…`), called after `searchDelay` (250 ms) from `searchMinChars`, for at most `searchLimit`, a newer search aborting the older; drawn by the new `QdSearchFilter` (one value: a Select with the search in the open list, the field not typed into, the fixed options as quick choices on top, the results by group) or by `QdMultiFilter` (several). A value from the address that is no choice is marked `unlisted: true` and labelled by the filter's `labelFor(value)` (sync or a promise, cached), never a quick choice. `useRemoteChoices` and `asChoices` exported.
