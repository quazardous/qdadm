---
'@quazardous/qdadm': minor
---

A tabbed item: `ctx.itemTabs(entity, { header?, details?, component? })` shows an item's pages (its show page, child pages and child lists) as tabs under the item's header, the page in a `router-view` below. The pages are nested under one frame route (`EntityItemLayout`); their names, paths, guards and breadcrumb are unchanged, tabs the user cannot open are left out, and a tab switch keeps the header (#4963).
