---
"@quazardous/qdadm": minor
---

A page's domain is now part of the context stack, and the app can decide it (#5412).

- **In the stack.** The kernel resolves the domain at each route change, and the active stack holds it beside its entity levels. `useActiveStack().domain` gives the domain level, `{ type: 'domain', name, source }`. `context` gives the domain followed by the entity levels. The domain bar and the breadcrumb read the domain from the stack, and the breadcrumb shows it right after Home.
- **`?domain=<name>`.** The default rule reads it after `meta.domain` and before the entity and the module.
- **`features.domainResolver(route, { fallback, previous, stack, getDomain })`.** It has the last word: it returns a domain name, `null` for no domain, or `undefined` to keep what the default rule found.
- **Kept from page to page.** When a page's domain comes from `?domain=` or from the resolver, every navigation along the same record chain (its list, its records, their edit pages, their children) carries that domain in `?domain=`, so it survives a reload or a shared link. A side-menu click leaves the domain.
- **For the app's own links.** `withDomain(to, name)` and `useDomainLink().withDomain(to)` add a domain to a link the app builds itself.
