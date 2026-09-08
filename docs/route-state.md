# Route state

Where a screen remembers what it is showing — which page, which filters, which
search — and how to change that per list, per entity, or app-wide.

The default is the URL, because it is the only medium where *what I am looking
at* is also *what I can send you*.

## The keys are scoped

A list namespaces its state under its entity:

```
/offers?offers.page=2&offers.search=nginx
```

That is what lets two lists share a route. Nothing about it needs configuring;
it is worth knowing because you will see it in the address bar, and because a
link written before this shape existed still works — an unprefixed `?page=2`
is read when the scope has nothing of its own, and retired the first time the
list writes.

## Choosing a medium

```js
useListPage({ entity: 'offers', routeState: 'local_storage' })
```

| Slug | Medium | Reach for it when |
|---|---|---|
| `url` | query string | the state is worth sending someone — **the default** |
| `local_storage` | `localStorage` | worth keeping, not worth linking |
| `session_storage` | `sessionStorage` | worth keeping until the tab closes |
| `cookie` | one cookie per scope | the **server** needs to read it |
| `memory` | a shared map | survives navigation, not a reload |
| `none` | nowhere | this screen forgets, and says so |

An unknown slug **throws**. It does not fall back to the URL: a persistence
choice that quietly does something else is the failure
[ADR 0011](adr/0011-no-silent-no-ops.md) forbids.

## Who decides

Most specific wins:

```
the list  →  the entity  →  the kernel  →  the URL
```

```js
new Kernel({ routeState: 'url' })                      // the app-wide floor
ctx.entity('audit_rows', { routeState: 'local_storage' })  // every screen showing it
useListPage({ entity: 'offers', routeState: 'none' })      // this screen only
```

Each level exists because somebody has to be able to say it there. A screen's
medium is a screen's decision; an entity's is a modelling one — an audit list
nobody ever links to can say so once, rather than on each of the four pages
that render it.

## Writing your own

A persister is three methods. Pass an instance anywhere a slug is accepted.

```js
class ServerPersister {
  name = 'server'
  read(scope) { /* … */ }
  write(scope, state) { /* … */ }
  clear(scope) { /* … */ }
}

useListPage({ entity: 'offers', routeState: new ServerPersister() })
```

The state is an opaque bag of keys. That is deliberate: every consumer has its
own shape, and fixing one here would only fit whichever consumer was written
first.

One rule the built-ins all follow and yours should: **a key whose value is
`null`, `undefined` or `''` is removed, not stored empty.** It is what makes a
pristine screen leave no trace.

### Naming keys

How a `(scope, key)` pair becomes a stored key is its own decision, one per
medium — dots read well in a query string, colons are the convention in web
storage, and a cookie *name* is an RFC 6265 token that may not contain either.

```js
new UrlPersister({ router, route, keyLocator: myScheme })
```

`decode` returns null for a key belonging to somebody else. That is what lets
a persister pick its own entries out of a medium it shares with everything
else, and it is the whole reason scopes exist.

## What does not belong here

**Chrome preferences.** A collapsed sidebar belongs to the person, not to the
route: sending someone a link must not fold their menu. The line is *what I am
looking at* versus *how I like my interface*.

## Two things worth knowing before you switch a screen

**The URL coerces, the other media do not.** A query string is meant to be
read by people, so `?level=42` comes back as the number `42` and `?on=true` as
a boolean. Web storage, cookies and memory keep JSON, so a filter holding the
*string* `'42'` survives as a string there and as a number in the URL. It
matters to code comparing with `===`.

**`syncUrlParams` governs writing.** It has never stopped a query string being
read — a hand-typed deep link restores a list configured with `false`.
Setting `routeState` is a deliberate choice of medium, so it *answers* that
flag rather than obeying it.

## Background

[#2146](https://github.com/quazardous/qdadm/issues/2146) — five persistence
sites that had never met (filters in the session *and* the URL, sort in the
session only, page size in a year-long global cookie, the page nowhere at all)
becoming one interface with one rule.
