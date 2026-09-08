---
'@quazardous/qdadm': minor
---

`ApiStorage` — the backend's pagination dialect is now configuration, not a subclass

`paramMapping` reached the **filters only**. You could rename `status` to
`state`, but not `page_size` to `limit`: `page`, `page_size`, `sort_by` and
`sort_order` went onto the wire hard-coded. Any backend speaking another
dialect — `_page`/`_limit`, `limit`/`offset` — had to override `list()` for
that reason alone. Our own demo had done exactly that, fetching whole
collections and slicing them client-side.

`paramMapping` now covers the entire outgoing query:

```js
new ApiStorage({
  endpoint: '/posts',
  paramMapping: { page: '_page', page_size: '_limit', sort_by: '_sort', sort_order: '_order' },
  responseTotalHeader: 'X-Total-Count',
})
```

New `responseTotalHeader` reads the total from a response **header**, for APIs
that report it there rather than in the body (`responseTotalKey` still handles
the body, and remains the fallback). A genuine `0` from the header is kept; the
header must be CORS-exposed to be readable from a browser.

Filters keep precedence over the pagination keys, exactly as before: a filter
named `page` still wins.

**Worth checking before you upgrade:** if you already pass a `paramMapping`
whose keys happen to include `page`, `page_size`, `sort_by` or `sort_order`,
those entries did nothing until now and will start renaming your pagination
parameters.
