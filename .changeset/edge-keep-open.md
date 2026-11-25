---
"@quazardous/qdadm": patch
---

The edge bar's panel keeps its open state across navigation (#5518): a page that gives no panel no longer closes it (the bar goes, the panel opens again, on its tab and pinned if it was, on the next page that gives panels); whether it is open is kept for the session, so a reload opens it again; unpinned, a click outside that navigates (a menu link, a row opening a record) no longer closes it.
