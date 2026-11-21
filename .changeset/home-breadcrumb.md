---
'@quazardous/qdadm': patch
---

Breadcrumb (#5443): on the home page the trail is Home alone, whatever domain the page resolves to (no "Home > Overview > home"). `homeRoute` takes `meta` and `props`, set on the page's route. A route crumb nothing names (no `meta.navLabel`, `meta.title` or `breadcrumb.<route name>` in the catalogue) is left out instead of showing the raw route name, with a warning in development.

On a domain's own board, the trail no longer says the domain twice ("Home > Library > Library"): the domain crumb, without a link on its board, is now recognised as the board crumb that follows.
