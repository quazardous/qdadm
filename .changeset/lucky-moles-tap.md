---
'@quazardous/qdadm': minor
---

The default is composed: the page in the link, the row count out of it

Lot C. The seam's signature was chosen so composition would be expressible
without changing it, and qdadm's own default turned out to be the case that
needed it.

Filters, search and the page belong in a link — that is the whole argument for
the URL being the default. **Rows-per-page does not.** It is a comfort setting
somebody picked once, and a link carrying it would impose the sender's row
count on whoever opens it. So the default routes by key:

```js
new CompositePersister({
  fallback: new UrlPersister({ router, route }),
  keys: { pageSize: { persister: new CookiePersister(), scope: 'app' } },
})
```

Which is what qdadm was already doing, by accident of where the code happened
to live. It is now a decision you can read, override, or copy.

**Your saved row count survives.** It moves from a bare `qdadm_pageSize`
cookie to a `qdadm_app` blob; the old cookie is read when the new store has
nothing, and retired on the first change. Verified in a browser both ways —
upgrade with only the legacy cookie present, and a reload after a change.

⚠️ **`routeState: 'url'` is not "the default, stated out loud".** It is a pure
URL persister, so the row count joins the query string. Say `'default'` if you
meant the default.

Composing your own works the same way — route any key to any persister, and
pin it to a fixed `scope` when it is one setting across the app rather than one
per screen. Two behaviours worth knowing:

- **A routed key wins over the fallback.** A stale `?pageSize=50` somebody
  left in a URL does not beat the cookie that owns the setting.
- **Clearing a list leaves pinned keys alone.** "Clear this list's filters" is
  not a request to reset an app-wide row count — otherwise one list's clear
  button would change every other list's.

An invalid stored size falls back to the default rather than being honoured:
the value arrives from a cookie or query string anyone can edit, and a row
count the paginator cannot offer would leave its dropdown blank.
