---
'@quazardous/qdadm': minor
---

`useListPage` remembers its state through the seam — and its URL keys are now scoped

The list stops writing the query string by hand and goes through
`RouteStatePersister`. The default is still the URL and still `replace`, so
paging is still not a history step of its own.

**What you will see change: the keys carry the entity.** A list of offers
writes `?offers.page=2&offers.search=nginx`, not `?page=2&search=nginx`. That
is the point — it is what lets two lists live on one route without fighting
over a single `page` parameter, the collision `page-compositions.md` used to
tell people to dodge by turning persistence off.

**Links written before this keep working.** An unprefixed `?page=2` is still
read when the scope has nothing of its own, so bookmarks and links pasted into
tickets land where their sender was. The first write retires the flat key
rather than leaving two — and so does clearing the filters, which previously
would have left the address claiming a page the list was no longer showing.

**How to tell whether this reaches your code at all**, in one sweep — a
consumer who never reads the address bar for list state is entirely unaffected,
and most are:

```
route.query / $route.query      any read of `page`, `search` or a filter name?
location.search / location.href same
searchParams                    same — ignore the ones BUILDING an API request
```

Hits on a list key mean an assertion or a feature of yours expects the flat
shape and will now read `null`; no hits mean nothing to do. Worth two minutes
before upgrading rather than finding out from a test that looks like a
regression — a check for `page` returning `null` is indistinguishable from the
fix having failed. Read both forms if you need to straddle the versions:
`q.get('offers.page') ?? q.get('page')`.

(That sweep is BookShepherd's, from qdadm#2154, generalised here with thanks.)

Choose the medium per list:

```js
useListPage({ entity: 'offers', routeState: 'url' })      // slug…
useListPage({ entity: 'offers', routeState: myPersister }) // …or instance
```

`syncUrlParams` keeps the meaning it always had, which is narrower than its
name suggests: it governs **writing**. It has never stopped a query string
being read, and a hand-typed deep link still restores the list. Setting
`routeState` is a deliberate choice of medium, so it answers that flag rather
than obeying it.

A filter named `page` or `search` still warns. The scope separates this list
from *other* lists, not from qdadm's own keys, so within one list the
collision is real and the warning still names what wins.
