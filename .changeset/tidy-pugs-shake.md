---
'@quazardous/qdadm': patch
---

The paginator shows the page the list is actually on

#2113 put the page number in the URL and it worked — coming back from a
detail view re-requested page 2, and page 2's rows appeared. **The paginator
still highlighted 1.** The screen said "page 1" over page 2's rows, and the
next click paged from the wrong place.

In lazy mode the table renders exactly the rows it is handed and cannot infer
which page they are; `first` — the row offset — is the only thing that tells
it, and qdadm never passed one. Clicking through worked because the click
moves the table's own internal offset. Nothing else could move it, so every
restored page landed under a paginator stuck on 1.

`ListPage` now takes a `first` prop and `useListPage` supplies it. **If you
render your own table** from `list.props`, bind `:first` — a lazy table
without it cannot position its paginator.

The tests drive a real PrimeVue paginator and assert which page button is
marked current, rather than checking `first === (page - 1) * pageSize`. That
arithmetic is the thing under test; asserting it against itself is how the
original defect got shipped — the rows were verified and the paginator was
never looked at.
