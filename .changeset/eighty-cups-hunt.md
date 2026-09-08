---
'@quazardous/qdadm': minor
---

Route state: five media to choose from, and three levels to choose at

The seam had one persister. It now has the set, and somewhere to declare it
other than on every list.

```js
new Kernel({ routeState: 'url' })                          // the app-wide floor
ctx.entity('audit_rows', { routeState: 'local_storage' })  // every screen showing it
useListPage({ entity: 'offers', routeState: 'none' })      // this screen only
```

Most specific wins: **the list → the entity → the kernel → the URL.** Each
level exists because somebody has to be able to say it there — a screen's
medium is a screen's decision, an entity's is a modelling one, and an app-wide
floor belongs in the bootstrap.

| Slug | Medium | Reach for it when |
|---|---|---|
| `url` | query string | the state is worth sending someone — the default |
| `local_storage` | `localStorage` | worth keeping, not worth linking |
| `session_storage` | `sessionStorage` | worth keeping until the tab closes |
| `cookie` | one cookie per scope | the **server** needs to read it |
| `memory` | a shared map | survives navigation, not a reload |
| `none` | nowhere | this screen forgets, and says so |

Each medium keeps the same contract and differs only where the medium really
does:

- **The cookie stores one blob per scope**, not one entry per key, because
  every cookie rides on every request to your origin — eight filters must not
  become eight cookies on every image the page loads. It is also the only one
  worth reaching for when the *server* reads the state; otherwise it is wire
  cost for nothing.
- **Memory outlives the persister that wrote it.** A list rebuilds its
  persister on mount, so state held on the instance would die on exactly the
  navigation this is meant to survive.
- **Web storage that throws does not take the screen down.** Private browsing,
  blocked site data and a full quota all raise rather than return null; qdadm
  warns once, naming the medium, and the list keeps working. Announced, so not
  the silent no-op [ADR 0011](docs/adr/0011-no-silent-no-ops.md) forbids.
- **`none` is reached only by name.** Nothing falls back to it and an unknown
  slug still throws — it does nothing because somebody wrote it down.

**Values keep their type outside the URL.** A query string coerces, because
people read it: `?level=42` returns the number 42. The other media store JSON,
so a filter holding the *string* `'42'` stays a string there. It matters to
code comparing with `===`.

Key naming is overridable per medium, since the right scheme differs by
medium: dots in a query string, colons in web storage, and underscores in a
cookie — where a name is an RFC 6265 token that may contain neither.

New doc: [route-state.md](docs/route-state.md).
