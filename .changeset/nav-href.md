---
"@quazardous/qdadm": minor
---

feat(nav): a menu entry can link out of the app. `ctx.navItem({ href })` instead of `route` renders a link in its section. An absolute URL opens in a new tab with `rel="noopener noreferrer"` and a small marker, `target` overrides that, and `permission` hides the link from whoever is not granted it. An entry with both or neither of `route` and `href` throws at registration.
