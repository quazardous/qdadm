---
"@quazardous/qdadm-mcp": patch
---

The relay knows which page the tab is on, after every navigation (#2317).

- **The tab tells the relay its page again after each route change.** `instances`, the Stop hook line and screenshot file names (`…-books-12-edit.jpg`) no longer keep the page the tab connected on.
- **Under hash routing the page is the route in the hash:** `/#/books`, not `/`.
