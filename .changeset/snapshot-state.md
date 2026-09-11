---
"@quazardous/qdadm-mcp": minor
---

`page_snapshot`'s header says what the page is doing (#2363), from qdadm's page state:

```
State: list — 8 of 12 rows, page 1 (8/page), sort title asc, search "dune", filters genre=sci-fi, 2 selected
State: edit form — dirty: title, year; errors: author (Author is required)
State: show — loaded
```

The line is left out when the app exposes no page state.
