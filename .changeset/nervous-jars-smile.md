---
'@quazardous/qdadm': patch
---

Docs: `syncUrlParams` does not sync the sort, and the demo now paginates for real

`docs/crud.md` described `syncUrlParams` as "Sync filters/sort with URL". The
sort never reaches the URL — `onSort` writes to the session and nothing else.
The line described an intention rather than the code, and a consumer who
trusted it concluded the URL carried more state than it does.

The documentation now states where each piece of list state actually lives
(URL, session, or nowhere).
