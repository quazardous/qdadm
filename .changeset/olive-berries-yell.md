---
'@quazardous/qdadm': patch
---

The search box actually searches

Reported against the demo's todos list; it was every list with a search box
over three of the five built-in storages.

`search` has been part of `ListParams` since the beginning. **Three storages
never read it.** `ApiStorage` dropped it before building the request,
`MemoryStorage` and `SdkStorage` dropped it before filtering. A user typed, the
list rebuilt its query, the term vanished, the rows came back unfiltered — and
nothing anywhere said why. `LocalStorage` and `MockApiStorage` had always
worked, which is what kept it hidden.

The helper they all needed, `searchItems`, had existed since #1192. Two
storages called it. This was not a missing capability; it was a missing call,
in the places nobody checked.

**`ApiStorage` now sends the term**, under whatever name your backend uses:

```js
new ApiStorage({ endpoint: '/posts', paramMapping: { search: 'q' } })
```

⚠️ **Map it, or your backend gets a `search` parameter it has never heard
of** — and an API that ignores an unknown parameter answers with everything,
so the list looks exactly as broken as before. This is the one case where the
fix can still leave you with the same symptom, so it is worth checking.

`searchFields` deliberately stays on the front: it says which fields qdadm
should look at when filtering a cached page locally, and a backend that
searches knows its own columns. Shipping an array parameter nobody asked for
would be a new surprise in place of the old one.

`SdkStorage` both sends the term and applies it locally when
`clientSidePagination` is on — otherwise an SDK that ignored it would hand
back the whole collection and that branch would paginate it as though it had
been searched.
