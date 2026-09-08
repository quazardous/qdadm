---
'@quazardous/qdadm': minor
---

Route-state keys go through an overridable locator

Hard-coding `offers.page` inside `UrlPersister` would make the naming scheme a
property of qdadm rather than of the app. `RouteStateKeyLocator` — `encode`,
`decode`, `looksScoped` — moves that decision out, **one per persister type**,
because the right scheme differs by medium: dots read well in a query string,
colons are the convention in web storage.

```js
new UrlPersister({ router, route, keyLocator: myScheme })
```

`decode` returns null for a key belonging to somebody else. That is what lets
a persister pick its own entries out of a medium it shares with everything
else, and it is the whole reason scopes exist.

**Old flat links keep working.** qdadm wrote `?page=2` unprefixed before this
seam, and those links are in bookmarks and pasted into tickets. `UrlPersister`
reads unprefixed keys when its scope has none of its own, so such a link still
lands on the right page instead of silently showing page 1. Writes are always
prefixed, so a link refreshes itself the first time anyone touches the list,
and the legacy key is retired then rather than left to shadow its replacement.

The fallback reads only keys **nobody** has scoped: `jobs.page` belongs to the
jobs list, and handing it to another one would be worse than ignoring it. Set
`readFlatFallback: false` to drop the compatibility now; it goes away on its
own in a later version.

Still consumed by nothing — `useListPage` is unchanged.
