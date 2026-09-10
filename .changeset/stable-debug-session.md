---
"@quazardous/qdadm": minor
---

The vite debug bridge keeps a tab's session id across reloads (#2231).

The id now lives in `sessionStorage`, so an agent targeting `?session=<id>` keeps its target through F5. A tab that says bye stays known for `reloadGraceMs` (default 30 s): a request sent to it meanwhile fails at once with "reloading — retry" instead of waiting out its timeout. `latest` prefers a connected tab over one still reloading, and `/__qdadm/sessions` entries carry `connected`.
