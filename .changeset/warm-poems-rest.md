---
'@quazardous/qdadm': minor
---

The sort joins the seam — and stays exactly where it was

The last of the five persistence sites moves behind `RouteStatePersister`.
Nothing you can observe changes, and that is the decision, not an accident.

Moving the sort to the URL was the tempting option: a list link would finally
carry its ordering. It would also mean the sort no longer survives opening a
clean `/offers`, which it always has — a gain nobody asked for against a loss
every existing user would feel. So the default composition routes `sort` back
to `sessionStorage`, per list, and the seam is worth having without buying it
with that trade.

What actually changed is the key: `qdadm_sort_offers` becomes
`qdadm:offers:sort`. **A sort saved before the upgrade is still read** when
the seam has nothing, and retired once carried over — the same migration
rows-per-page got.

The direction is stored only when there is a field to apply it to. An order on
its own is not partial state, it is meaningless state, and it used to leave a
`sortOrder` sitting in every unsorted list's namespace.

`persistSort: false` still turns it all off.

With this the table in `crud.md` finally describes a design rather than an
accumulation: filters, search and page in the query string; rows-per-page in
an app-wide cookie; sort in the session. One interface, three media, each
chosen for a stated reason.
