---
"@quazardous/qdadm": minor
---

A `security.grant` judge that loads its answers can hold the first navigation: `ready()` (#2412).

Reloading an entity page with a backend-judged app landed on the home page with "Access Denied": the first navigation starts inside `createApp()`, before the judge's request can answer, and its cache miss fell through to an empty role matrix. The documented workaround — fetching before `createApp()` — could not work either: the judge's `install()` runs inside `createApp()`.

```js
grant: {
  isGranted: (attribute) => answers.get(attribute),
  ready: () => loading, // the load in progress
}
```

The route guard now waits for `ready()` on entity routes before deciding. It still fails closed: a rejection, or no settling within `security.readyTimeoutMs` (10 s by default), denies the navigation with a console error naming the judge. Judges without `ready()` behave exactly as before, synchronously.

The security docs replace the pre-warm example with one that works: load on `kernel:ready` and `auth:login`, and return that load from `ready()`.
