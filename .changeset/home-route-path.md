---
"@quazardous/qdadm": minor
---

`homeRoute: { name, component, path }` gives the home page an address of its own: the page is mounted on `path` and `/` redirects to it, so a link to it survives a change of home. Without `path`, the page still lives on `/` only, and development warns about it. The breadcrumb's house icon and the 404 page's "Back to Home" now follow the home route the app declares, whatever its name (#5365).
