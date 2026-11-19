---
'@quazardous/qdadm': patch
---

A tabbed item (#4978): inside the `ctx.itemTabs()` frame the breadcrumb no longer repeats the tabs. Its default sibling links and the View mode link are left out (the Details tab is the View), Edit stays. Outside a frame nothing changes.
