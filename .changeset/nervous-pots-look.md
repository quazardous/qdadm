---
'@quazardous/qdadm': minor
---

A seam for route-state persistence: `RouteStatePersister`

Where a route remembers what it is showing is now one interface with one rule,
instead of five unrelated sites that never met: filters in `sessionStorage`
AND the URL, sort in `sessionStorage` only, page size in a year-long global
cookie, the current page nowhere at all until recently. Each was invented
where it happened to be needed.

The list is one **consumer** of routing state, not the subject — a detail
page's active tab and a dashboard's date range are the same problem, and would
each invent their own answer without this.

```js
import { UrlPersister, resolveRouteStatePersister } from '@quazardous/qdadm'
```

A handler is a **slug or an instance**, the same convention `storage` already
follows, so consumers meet one shape rather than two. An unknown slug
**throws** rather than quietly falling back to the URL — a persistence choice
that silently does something else is the failure
[ADR 0011](docs/adr/0011-no-silent-no-ops.md) forbids, and the one this seam
exists to clean up after.

`UrlPersister` is the default medium, because it is the only one where "what I
am looking at" is also "what I can send you". It goes through the router the
app already has, with `replace`, and touches no route declaration. **Keys are
namespaced by scope** (`offers.page=2`), which is what will let two lists share
a route — the collision `page-compositions.md` currently tells people to avoid
by switching persistence off entirely.

**Nothing consumes it yet.** `useListPage` keeps its current behaviour
unchanged; wiring it up is the next step, deliberately separate so that the
seam can be judged before anything moves onto it.

Chrome preferences stay out by design: a collapsed sidebar belongs to the
person, not the route — sending someone a link must not fold their menu.
