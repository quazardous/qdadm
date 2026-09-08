---
'@quazardous/qdadm': minor
---

List rows no longer wait behind filter dropdowns, and `filter:alter` moves ahead of them

`onMounted` interleaved two different kinds of work. Settling **what the query
asks for** — the filters, search and page restored from the URL, plus whatever
the alter hooks add — and **fetching things**, which meant the filter options
that populate dropdowns. The rows waited for both, though they depend only on
the first. A list whose filters pull their options from related entities
showed nothing until every one of those round trips had returned, for content
nobody needs in order to read the table.

The two are now separated. The query is settled first, the rows leave, and the
dropdowns fill in on their own:

```
restoreFilters()          // filters, search, page — from the URL
await filter:alter        // whatever the hooks add
await list:alter
loadItems()               // the query is complete
loadFilterOptions()       // not awaited
```

**BREAKING for `filter:alter` hooks.** The hook used to run at the end of
`loadFilterOptions()`, so it saw filters whose `options` were already
populated. It now runs before that fetch, and sees them unpopulated. A hook
that only adds, removes or reconfigures filters is unaffected; one that
inspects or rewrites a filter's loaded `options` needs revisiting.

`loadFilterOptions()` also fetches in parallel now rather than one filter at a
time — three remote filters cost the slowest instead of the sum. Filters
sharing one `optionsEntity` are still chained, so the second keeps reading the
cache the first filled instead of racing it.

Thanks to BookShepherd for the report, and for asking what `invokeListAlterHook`
could change before proposing the reorder — that question is what showed the
naive version was unsafe.
